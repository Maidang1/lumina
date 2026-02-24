use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::{header, StatusCode};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use super::config::GitHubConfig;
use super::types::*;

const WRITE_INTERVAL_MS: u64 = 1100; // 1.1 秒
const MAX_RETRIES: u32 = 5;
const BASE_RETRY_DELAY_MS: u64 = 500;

pub struct GitHubClient {
    config: GitHubConfig,
    client: reqwest::Client,
    last_write_time: Arc<Mutex<Instant>>,
}

impl GitHubClient {
    pub fn new(config: GitHubConfig) -> Result<Self> {
        eprintln!("[GitHubClient] Initializing with owner={}, repo={}, branch={}",
            config.owner, config.repo, config.branch);

        config.validate()?;

        let mut headers = header::HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            header::HeaderValue::from_str(&format!("Bearer {}", config.token))
                .context("Invalid token format")?,
        );
        headers.insert(
            header::ACCEPT,
            header::HeaderValue::from_static("application/vnd.github+json"),
        );
        headers.insert(
            "X-GitHub-Api-Version",
            header::HeaderValue::from_static("2022-11-28"),
        );
        headers.insert(
            header::USER_AGENT,
            header::HeaderValue::from_static("Lumina-Desktop/0.1.0"),
        );

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;

        eprintln!("[GitHubClient] Client initialized successfully");

