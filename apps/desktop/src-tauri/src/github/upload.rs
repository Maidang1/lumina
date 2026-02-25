use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Semaphore;

use super::config::GitHubConfig;
use super::types::*;

struct PreparedMetadata {
    raw: String,
    image_id: String,
    created_at: String,
    meta_path: String,
}

pub struct UploadManager {
    config: Arc<GitHubConfig>,
    semaphore: Arc<Semaphore>,
}

impl UploadManager {
    pub fn new(config: GitHubConfig, concurrency: usize) -> Self {
        Self {
            config: Arc::new(config),
            semaphore: Arc::new(Semaphore::new(concurrency.max(1))),
        }
    }

    pub async fn upload_image_concurrent(
        &self,
        image_id: String,
        original: Vec<u8>,
        original_mime: String,
        thumb: Vec<u8>,
        thumb_variants: HashMap<String, Vec<u8>>,
        metadata: String,
        defer_finalize: bool,
    ) -> Result<UploadResult> {
        let _permit = self
            .semaphore
            .acquire()
            .await
            .context("Failed to acquire semaphore")?;

        self.upload_image_internal(
            image_id,
            original,
            original_mime,
            thumb,
            thumb_variants,
            metadata,
            defer_finalize,
        )
        .await
    }

    async fn upload_image_internal(
        &self,
        image_id: String,
        original: Vec<u8>,
        original_mime: String,
        thumb: Vec<u8>,
        thumb_variants: HashMap<String, Vec<u8>>,
        metadata: String,
        defer_finalize: bool,
    ) -> Result<UploadResult> {
        let prepared = Self::prepare_metadata(&metadata)?;
        if prepared.image_id != image_id {
            anyhow::bail!("metadata.image_id does not match upload image_id");
        }

        let base_path = Self::image_base_path(&image_id)?;
        let original_ext = Self::guess_extension(&original_mime);

        let original_path = format!("{}/original.{}", base_path, original_ext);
        let thumb_path = format!("{}/thumb.webp", base_path);

        self.write_repo_file(&original_path, &original)?;
        self.write_repo_file(&thumb_path, &thumb)?;

        for (variant_name, variant_data) in thumb_variants {
            let Some(size) = Self::normalize_variant_name(&variant_name) else {
                continue;
            };
            let variant_path = format!("{}/thumb-{}.webp", base_path, size);
            self.write_repo_file(&variant_path, &variant_data)?;
        }

        if !defer_finalize {
            self.upsert_metadata_with_index(&prepared)?;
        }

        Ok(UploadResult {
            success: true,
            image_id,
            message: Some("Upload completed successfully".to_string()),
            stored: UploadStoredPaths {
                original_path,
                thumb_path,
                meta_path: prepared.meta_path,
            },
        })
    }

    pub async fn finalize_batch(&self, metadatas: Vec<String>) -> Result<BatchFinalizeResult> {
        if metadatas.is_empty() {
            return Ok(BatchFinalizeResult {
                success_count: 0,
                failed_items: None,
                mode: "batch_commit".to_string(),
            });
        }

        let mut failed_items = Vec::new();
        let mut success_count = 0usize;

        for raw in metadatas {
            match Self::prepare_metadata(&raw)
                .and_then(|prepared| self.upsert_metadata_with_index(&prepared).map(|_| prepared))
            {
                Ok(_) => success_count += 1,
                Err(err) => {
                    let image_id = serde_json::from_str::<serde_json::Value>(&raw)
                        .ok()
                        .and_then(|v| v.get("image_id").and_then(|v| v.as_str()).map(str::to_string))
                        .unwrap_or_else(|| "unknown".to_string());
                    failed_items.push(BatchFinalizeFailure {
                        image_id,
                        reason: err.to_string(),
                    });
                }
            }
        }

        Ok(BatchFinalizeResult {
            success_count,
            failed_items: if failed_items.is_empty() {
                None
            } else {
                Some(failed_items)
            },
            mode: "fallback_per_item".to_string(),
        })
    }

    pub async fn delete_image(&self, image_id: String) -> Result<DeleteResult> {
        let base_path = Self::image_base_path(&image_id)?;
        let mut paths_to_delete = vec![
            format!("{}/meta.json", base_path),
            format!("{}/thumb.webp", base_path),
            format!("{}/thumb-400.webp", base_path),
            format!("{}/thumb-800.webp", base_path),
            format!("{}/thumb-1600.webp", base_path),
            format!("{}/thumb_400.webp", base_path),
            format!("{}/thumb_800.webp", base_path),
            format!("{}/thumb_1600.webp", base_path),
            format!("{}/thumb_sm.webp", base_path),
            format!("{}/thumb_md.webp", base_path),
            format!("{}/thumb_lg.webp", base_path),
            format!("{}/original.jpg", base_path),
            format!("{}/original.png", base_path),
            format!("{}/original.webp", base_path),
            format!("{}/original.heic", base_path),
            format!("{}/original.heif", base_path),
            format!("{}/original.avif", base_path),
            format!("{}/original.mp4", base_path),
            format!("{}/original.mov", base_path),
            format!("{}/original.bin", base_path),
        ];

        paths_to_delete.sort();
        paths_to_delete.dedup();

        for path in paths_to_delete {
            let abs = self.repo_path_for(&path);
            if abs.exists() {
                let _ = fs::remove_file(abs);
            }
        }

        self.remove_from_index(&image_id)?;

        Ok(DeleteResult {
            success: true,
            image_id,
            message: Some("Image deleted successfully".to_string()),
        })
    }

