use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubConfig {
    pub repo_path: PathBuf,
}

impl GitHubConfig {
    pub fn from_store(app: &tauri::AppHandle) -> Result<Self> {
        let store = app
            .store("lumina.json")
            .context("Failed to get store")?;

        let repo_path = store
            .get("lumina.git_repo_path")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .context("Git repository path not configured")?;

        let config = Self {
            repo_path: PathBuf::from(repo_path),
        };
        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<()> {
        if !self.repo_path.exists() {
            anyhow::bail!("Repository path does not exist");
        }
        if !self.repo_path.join(".git").exists() {
            anyhow::bail!("Selected directory is not a git repository");
        }
        Ok(())
    }
}