        Ok(Self {
            config,
            client,
            last_write_time: Arc::new(Mutex::new(Instant::now() - Duration::from_secs(2))),
        })
    }

    /// 等待写入槽位（速率限制）
    async fn wait_for_write_slot(&self) {
        let mut last_write = self.last_write_time.lock().await;
        let elapsed = last_write.elapsed();
        let required_interval = Duration::from_millis(WRITE_INTERVAL_MS);

        if elapsed < required_interval {
            let wait_time = required_interval - elapsed;
            tokio::time::sleep(wait_time).await;
        }

        *last_write = Instant::now();
    }

    /// 带重试的请求执行
    async fn fetch_with_retry<F, Fut, T>(&self, operation: F) -> Result<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<reqwest::Response>>,
        T: serde::de::DeserializeOwned,
    {
        let mut attempt = 0;

        loop {
            attempt += 1;
            eprintln!("[GitHubClient] fetch_with_retry: attempt {}/{}", attempt, MAX_RETRIES);

            match operation().await {
                Ok(response) => {
                    let status = response.status();
                    eprintln!("[GitHubClient] Response status: {}", status);

                    // 检查速率限制
                    if let Some(remaining) = response.headers().get("x-ratelimit-remaining") {
                        if let Ok(remaining_str) = remaining.to_str() {
                            if let Ok(remaining_count) = remaining_str.parse::<u32>() {
                                eprintln!("[GitHubClient] Rate limit remaining: {}", remaining_count);
                                if remaining_count < 10 {
                                    eprintln!(
                                        "Warning: GitHub API rate limit low: {} remaining",
                                        remaining_count
                                    );
                                }
                            }
                        }
                    }

                    // 成功响应
                    if status.is_success() {
                        eprintln!("[GitHubClient] Request successful, parsing JSON...");
                        return response
                            .json::<T>()
                            .await
                            .context("Failed to parse response");
                    }

                    // 可重试的错误
                    let should_retry = matches!(
                        status,
                        StatusCode::TOO_MANY_REQUESTS
                            | StatusCode::INTERNAL_SERVER_ERROR
                            | StatusCode::BAD_GATEWAY
                            | StatusCode::SERVICE_UNAVAILABLE
                            | StatusCode::GATEWAY_TIMEOUT
                    );

                    // 获取错误响应体
                    let error_body = response.text().await.unwrap_or_default();
                    eprintln!("[GitHubClient] Error response body: {}", error_body);

                    if should_retry && attempt < MAX_RETRIES {
                        let jitter = (attempt as u64 * 37) % 100; // 简单的伪随机抖动
                        let delay = BASE_RETRY_DELAY_MS * 2u64.pow(attempt - 1) + jitter;
                        eprintln!(
                            "[GitHubClient] Request failed with status {}, retrying in {}ms (attempt {}/{})",
                            status, delay, attempt, MAX_RETRIES
                        );
                        tokio::time::sleep(Duration::from_millis(delay)).await;
                        continue;
                    }

                    // 不可重试或超过最大重试次数
                    eprintln!("[GitHubClient] Request failed permanently: status={}, body={}", status, error_body);
                    anyhow::bail!("GitHub API error {}: {}", status, error_body);
                }
                Err(e) => {
                    eprintln!("[GitHubClient] Request error: {:?}", e);
                    if attempt < MAX_RETRIES {
                        let jitter = (attempt as u64 * 37) % 100;
                        let delay = BASE_RETRY_DELAY_MS * 2u64.pow(attempt - 1) + jitter;
                        eprintln!(
                            "[GitHubClient] Request failed: {}, retrying in {}ms (attempt {}/{})",
                            e, delay, attempt, MAX_RETRIES
                        );
                        tokio::time::sleep(Duration::from_millis(delay)).await;
                        continue;
                    }
                    eprintln!("[GitHubClient] Request failed permanently after {} attempts", MAX_RETRIES);
                    return Err(e.into());
                }
            }
        }
    }

    /// 获取文件内容
    pub async fn get_file(&self, path: &str) -> Result<Option<GitHubFileResponse>> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}?ref={}",
            self.config.owner, self.config.repo, path, self.config.branch
        );

        let response = self.client.get(&url).send().await?;

        if response.status() == StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !response.status().is_success() {
            let error_body = response.text().await.unwrap_or_default();
            anyhow::bail!("Failed to get file: {}", error_body);
        }

        let file_response: GitHubFileResponse = response.json().await?;
        Ok(Some(file_response))
    }

    /// 上传或更新文件
    pub async fn put_file(
        &self,
        path: &str,
        content: &[u8],
        message: &str,
        sha: Option<String>,
    ) -> Result<GitHubCommitResponse> {
        eprintln!("[GitHubClient] put_file: path={}, size={} bytes, has_sha={}",
            path, content.len(), sha.is_some());

        self.wait_for_write_slot().await;

        let url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            self.config.owner, self.config.repo, path
        );

        let encoded_content = BASE64.encode(content);

        let body = GitHubFileUpdate {
            message: message.to_string(),
            content: encoded_content,
            branch: self.config.branch.clone(),
            sha,
        };

        eprintln!("[GitHubClient] Sending PUT request to: {}", url);

        let result = self.fetch_with_retry(|| async {
            self.client
                .put(&url)
                .json(&body)
                .send()
                .await
                .context("Failed to send PUT request")
        })
        .await;

        match &result {
            Ok(_) => eprintln!("[GitHubClient] put_file successful: {}", path),
            Err(e) => eprintln!("[GitHubClient] put_file failed: {}, error: {:?}", path, e),
        }

        result
    }

    /// 删除文件
    pub async fn delete_file(&self, path: &str, sha: &str, message: &str) -> Result<()> {
        self.wait_for_write_slot().await;

        let url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            self.config.owner, self.config.repo, path
        );

        let body = serde_json::json!({
            "message": message,
            "sha": sha,
            "branch": self.config.branch,
        });

        self.fetch_with_retry(|| async {
            self.client
                .delete(&url)
                .json(&body)
                .send()
                .await
                .context("Failed to send DELETE request")
        })
        .await?;

        Ok(())
    }

    /// 获取图片索引
    pub async fn get_image_index(&self) -> Result<ImageIndexFile> {
        eprintln!("[GitHubClient] Getting image index...");

        match self.get_file("objects/_index/images.json").await? {
            Some(file) => {
                eprintln!("[GitHubClient] Index file found, decoding...");
                let decoded = BASE64
                    .decode(&file.content.replace('\n', ""))
                    .context("Failed to decode index file")?;
                let index: ImageIndexFile =
                    serde_json::from_slice(&decoded).context("Failed to parse index file")?;
                eprintln!("[GitHubClient] Index loaded with {} items", index.items.len());
                Ok(index)
            }
            None => {
                eprintln!("[GitHubClient] Index file not found, creating new index");
                Ok(ImageIndexFile::new())
            }
        }
    }

    /// 更新图片索引
    pub async fn update_image_index(&self, mut index: ImageIndexFile) -> Result<()> {
        index.sort_items();
        index.updated_at = chrono::Utc::now().to_rfc3339();

        let content = serde_json::to_vec_pretty(&index).context("Failed to serialize index")?;

        let existing = self.get_file("objects/_index/images.json").await?;
        let sha = existing.map(|f| f.sha);

        self.put_file(
            "objects/_index/images.json",
            &content,
            "Update image index",
            sha,
        )
        .await?;

        Ok(())
    }

    /// 从索引中移除图片
    pub async fn remove_from_index(&self, image_id: &str) -> Result<bool> {
        let mut index = self.get_image_index().await?;
        let removed = index.remove_item(image_id);

        if removed {
            self.update_image_index(index).await?;
        }

        Ok(removed)
    }

    /// 批量提交文件（使用 Git API）
    pub async fn commit_files_batch(
        &self,
        files: Vec<(String, Vec<u8>)>,
        message: &str,
    ) -> Result<String> {
        const MAX_BATCH_RETRIES: u32 = 3;
        let mut attempt = 0;

        loop {
            attempt += 1;

            match self.try_commit_files_batch(&files, message).await {
                Ok(commit_sha) => return Ok(commit_sha),
                Err(e) => {
                    let error_str = e.to_string();
                    let is_conflict = error_str.contains("409") || error_str.contains("422");

                    if is_conflict && attempt < MAX_BATCH_RETRIES {
                        let delay = 600 * attempt as u64;
                        eprintln!(
                            "Batch commit conflict, retrying in {}ms (attempt {}/{})",
                            delay, attempt, MAX_BATCH_RETRIES
                        );
                        tokio::time::sleep(Duration::from_millis(delay)).await;
                        continue;
                    }

                    return Err(e);
                }
            }
        }
    }

    async fn try_commit_files_batch(
        &self,
        files: &[(String, Vec<u8>)],
        message: &str,
    ) -> Result<String> {
        let ref_url = format!(
            "https://api.github.com/repos/{}/{}/git/ref/heads/{}",
            self.config.owner, self.config.repo, self.config.branch
        );
        let ref_url_clone = ref_url.clone();

        let git_ref_result = self
            .fetch_with_retry(move || {
                let url = ref_url_clone.clone();
                async move {
                    self.client
                        .get(&url)
                        .send()
                        .await
                        .context("Failed to get ref")
                }
            })
            .await;

        let git_ref: GitRef = match git_ref_result {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[GitHubClient] Failed to get ref for {}: {}", self.config.branch, e);
                
                // Only try fallback for main/master
                if self.config.branch != "main" && self.config.branch != "master" {
                    return Err(e);
                }
                
                // If branch is main/master and fails, try the other one
                let alt_branch = if self.config.branch == "main" { "master" } else { "main" };
                eprintln!("[GitHubClient] Trying fallback branch: {}", alt_branch);
                
                let alt_ref_url = format!(
                    "https://api.github.com/repos/{}/{}/git/ref/heads/{}",
                    self.config.owner, self.config.repo, alt_branch
                );
                let alt_url_clone = alt_ref_url.clone();
                
                self.fetch_with_retry(move || {
                    let url = alt_url_clone.clone();
                    async move {
                        self.client
                            .get(&url)
                            .send()
                            .await
                            .context("Failed to get ref")
                    }
                })
                .await
                .context(format!("Failed to get ref from {} or {}", ref_url, alt_ref_url))?
            }
        };

        let head_sha = git_ref.object.sha;

        // 2. 获取 HEAD commit 的 tree
        let commit_url = format!(
            "https://api.github.com/repos/{}/{}/git/commits/{}",
            self.config.owner, self.config.repo, head_sha
        );

        let commit: GitCommit = self
            .fetch_with_retry(|| async {
                self.client
                    .get(&commit_url)
                    .send()
                    .await
                    .context("Failed to get commit")
            })
            .await?;

        let base_tree_sha = commit.tree.sha;

        // 3. 为每个文件创建 blob
        let mut tree_entries = Vec::new();

        for (path, content) in files {
            let blob_url = format!(
                "https://api.github.com/repos/{}/{}/git/blobs",
                self.config.owner, self.config.repo
            );

            let blob_request = CreateBlobRequest {
                content: BASE64.encode(content),
                encoding: "base64".to_string(),
            };

            let blob_response: CreateBlobResponse = self
                .fetch_with_retry(|| async {
                    self.client
                        .post(&blob_url)
                        .json(&blob_request)
                        .send()
                        .await
                        .context("Failed to create blob")
                })
                .await?;

            tree_entries.push(TreeEntry {
                path: path.clone(),
                mode: "100644".to_string(),
                r#type: "blob".to_string(),
                sha: blob_response.sha,
            });
        }

        // 4. 创建新 tree
        let tree_url = format!(
            "https://api.github.com/repos/{}/{}/git/trees",
            self.config.owner, self.config.repo
        );

        let tree_request = CreateTreeRequest {
            base_tree: base_tree_sha,
            tree: tree_entries,
        };

        let tree_response: CreateTreeResponse = self
            .fetch_with_retry(|| async {
                self.client
                    .post(&tree_url)
                    .json(&tree_request)
                    .send()
                    .await
                    .context("Failed to create tree")
            })
            .await?;

        // 5. 创建新 commit
        let commit_create_url = format!(
            "https://api.github.com/repos/{}/{}/git/commits",
            self.config.owner, self.config.repo
        );

        let commit_request = CreateCommitRequest {
            message: message.to_string(),
            tree: tree_response.sha,
            parents: vec![head_sha.clone()],
        };

        let commit_response: CreateCommitResponse = self
            .fetch_with_retry(|| async {
                self.client
                    .post(&commit_create_url)
                    .json(&commit_request)
                    .send()
                    .await
                    .context("Failed to create commit")
            })
            .await?;

        // 6. 更新分支引用
        let update_ref_request = UpdateRefRequest {
            sha: commit_response.sha.clone(),
            force: false,
        };

        // We use serde_json::Value as we don't strictly need the response body here, just success/failure
        // Use a reference in the closure to avoid moving update_ref_request
        let update_ref_request_clone = UpdateRefRequest { sha: update_ref_request.sha.clone(), force: update_ref_request.force };
        let ref_url_clone = ref_url.clone();
        let result: Result<serde_json::Value> = self.fetch_with_retry(move || {
            let req = UpdateRefRequest { sha: update_ref_request_clone.sha.clone(), force: update_ref_request_clone.force };
            let url = ref_url_clone.clone();
            async move {
                self.client
                    .patch(&url)
                    .json(&req)
                    .send()
                    .await
                    .context("Failed to update ref")
            }
        })
        .await;

        if let Err(e) = &result { // Use reference to result
            // Check if error is 404 (ref not found)
            let error_str = e.to_string();
            if error_str.contains("404") || error_str.contains("Not Found") {
                 eprintln!("[GitHubClient] Ref not found, creating new ref: {}", self.config.branch);
                 // If PATCH failed with 404, it means the ref doesn't exist.
                 // We should try to create it using POST /git/refs
                 let create_ref_url = format!(
                     "https://api.github.com/repos/{}/{}/git/refs",
                     self.config.owner, self.config.repo
                 );
                 
                 let create_ref_body = serde_json::json!({
                     "ref": format!("refs/heads/{}", self.config.branch),
                     "sha": commit_response.sha
                 });
                 let create_ref_url_clone = create_ref_url.clone();
                 let create_ref_body_clone = create_ref_body.clone();
                 
                 self.fetch_with_retry::<_, _, serde_json::Value>(move || {
                     let url = create_ref_url_clone.clone();
                     let body = create_ref_body_clone.clone();
                     async move {
                         self.client
                             .post(&url)
                             .json(&body)
                             .send()
                             .await
                             .context("Failed to create ref")
                     }
                 })
                 .await
                 .or_else(|e| {
                     let error_str = e.to_string();
                     if error_str.contains("422") || error_str.contains("Reference already exists") {
                         eprintln!("[GitHubClient] Ref already exists (race condition), retrying update...");
                         Ok(serde_json::Value::Null) // Treat as success to trigger retry of update or just ignore if we want to rely on next update
                     } else {
                         Err(e)
                     }
                 })
                 .context("Failed to create new ref")?;

                 // If we are here, we either created the ref OR it already existed (race condition).
                 // If it already existed, we still need to update it to point to our new commit.
                 // The easiest way is to try PATCH again.
                 if result.is_err() { // Only retry PATCH if the first PATCH failed
                     eprintln!("[GitHubClient] Retrying ref update after creation/race check...");
                     
                     let update_ref_request_retry = UpdateRefRequest { sha: update_ref_request.sha.clone(), force: update_ref_request.force };
                     let ref_url_retry = ref_url.clone();
                     
                     self.fetch_with_retry::<_, _, serde_json::Value>(move || {
                        let req = UpdateRefRequest { sha: update_ref_request_retry.sha.clone(), force: update_ref_request_retry.force };
                        let url = ref_url_retry.clone();
                        async move {
                            self.client
                                .patch(&url)
                                .json(&req)
                                .send()
                                .await
                                .context("Failed to update ref")
                        }
                    })
                    .await?;
                 }
            } else {
                // We need to return the error, but we only have a reference.
                // Since anyhow::Error doesn't implement Clone, we need to create a new error
                // or structure the code to avoid needing the reference here if possible.
                // However, since we are returning early, we can just map it to a new error with the same message.
                return Err(anyhow::anyhow!("{}", e));
            }
        }

        Ok(commit_response.sha)
    }
}
