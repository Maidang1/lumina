use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResult {
    pub success: bool,
    pub image_id: String,
    pub message: Option<String>,
    pub stored: UploadStoredPaths,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadStoredPaths {
    pub original_path: String,
    pub thumb_path: String,
    pub meta_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteResult {
    pub success: bool,
    pub image_id: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchFinalizeResult {
    pub success_count: usize,
    pub failed_items: Option<Vec<BatchFinalizeFailure>>,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchFinalizeFailure {
    pub image_id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageListResponse {
    pub images: Vec<serde_json::Value>,
    pub next_cursor: Option<String>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoStatus {
    pub configured: bool,
    pub repo_path: String,
    pub branch: String,
    pub origin_url: String,
    pub owner: String,
    pub repo: String,
    pub dirty_files: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileState {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub staged_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unstaged_status: Option<String>,
    pub untracked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitChangesSnapshot {
    pub files: Vec<GitFileState>,
}

// GitHub API 响应类型
#[derive(Debug, Deserialize)]
pub struct GitHubFileResponse {
    pub content: String,
    pub sha: String,
}

#[derive(Debug, Serialize)]
pub struct GitHubFileUpdate {
    pub message: String,
    pub content: String,
    pub branch: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GitHubCommitResponse {
    pub content: GitHubContent,
    pub commit: GitHubCommit,
}

#[derive(Debug, Deserialize)]
pub struct GitHubContent {
    pub sha: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct GitHubCommit {
    pub sha: String,
}

// Git API 类型
#[derive(Debug, Deserialize)]
pub struct GitRef {
    pub object: GitObject,
}

#[derive(Debug, Deserialize)]
pub struct GitObject {
    pub sha: String,
}

#[derive(Debug, Deserialize)]
pub struct GitCommit {
    pub tree: GitTree,
}

#[derive(Debug, Deserialize)]
pub struct GitTree {
    pub sha: String,
}

#[derive(Debug, Serialize)]
pub struct CreateTreeRequest {
    pub base_tree: String,
    pub tree: Vec<TreeEntry>,
}

#[derive(Debug, Serialize)]
pub struct TreeEntry {
    pub path: String,
    pub mode: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTreeResponse {
    pub sha: String,
}

#[derive(Debug, Serialize)]
pub struct CreateCommitRequest {
    pub message: String,
    pub tree: String,
    pub parents: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommitResponse {
    pub sha: String,
}

#[derive(Debug, Serialize)]
pub struct UpdateRefRequest {
    pub sha: String,
    pub force: bool,
}

// 索引文件类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageIndexFile {
    pub version: String,
    pub updated_at: String,
    pub items: Vec<ImageIndexItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageIndexItem {
    pub image_id: String,
    pub created_at: String,
    pub meta_path: String,
}

impl ImageIndexFile {
    pub fn new() -> Self {
        Self {
            version: "1".to_string(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            items: Vec::new(),
        }
    }

    pub fn add_item(&mut self, item: ImageIndexItem) {
        self.items.retain(|existing| existing.image_id != item.image_id);
        self.items.push(item);
        self.sort_items();
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }

    pub fn remove_item(&mut self, image_id: &str) -> bool {
        let original_len = self.items.len();
        self.items.retain(|item| item.image_id != image_id);
        let removed = self.items.len() < original_len;
        if removed {
            self.updated_at = chrono::Utc::now().to_rfc3339();
        }
        removed
    }

    pub fn sort_items(&mut self) {
        self.items.sort_by(|a, b| {
            b.created_at
                .cmp(&a.created_at)
                .then_with(|| b.image_id.cmp(&a.image_id))
        });
    }
}

impl Default for ImageIndexFile {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepoInfo {
    pub owner: String,
    pub repo: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneProgress {
    pub stage: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneResult {
    pub success: bool,
    pub repo_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}
