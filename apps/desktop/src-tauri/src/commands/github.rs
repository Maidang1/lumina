use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Component, Path};
use std::process::{Command, Output};

use crate::github::{GitChangesSnapshot, GitFileState, GitHubConfig, RepoStatus, UploadManager};

pub fn create_github_manager(app: &tauri::AppHandle, operation: &str) -> Result<UploadManager, String> {
    let config = GitHubConfig::from_store(app).map_err(|e| {
        eprintln!("[{operation}] Config load failed: {e}");
        format!("仓库配置加载失败: {e}")
    })?;
    Ok(UploadManager::new(config, 3))
}

#[tauri::command]
pub async fn github_upload_image(
    image_id: String,
    original: Vec<u8>,
    original_mime: String,
    thumb: Vec<u8>,
    thumb_variants: HashMap<String, Vec<u8>>,
    metadata: String,
    defer_finalize: bool,
    app: tauri::AppHandle,
) -> Result<crate::github::UploadResult, String> {
    let manager = create_github_manager(&app, "Repo Upload")?;

    manager
        .upload_image_concurrent(
            image_id,
            original,
            original_mime,
            thumb,
            thumb_variants,
            metadata,
            defer_finalize,
        )
        .await
        .map_err(|e| format!("上传失败: {}", e))
}

#[tauri::command]
pub async fn github_delete_image(
    image_id: String,
    app: tauri::AppHandle,
) -> Result<crate::github::DeleteResult, String> {
    let manager = create_github_manager(&app, "Repo Delete")?;
    manager
        .delete_image(image_id)
        .await
        .map_err(|e| format!("删除失败: {}", e))
}

#[tauri::command]
pub async fn github_revert_image(
    image_id: String,
    app: tauri::AppHandle,
) -> Result<crate::github::RevertResult, String> {
    let manager = create_github_manager(&app, "Repo Revert")?;
    manager
        .revert_image(image_id)
        .await
        .map_err(|e| format!("撤销失败: {}", e))
}

#[tauri::command]
pub async fn github_finalize_batch(
    metadatas: Vec<String>,
    app: tauri::AppHandle,
) -> Result<crate::github::BatchFinalizeResult, String> {
    let manager = create_github_manager(&app, "Repo Batch")?;
    manager
        .finalize_batch(metadatas)
        .await
        .map_err(|e| format!("批量完成失败: {}", e))
}

#[tauri::command]
pub async fn github_list_images(
    cursor: Option<String>,
    limit: usize,
    app: tauri::AppHandle,
) -> Result<crate::github::ImageListResponse, String> {
    let manager = create_github_manager(&app, "Repo List")?;
    manager
        .list_images(cursor, limit)
        .await
        .map_err(|e| format!("列表查询失败: {}", e))
}

#[tauri::command]
pub async fn github_update_image_metadata(
    image_id: String,
    updates: serde_json::Value,
    app: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    let manager = create_github_manager(&app, "Repo Update Metadata")?;
    manager
        .update_image_metadata(image_id, updates)
        .await
        .map_err(|e| format!("更新元数据失败: {}", e))
}

#[tauri::command]
pub async fn github_get_repo_status(app: tauri::AppHandle) -> Result<RepoStatus, String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;

    ensure_is_git_repo(&config.repo_path)?;

    let branch = run_git(&config.repo_path, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    let origin_url = run_git(&config.repo_path, &["remote", "get-url", "origin"])?;
    let dirty_files = run_git(&config.repo_path, &["status", "--porcelain"])?
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count();

    let (owner, repo) = parse_github_remote(&origin_url)
        .ok_or_else(|| "origin 远端不是 GitHub 仓库，请使用 GitHub 远端".to_string())?;

    Ok(RepoStatus {
        configured: true,
        repo_path: config.repo_path.to_string_lossy().to_string(),
        branch,
        origin_url,
        owner,
        repo,
        dirty_files,
    })
}

#[tauri::command]
pub async fn github_get_changes_preview(app: tauri::AppHandle) -> Result<GitChangesSnapshot, String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    collect_changes_snapshot(&config.repo_path)
}

#[tauri::command]
pub async fn github_stage_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    validate_relative_path(&path)?;
    run_git(&config.repo_path, &["add", "-A", "--", &path])?;
    Ok(())
}

#[tauri::command]
pub async fn github_unstage_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    validate_relative_path(&path)?;

    let restore = run_git_allow_failure(&config.repo_path, &["restore", "--staged", "--", &path])?;
    if !restore.status.success() {
        run_git(&config.repo_path, &["reset", "HEAD", "--", &path])?;
    }
    Ok(())
}