    pub async fn list_images(
        &self,
        cursor: Option<String>,
        limit: usize,
    ) -> Result<ImageListResponse> {
        let index = self.get_image_index()?;

        let start_idx = cursor
            .as_deref()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(0)
            .min(index.items.len());
        let safe_limit = limit.max(1);
        let end_idx = (start_idx + safe_limit).min(index.items.len());

        let mut images = Vec::new();
        for entry in &index.items[start_idx..end_idx] {
            let path = self.repo_path_for(&entry.meta_path);
            if !path.exists() {
                continue;
            }
            let raw = match fs::read(path) {
                Ok(v) => v,
                Err(_) => continue,
            };
            match serde_json::from_slice::<serde_json::Value>(&raw) {
                Ok(meta) => images.push(meta),
                Err(_) => continue,
            }
        }

        let next_cursor = if end_idx < index.items.len() {
            Some(end_idx.to_string())
        } else {
            None
        };

        Ok(ImageListResponse {
            images,
            next_cursor,
            total: index.items.len(),
        })
    }

    pub async fn update_image_metadata(
        &self,
        image_id: String,
        updates: serde_json::Value,
    ) -> Result<serde_json::Value> {
        let base_path = Self::image_base_path(&image_id)?;
        let meta_path = format!("{}/meta.json", base_path);
        let abs_path = self.repo_path_for(&meta_path);

        let raw = fs::read(&abs_path).with_context(|| format!("Metadata not found: {}", meta_path))?;
        let mut metadata: serde_json::Value =
            serde_json::from_slice(&raw).context("Failed to parse metadata")?;

        let allowed = [
            "description",
            "original_filename",
            "category",
            "privacy",
            "geo",
            "processing",
        ];

        for key in allowed {
            if let Some(value) = updates.get(key) {
                metadata[key] = value.clone();
            }
        }

        let content = serde_json::to_vec_pretty(&metadata).context("Failed to serialize metadata")?;
        self.write_repo_file(&meta_path, &content)?;

        Ok(metadata)
    }

    fn upsert_metadata_with_index(&self, item: &PreparedMetadata) -> Result<()> {
        self.write_repo_file(&item.meta_path, item.raw.as_bytes())?;

        let mut index = self.get_image_index()?;
        index.add_item(ImageIndexItem {
            image_id: item.image_id.clone(),
            created_at: item.created_at.clone(),
            meta_path: item.meta_path.clone(),
        });
        self.update_image_index(index)?;

        Ok(())
    }

    fn get_image_index(&self) -> Result<ImageIndexFile> {
        let path = self.repo_path_for("objects/_index/images.json");
        if !path.exists() {
            return Ok(ImageIndexFile::new());
        }
        let content = fs::read(path).context("Failed to read image index")?;
        let index = serde_json::from_slice::<ImageIndexFile>(&content)
            .context("Failed to parse image index")?;
        Ok(index)
    }

    fn update_image_index(&self, mut index: ImageIndexFile) -> Result<()> {
        index.sort_items();
        index.updated_at = chrono::Utc::now().to_rfc3339();
        let content = serde_json::to_vec_pretty(&index).context("Failed to serialize index")?;
        self.write_repo_file("objects/_index/images.json", &content)
    }

    fn remove_from_index(&self, image_id: &str) -> Result<bool> {
        let mut index = self.get_image_index()?;
        let removed = index.remove_item(image_id);
        if removed {
            self.update_image_index(index)?;
        }
        Ok(removed)
    }

    fn write_repo_file(&self, relative_path: &str, content: &[u8]) -> Result<()> {
        let abs = self.repo_path_for(relative_path);
        let parent = abs
            .parent()
            .context("Invalid output path")?;
        fs::create_dir_all(parent).context("Failed to create parent directories")?;
        fs::write(abs, content).context("Failed to write file")?;
        Ok(())
    }

    fn repo_path_for(&self, relative_path: &str) -> PathBuf {
        let normalized = relative_path.trim_start_matches('/');
        self.config.repo_path.join(Path::new(normalized))
    }

    fn prepare_metadata(raw: &str) -> Result<PreparedMetadata> {
        let value: serde_json::Value =
            serde_json::from_str(raw).context("Failed to parse metadata")?;
        let image_id = value["image_id"]
            .as_str()
            .context("Missing image_id in metadata")?
            .to_string();
        let created_at = value["timestamps"]["created_at"]
            .as_str()
            .map(|value| value.to_string())
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
        let meta_path = format!("{}/meta.json", Self::image_base_path(&image_id)?);

        Ok(PreparedMetadata {
            raw: raw.to_string(),
            image_id,
            created_at,
            meta_path,
        })
    }

    fn image_base_path(image_id: &str) -> Result<String> {
        let hash = image_id.strip_prefix("sha256:").unwrap_or(image_id);
        if hash.len() < 4 {
            anyhow::bail!("Invalid image_id format");
        }

        Ok(format!(
            "objects/{}/{}/sha256_{}",
            &hash[0..2],
            &hash[2..4],
            hash
        ))
    }

    fn guess_extension(mime: &str) -> &'static str {
        match mime {
            "image/jpeg" => "jpg",
            "image/png" => "png",
            "image/webp" => "webp",
            "image/gif" => "gif",
            "image/heic" => "heic",
            "image/heif" => "heif",
            "image/avif" => "avif",
            "video/quicktime" => "mov",
            "video/mp4" => "mp4",
            _ => "bin",
        }
    }

    fn normalize_variant_name(name: &str) -> Option<&'static str> {
        match name {
            "400" | "sm" => Some("400"),
            "800" | "md" => Some("800"),
            "1600" | "lg" => Some("1600"),
            _ => None,
        }
    }
}
