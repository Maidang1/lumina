use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubConfig {
    pub token: String,
    pub owner: String,
    pub repo: String,
    pub branch: String,
}

impl GitHubConfig {
    pub fn from_store(app: &tauri::AppHandle) -> Result<Self> {
        eprintln!("[GitHubConfig] Loading config from store...");

        let store = app
            .store("lumina.json")
            .context("Failed to get store")?;

        eprintln!("[GitHubConfig] Store loaded successfully");

        // 尝试读取 token
        let token_value = store.get("lumina.github_token");
        eprintln!("[GitHubConfig] Token value from store: {:?}", token_value);

        let token = token_value
            .and_then(|v| {
                eprintln!("[GitHubConfig] Token value type: {:?}", v);
                v.as_str().map(|s| {
                    eprintln!("[GitHubConfig] Token string: {} (length: {})",
                        if s.len() > 10 { &s[..10] } else { s }, s.len());
                    s.to_string()
                })
            })
            .context("GitHub token not configured")?;

        eprintln!("[GitHubConfig] Token loaded successfully");

        let owner = store
            .get("lumina.github_owner")
            .and_then(|v| {
                eprintln!("[GitHubConfig] Owner: {:?}", v);
                v.as_str().map(|s| s.to_string())
            })
            .context("GitHub owner not configured")?;

        eprintln!("[GitHubConfig] Owner loaded: {}", owner);

        let repo = store
            .get("lumina.github_repo")
            .and_then(|v| {
                eprintln!("[GitHubConfig] Repo: {:?}", v);
                v.as_str().map(|s| s.to_string())
            })
            .context("GitHub repo not configured")?;

        eprintln!("[GitHubConfig] Repo loaded: {}", repo);

        let branch = store
            .get("lumina.github_branch")
            .and_then(|v| {
                eprintln!("[GitHubConfig] Branch: {:?}", v);
                v.as_str().map(|s| s.to_string())
            })
            .unwrap_or_else(|| {
                eprintln!("[GitHubConfig] Branch not found, using default: main");
                "main".to_string()
            });

        eprintln!("[GitHubConfig] Branch loaded: {}", branch);
        eprintln!("[GitHubConfig] All config loaded successfully");

        Ok(Self {
            token,
            owner,
            repo,
            branch,
        })
    }

    pub fn validate(&self) -> Result<()> {
        if self.token.is_empty() {
            anyhow::bail!("GitHub token is empty");
        }
        if self.owner.is_empty() {
            anyhow::bail!("GitHub owner is empty");
        }
        if self.repo.is_empty() {
            anyhow::bail!("GitHub repo is empty");
        }
        if self.branch.is_empty() {
            anyhow::bail!("GitHub branch is empty");
        }
        Ok(())
    }
}
