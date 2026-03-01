use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};

use tauri::Emitter;

use crate::github::{CloneProgress, CloneResult, GitHubRepoInfo};

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
pub fn get_default_clone_directory(owner: String, repo: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let base_dir = home.join("lumina-repos");
    let repo_dir = base_dir.join(format!("{}_{}", owner, repo));
    Ok(repo_dir.to_string_lossy().to_string())
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
        let num_start = before.rfind(|c: char| !c.is_ascii_digit()).map_or(0, |i| i + 1);
        if let Ok(percent) = before[num_start..].parse::<u8>() {
            return Some(percent.min(100));
        }
    }
    None
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

    emit_progress(&app, "preparing", "正在准备克隆...", None);

    let target_path = match target_dir {
        Some(dir) => PathBuf::from(dir),
        None => {
            let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
            let base_dir = home.join("lumina-repos");
            std::fs::create_dir_all(&base_dir)
                .map_err(|e| format!("创建目录失败: {}", e))?;
            base_dir.join(format!("{}_{}", owner, repo))
        }
    };

    if target_path.exists() {
        if target_path.join(".git").exists() {
            return Ok(CloneResult {
                success: true,
                repo_path: target_path.to_string_lossy().to_string(),
                message: Some("仓库已存在，直接使用".to_string()),
            });
        } else {
            return Err(format!(
                "目标目录已存在但不是 Git 仓库: {}",
                target_path.display()
            ));
        }
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
        .map_err(|e| format!("启动 git clone 失败: {}", e))?;

    let stderr = child.stderr.take().ok_or("无法获取 git 输出")?;
    let reader = BufReader::new(stderr);

    for line in reader.lines().map_while(Result::ok) {
        if let Some(percent) = parse_git_progress(&line) {
            emit_progress(&app, "cloning", &line, Some(percent));
        }
    }

    let status = child.wait().map_err(|e| format!("等待 git 完成失败: {}", e))?;

    if !status.success() {
        emit_progress(&app, "error", "克隆失败", None);
        return Err("Git 克隆失败，请检查网络连接或仓库权限".to_string());
    }

    emit_progress(&app, "checking", "正在验证仓库...", Some(100));

    if !target_path.join(".git").exists() {
        emit_progress(&app, "error", "克隆完成但未找到 .git 目录", None);
        return Err("克隆完成但验证失败".to_string());
    }

    emit_progress(&app, "done", "克隆完成", Some(100));

    Ok(CloneResult {
        success: true,
        repo_path: target_path.to_string_lossy().to_string(),
        message: Some(format!("成功克隆 {}/{}", owner, repo)),
    })
}
