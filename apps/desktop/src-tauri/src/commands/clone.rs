use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};

use serde_json::json;
use tauri::{Emitter, Manager};
use tauri_plugin_store::StoreExt;

use crate::github::{CloneProgress, CloneResult, GitHubRepoInfo};

const REPO_PATH_STORAGE_KEY: &str = "lumina.git_repo_path";

fn parse_github_url_internal(url: &str) -> Option<(String, String, String)> {
    let trimmed = url.trim();

    if let Some(rest) = trimmed.strip_prefix("git@github.com:") {
        let path = rest.trim_end_matches(".git");
        let mut parts = path.split('/');
        let owner = parts.next()?.to_string();
        let repo = parts.next()?.to_string();
        return Some((owner, repo, trimmed.to_string()));
    }

    let https_url = if trimmed.starts_with("github.com/") {
        format!("https://{}", trimmed)
    } else {
        trimmed.to_string()
    };

    if let Some(rest) = https_url.strip_prefix("https://github.com/") {
        let path = rest.trim_end_matches(".git").trim_end_matches('/');
        let mut parts = path.split('/');
        let owner = parts.next()?.to_string();
        let repo = parts.next()?.to_string();
        if !owner.is_empty() && !repo.is_empty() {
            return Some((owner, repo, https_url));
        }
    }

    None
}

fn stable_url_hash(input: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in input.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn canonical_repo_url(owner: &str, repo: &str) -> String {
    format!(
        "https://github.com/{}/{}",
        owner.to_ascii_lowercase(),
        repo.to_ascii_lowercase()
    )
}

fn sanitize_path_component(input: &str) -> String {
    let mut output = String::new();
    let mut previous_underscore = false;

    for ch in input.chars() {
        let normalized = if ch.is_ascii_alphanumeric() {
            previous_underscore = false;
            ch.to_ascii_lowercase()
        } else if previous_underscore {
            continue;
        } else {
            previous_underscore = true;
            '_'
        };
        output.push(normalized);
    }

    let trimmed = output.trim_matches('_').to_string();
    if trimmed.is_empty() {
        "repo".to_string()
    } else {
        trimmed
    }
}

fn get_repo_cache_base_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("无法获取应用缓存目录: {e}"))?;

    let repo_base = cache_dir.join("repos");
    std::fs::create_dir_all(&repo_base).map_err(|e| format!("创建缓存目录失败: {e}"))?;
    Ok(repo_base)
}

fn build_default_target_dir(
    app: &tauri::AppHandle,
    owner: &str,
    repo: &str,
) -> Result<PathBuf, String> {
    let base_dir = get_repo_cache_base_dir(app)?;
    let canonical = canonical_repo_url(owner, repo);
    let hash = stable_url_hash(&canonical);
    let short_hash = &hash[..10];
    let folder_name = format!(
        "{}_{}_{}",
        sanitize_path_component(owner),
        sanitize_path_component(repo),
        short_hash
    );
    Ok(base_dir.join(folder_name))
}

fn emit_progress(app: &tauri::AppHandle, stage: &str, message: &str, percent: Option<u8>) {
    let progress = CloneProgress {
        stage: stage.to_string(),
        message: message.to_string(),
        percent,
    };
    let _ = app.emit("clone-progress", progress);
}

fn parse_git_progress(line: &str) -> Option<u8> {
    if let Some(start) = line.find('%') {
        let before = &line[..start];
        let num_start = before
            .rfind(|c: char| !c.is_ascii_digit())
            .map_or(0, |i| i + 1);
        if let Ok(percent) = before[num_start..].parse::<u8>() {
            return Some(percent.min(100));
        }
    }
    None
}