#[tauri::command]
pub async fn github_discard_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    validate_relative_path(&path)?;

    if !is_tracked_path(&config.repo_path, &path)? {
        return Err("只能放弃已跟踪文件的工作区更改".to_string());
    }

    run_git(&config.repo_path, &["restore", "--worktree", "--", &path])?;
    Ok(())
}

#[tauri::command]
pub async fn github_delete_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    validate_relative_path(&path)?;

    if is_tracked_path(&config.repo_path, &path)? {
        run_git(&config.repo_path, &["rm", "-f", "--", &path])?;
        return Ok(());
    }

    let absolute = config.repo_path.join(&path);
    if !absolute.exists() {
        return Err("文件不存在，无法删除".to_string());
    }
    ensure_path_within_repo(&config.repo_path, &absolute)?;

    if absolute.is_dir() {
        fs::remove_dir_all(&absolute).map_err(|e| format!("删除目录失败: {e}"))?;
    } else {
        fs::remove_file(&absolute).map_err(|e| format!("删除文件失败: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn github_stage_all(app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    run_git(&config.repo_path, &["add", "-A"])?;
    Ok(())
}

#[tauri::command]
pub async fn github_unstage_all(app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;

    let restore = run_git_allow_failure(&config.repo_path, &["restore", "--staged", ":/"])?;
    if !restore.status.success() {
        run_git(&config.repo_path, &["reset", "HEAD"])?;
    }
    Ok(())
}

#[tauri::command]
pub async fn github_commit_and_push(
    message: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;

    let has_staged_changes = !Command::new("git")
        .args(["diff", "--cached", "--quiet"])
        .current_dir(&config.repo_path)
        .status()
        .map_err(|e| format!("执行 git diff 失败: {e}"))?
        .success();

    if !has_staged_changes {
        return Ok("Nothing to commit".to_string());
    }

    let commit_message = message.unwrap_or_else(|| {
        format!(
            "lumina: sync assets {}",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
        )
    });

    run_git(&config.repo_path, &["commit", "-m", &commit_message])?;

    let branch = run_git(&config.repo_path, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    run_git(&config.repo_path, &["pull", "--rebase", "origin", &branch])?;
    run_git(&config.repo_path, &["push", "origin", &branch])?;

    Ok("Commit and push completed".to_string())
}

#[tauri::command]
pub async fn github_sync_repo(app: tauri::AppHandle) -> Result<String, String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;

    let branch = run_git(&config.repo_path, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    run_git(&config.repo_path, &["pull", "--rebase", "origin", &branch])?;

    Ok(format!("Sync completed: {}", branch))
}

fn collect_changes_snapshot(repo_path: &Path) -> Result<GitChangesSnapshot, String> {
    let mut states = BTreeMap::<String, GitFileState>::new();

    let staged_output = run_git_raw(repo_path, &["diff", "--cached", "--name-status", "-z"])?;
    if !staged_output.status.success() {
        return Err(stderr_for_git(&["diff", "--cached", "--name-status", "-z"], &staged_output));
    }

    for parsed in parse_name_status_z(&staged_output.stdout) {
        upsert_state(&mut states, parsed.path, parsed.old_path, Some(parsed.status), None, false);
    }

    let unstaged_output = run_git_raw(repo_path, &["diff", "--name-status", "-z"])?;
    if !unstaged_output.status.success() {
        return Err(stderr_for_git(&["diff", "--name-status", "-z"], &unstaged_output));
    }

    for parsed in parse_name_status_z(&unstaged_output.stdout) {
        upsert_state(&mut states, parsed.path, parsed.old_path, None, Some(parsed.status), false);
    }

    let untracked_output = run_git_raw(repo_path, &["ls-files", "--others", "--exclude-standard", "-z"])?;
    if !untracked_output.status.success() {
        return Err(stderr_for_git(
            &["ls-files", "--others", "--exclude-standard", "-z"],
            &untracked_output,
        ));
    }

    for entry in untracked_output.stdout.split(|b| *b == 0).filter(|chunk| !chunk.is_empty()) {
        let path = String::from_utf8_lossy(entry).to_string();
        upsert_state(&mut states, path, None, None, None, true);
    }

    Ok(GitChangesSnapshot {
        files: states.into_values().collect(),
    })
}

fn upsert_state(
    states: &mut BTreeMap<String, GitFileState>,
    path: String,
    old_path: Option<String>,
    staged_status: Option<String>,
    unstaged_status: Option<String>,
    untracked: bool,
) {
    let entry = states.entry(path.clone()).or_insert_with(|| GitFileState {
        path,
        old_path: None,
        staged_status: None,
        unstaged_status: None,
        untracked: false,
    });

    if old_path.is_some() {
        entry.old_path = old_path;
    }
    if staged_status.is_some() {
        entry.staged_status = staged_status;
    }
    if unstaged_status.is_some() {
        entry.unstaged_status = unstaged_status;
    }
    if untracked {
        entry.untracked = true;
    }
}

#[derive(Debug)]
struct ParsedNameStatus {
    path: String,
    old_path: Option<String>,
    status: String,
}

fn parse_name_status_z(stdout: &[u8]) -> Vec<ParsedNameStatus> {
    let chunks: Vec<&[u8]> = stdout.split(|b| *b == 0).filter(|chunk| !chunk.is_empty()).collect();
    let mut i = 0usize;
    let mut items = Vec::new();

    while i < chunks.len() {
        let status_token = String::from_utf8_lossy(chunks[i]).to_string();
        i += 1;

        let Some(first_code) = status_token.chars().next() else {
            continue;
        };

        match first_code {
            'R' | 'C' => {
                if i + 1 >= chunks.len() {
                    break;
                }
                let old_path = String::from_utf8_lossy(chunks[i]).to_string();
                let new_path = String::from_utf8_lossy(chunks[i + 1]).to_string();
                i += 2;
                items.push(ParsedNameStatus {
                    path: new_path,
                    old_path: Some(old_path),
                    status: map_name_status(&status_token),
                });
            }
            _ => {
                if i >= chunks.len() {
                    break;
                }
                let path = String::from_utf8_lossy(chunks[i]).to_string();
                i += 1;
                items.push(ParsedNameStatus {
                    path,
                    old_path: None,
                    status: map_name_status(&status_token),
                });
            }
        }
    }

    items
}

fn map_name_status(token: &str) -> String {
    let code = token.chars().next().unwrap_or('?');
    match code {
        'A' => "added".to_string(),
        'M' => "modified".to_string(),
        'D' => "deleted".to_string(),
        'R' => "renamed".to_string(),
        'C' => "copied".to_string(),
        'T' => "type_changed".to_string(),
        'U' => "unmerged".to_string(),
        _ => "unknown".to_string(),
    }
}

fn ensure_is_git_repo(repo_path: &Path) -> Result<(), String> {
    let output = Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("执行 git 失败: {e}"))?;

    if !output.status.success() {
        return Err("选择的目录不是有效的 git 仓库".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout != "true" {
        return Err("选择的目录不是有效的 git 仓库".to_string());
    }

    Ok(())
}

fn validate_relative_path(path: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("路径不能为空".to_string());
    }

    let normalized = Path::new(path);
    if normalized.is_absolute() {
        return Err("仅允许仓库内相对路径".to_string());
    }

    for component in normalized.components() {
        match component {
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("路径非法：不允许越界路径".to_string());
            }
            _ => {}
        }
    }

    Ok(())
}

fn ensure_path_within_repo(repo_path: &Path, candidate: &Path) -> Result<(), String> {
    let canonical_repo = repo_path
        .canonicalize()
        .map_err(|e| format!("仓库路径无效: {e}"))?;

    let canonical_candidate = candidate
        .canonicalize()
        .map_err(|e| format!("路径无效: {e}"))?;

    if !canonical_candidate.starts_with(&canonical_repo) {
        return Err("路径非法：目标不在仓库内".to_string());
    }

    Ok(())
}

fn is_tracked_path(repo_path: &Path, path: &str) -> Result<bool, String> {
    let output = run_git_allow_failure(repo_path, &["ls-files", "--error-unmatch", "--", path])?;
    Ok(output.status.success())
}

fn run_git(repo_path: &Path, args: &[&str]) -> Result<String, String> {
    let output = run_git_raw(repo_path, args)?;

    if !output.status.success() {
        return Err(stderr_for_git(args, &output));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn run_git_allow_failure(repo_path: &Path, args: &[&str]) -> Result<Output, String> {
    run_git_raw(repo_path, args)
}

fn run_git_raw(repo_path: &Path, args: &[&str]) -> Result<Output, String> {
    Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("执行 git {:?} 失败: {}", args, e))
}

fn stderr_for_git(args: &[&str], output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    format!("git {:?} 失败: {}", args, stderr)
}

fn parse_github_remote(url: &str) -> Option<(String, String)> {
    let trimmed = url.trim();

    if let Some(rest) = trimmed.strip_prefix("git@github.com:") {
        let path = rest.trim_end_matches(".git");
        let mut parts = path.split('/');
        let owner = parts.next()?.to_string();
        let repo = parts.next()?.to_string();
        return Some((owner, repo));
    }

    if let Some(rest) = trimmed.strip_prefix("https://github.com/") {
        let path = rest.trim_end_matches(".git");
        let mut parts = path.split('/');
        let owner = parts.next()?.to_string();
        let repo = parts.next()?.to_string();
        return Some((owner, repo));
    }

    None
}
