use std::collections::HashMap;
use std::process::Command;

use crate::github::{GitHubConfig, RepoStatus, UploadManager};

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

    let (owner, repo) = parse_github_remote(&origin_url).ok_or_else(|| {
        "origin 远端不是 GitHub 仓库，请使用 GitHub 远端".to_string()
    })?;

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
pub async fn github_get_changes_preview(app: tauri::AppHandle) -> Result<crate::github::types::ChangesPreview, String> {
    use crate::github::types::{ChangedFile, ChangesPreview};
    
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;

    let status_output = run_git(&config.repo_path, &["status", "--porcelain"])?;
    
    let mut files = Vec::new();
    let mut total_added = 0;
    let mut total_modified = 0;
    let mut total_deleted = 0;

    for line in status_output.lines() {
        if line.trim().is_empty() {
            continue;
        }
        
        let index_status = line.chars().next().unwrap_or(' ');
        let worktree_status = line.chars().nth(1).unwrap_or(' ');
        let path = line[3..].to_string();
        
        let (status, staged) = match (index_status, worktree_status) {
            ('A', _) => { total_added += 1; ("added".to_string(), true) }
            ('M', _) => { total_modified += 1; ("modified".to_string(), true) }
            ('D', _) => { total_deleted += 1; ("deleted".to_string(), true) }
            ('?', '?') => { total_added += 1; ("untracked".to_string(), false) }
            (_, 'M') => { total_modified += 1; ("modified".to_string(), false) }
            (_, 'D') => { total_deleted += 1; ("deleted".to_string(), false) }
            _ => ("unknown".to_string(), false)
        };

        files.push(ChangedFile { status, path, staged });
    }

    Ok(ChangesPreview {
        files,
        total_added,
        total_modified,
        total_deleted,
    })
}

#[tauri::command]
pub async fn github_stage_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    run_git(&config.repo_path, &["add", &path])?;
    Ok(())
}

#[tauri::command]
pub async fn github_unstage_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    run_git(&config.repo_path, &["reset", "HEAD", &path])?;
    Ok(())
}

#[tauri::command]
pub async fn github_discard_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    run_git(&config.repo_path, &["checkout", "--", &path])?;
    Ok(())
}

#[tauri::command]
pub async fn github_stage_all(app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    run_git(&config.repo_path, &["add", "."])?;
    Ok(())
}

#[tauri::command]
pub async fn github_unstage_all(app: tauri::AppHandle) -> Result<(), String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;
    run_git(&config.repo_path, &["reset", "HEAD"])?;
    Ok(())
}

#[tauri::command]
pub async fn github_commit_and_push(
    message: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let config = GitHubConfig::from_store(&app).map_err(|e| format!("仓库配置加载失败: {e}"))?;
    ensure_is_git_repo(&config.repo_path)?;

    run_git(&config.repo_path, &["add", "objects"])?;

    let has_staged_changes = Command::new("git")
        .args(["diff", "--cached", "--quiet"])
        .current_dir(&config.repo_path)
        .status()
        .map_err(|e| format!("执行 git diff 失败: {e}"))?
        .success()
        == false;

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

fn ensure_is_git_repo(repo_path: &std::path::Path) -> Result<(), String> {
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

fn run_git(repo_path: &std::path::Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("执行 git {:?} 失败: {}", args, e))?;

    if !output.status.success() {
        return Err(format!(
            "git {:?} 失败: {}",
            args,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
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