fn run_git_in_repo(repo_path: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("执行 git {} 失败: {e}", args.join(" ")))?;

    if !output.status.success() {
        return Err(format!(
            "执行 git {} 失败: {}",
            args.join(" "),
            git_output_message(&output)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn run_git_in_repo_allow_failure(repo_path: &Path, args: &[&str]) -> Result<Output, String> {
    Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("执行 git {} 失败: {e}", args.join(" ")))
}

fn git_output_message(output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stderr.is_empty() {
        return stderr;
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stdout.is_empty() {
        return stdout;
    }

    "Unknown git error".to_string()
}

fn ensure_existing_repo_matches(
    target_path: &Path,
    expected_owner: &str,
    expected_repo: &str,
) -> Result<(), String> {
    let origin_url = run_git_in_repo(target_path, &["remote", "get-url", "origin"])?;
    let (existing_owner, existing_repo, _) = parse_github_url_internal(&origin_url)
        .ok_or_else(|| "缓存目录中的 origin 不是 GitHub 仓库".to_string())?;

    if existing_owner.eq_ignore_ascii_case(expected_owner)
        && existing_repo.eq_ignore_ascii_case(expected_repo)
    {
        return Ok(());
    }

    Err(format!(
        "缓存目录中的仓库为 {}/{}，与目标 {}/{} 不一致",
        existing_owner, existing_repo, expected_owner, expected_repo
    ))
}

fn sync_existing_repo(target_path: &Path, app: &tauri::AppHandle) -> Result<(), String> {
    emit_progress(app, "syncing", "检测到已克隆仓库，正在同步最新提交...", Some(15));

    let branch = run_git_in_repo(target_path, &["rev-parse", "--abbrev-ref", "HEAD"])?;

    let pull_output = if branch == "HEAD" || branch.is_empty() {
        run_git_in_repo_allow_failure(target_path, &["pull", "--rebase", "origin"])?
    } else {
        let attempt = run_git_in_repo_allow_failure(
            target_path,
            &["pull", "--rebase", "origin", branch.as_str()],
        )?;

        if attempt.status.success() {
            attempt
        } else {
            run_git_in_repo_allow_failure(target_path, &["pull", "--rebase"])?
        }
    };

    if !pull_output.status.success() {
        return Err(format!(
            "同步仓库失败: {}",
            git_output_message(&pull_output)
        ));
    }

    emit_progress(app, "syncing", "仓库同步完成", Some(100));
    Ok(())
}

fn persist_repo_path(app: &tauri::AppHandle, repo_path: &Path) -> Result<(), String> {
    let canonical_path = repo_path
        .canonicalize()
        .unwrap_or_else(|_| repo_path.to_path_buf());

    let store = app
        .store("lumina.json")
        .map_err(|e| format!("写入仓库配置失败: {e}"))?;

    store.set(
        REPO_PATH_STORAGE_KEY,
        json!(canonical_path.to_string_lossy().to_string()),
    );
    store
        .save()
        .map_err(|e| format!("保存仓库配置失败: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn parse_github_url(url: String) -> Result<GitHubRepoInfo, String> {
    let (owner, repo, normalized_url) =
        parse_github_url_internal(&url).ok_or("无效的 GitHub 仓库链接")?;

    Ok(GitHubRepoInfo {
        owner,
        repo,
        url: normalized_url,
    })
}

#[tauri::command]
pub fn get_default_clone_directory(
    owner: String,
    repo: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let repo_dir = build_default_target_dir(&app, &owner, &repo)?;
    Ok(repo_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn github_clone_repo(
    url: String,
    target_dir: Option<String>,
    app: tauri::AppHandle,
) -> Result<CloneResult, String> {
    let git_check = Command::new("git")
        .arg("--version")
        .output()
        .map_err(|_| "Git 未安装或不在 PATH 中，请先安装 Git")?;

    if !git_check.status.success() {
        return Err("Git 未安装或不在 PATH 中，请先安装 Git".to_string());
    }

    let (owner, repo, clone_url) =
        parse_github_url_internal(&url).ok_or("无效的 GitHub 仓库链接")?;

    emit_progress(&app, "preparing", "正在准备仓库连接...", None);

    let target_path = match target_dir {
        Some(dir) => PathBuf::from(dir),
        None => build_default_target_dir(&app, &owner, &repo)?,
    };

    if target_path.exists() {
        if target_path.join(".git").exists() {
            emit_progress(&app, "reusing", "发现本地缓存仓库，正在校验...", Some(5));
            ensure_existing_repo_matches(&target_path, &owner, &repo)?;
            sync_existing_repo(&target_path, &app)?;
            persist_repo_path(&app, &target_path)?;
            emit_progress(&app, "done", "仓库已连接并同步", Some(100));

            return Ok(CloneResult {
                success: true,
                repo_path: target_path.to_string_lossy().to_string(),
                message: Some("仓库已存在，已复用并同步到最新状态".to_string()),
            });
        }

        return Err(format!(
            "目标目录已存在但不是 Git 仓库: {}",
            target_path.display()
        ));
    }

    if let Some(parent) = target_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }

    emit_progress(
        &app,
        "cloning",
        &format!("正在克隆 {}/{}...", owner, repo),
        Some(0),
    );

    let mut child = Command::new("git")
        .args([
            "clone",
            "--progress",
            &clone_url,
            target_path.to_string_lossy().as_ref(),
        ])
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|e| format!("启动 git clone 失败: {e}"))?;

    let stderr = child.stderr.take().ok_or("无法获取 git 输出")?;
    let reader = BufReader::new(stderr);

    for line in reader.lines().map_while(Result::ok) {
        if let Some(percent) = parse_git_progress(&line) {
            emit_progress(&app, "cloning", &line, Some(percent));
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("等待 git 完成失败: {e}"))?;

    if !status.success() {
        emit_progress(&app, "error", "克隆失败", None);
        return Err("Git 克隆失败，请检查网络连接或仓库权限".to_string());
    }

    emit_progress(&app, "checking", "正在验证仓库...", Some(100));

    if !target_path.join(".git").exists() {
        emit_progress(&app, "error", "克隆完成但未找到 .git 目录", None);
        return Err("克隆完成但验证失败".to_string());
    }

    persist_repo_path(&app, &target_path)?;

    emit_progress(&app, "done", "仓库已连接", Some(100));

    Ok(CloneResult {
        success: true,
        repo_path: target_path.to_string_lossy().to_string(),
        message: Some(format!("成功连接 {}/{}", owner, repo)),
    })
}
