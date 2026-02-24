use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Semaphore;

use super::client::GitHubClient;
use super::types::*;

struct PreparedMetadata {
    raw: String,
    image_id: String,
    created_at: String,
    meta_path: String,
}

pub struct UploadManager {
    github: Arc<GitHubClient>,
    semaphore: Arc<Semaphore>,
}

impl UploadManager {
    pub fn new(github: GitHubClient, concurrency: usize) -> Self {
        Self {
            github: Arc::new(github),
            semaphore: Arc::new(Semaphore::new(concurrency)),
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

        let original_sha = self
            .github
            .get_file(&original_path)
            .await?
            .map(|file| file.sha);
        self.github
            .put_file(
                &original_path,
                &original,
                &format!("Upload {} - original", image_id),
                original_sha,
            )
            .await
            .context("Failed to upload original image")?;

        let thumb_sha = self
            .github
            .get_file(&thumb_path)
            .await?
            .map(|file| file.sha);
        self.github
            .put_file(
                &thumb_path,
                &thumb,
                &format!("Upload {} - thumb", image_id),
                thumb_sha,
            )
            .await
            .context("Failed to upload thumbnail")?;

        for (variant_name, variant_data) in thumb_variants {
            let Some(size) = Self::normalize_variant_name(&variant_name) else {
                continue;
            };
            let variant_path = format!("{}/thumb-{}.webp", base_path, size);
            let variant_sha = self
                .github
                .get_file(&variant_path)
                .await?
                .map(|file| file.sha);
            self.github
                .put_file(
                    &variant_path,
                    &variant_data,
                    &format!("Upload {} - thumb {}", image_id, size),
                    variant_sha,
                )
                .await
                .with_context(|| format!("Failed to upload thumbnail variant {}", size))?;
        }

        if !defer_finalize {
            self.upsert_metadata_with_index(&prepared).await?;
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

        let prepared = metadatas
            .iter()
            .map(|raw| Self::prepare_metadata(raw))
            .collect::<Result<Vec<_>>>()?;

        let mut files: Vec<(String, Vec<u8>)> = prepared
            .iter()
            .map(|item| (item.meta_path.clone(), item.raw.as_bytes().to_vec()))
            .collect();

        let mut index = self.github.get_image_index().await?;
        for item in &prepared {
            index.add_item(ImageIndexItem {
                image_id: item.image_id.clone(),
                created_at: item.created_at.clone(),
                meta_path: item.meta_path.clone(),
            });
        }
        files.push((
            "objects/_index/images.json".to_string(),
            serde_json::to_vec_pretty(&index).context("Failed to serialize index")?,
        ));

        match self
            .github
            .commit_files_batch(
                files,
                &format!("Finalize {} image metadata entries", prepared.len()),
            )
            .await
        {
            Ok(_) => Ok(BatchFinalizeResult {
                success_count: prepared.len(),
                failed_items: None,
                mode: "batch_commit".to_string(),
            }),
            Err(error) => {
                eprintln!(
                    "[UploadManager] Batch finalize failed, falling back to per item: {}",
                    error
                );

                let mut failed_items = Vec::new();
                let mut success_count = 0usize;

                for item in &prepared {
                    match self.upsert_metadata_with_index(item).await {
                        Ok(_) => success_count += 1,
                        Err(err) => failed_items.push(BatchFinalizeFailure {
                            image_id: item.image_id.clone(),
                            reason: err.to_string(),
                        }),
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
        }
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
        ];

        paths_to_delete.sort();
        paths_to_delete.dedup();

        for path in paths_to_delete {
            if let Some(file) = self.github.get_file(&path).await? {
                let _ = self
                    .github
                    .delete_file(&path, &file.sha, &format!("Delete {}", path))
                    .await;
            }
        }

        self.github.remove_from_index(&image_id).await?;

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
        let index = self.github.get_image_index().await?;

        let start_idx = cursor
            .as_deref()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(0)
            .min(index.items.len());
        let safe_limit = limit.max(1);
        let end_idx = (start_idx + safe_limit).min(index.items.len());

        let mut images = Vec::new();
        for entry in &index.items[start_idx..end_idx] {
            let Some(file) = self.github.get_file(&entry.meta_path).await? else {
                continue;
            };

            let decoded = match BASE64.decode(file.content.replace('\n', "")) {
                Ok(value) => value,
                Err(error) => {
                    eprintln!(
                        "[UploadManager] Failed to decode {}: {}",
                        entry.meta_path, error
                    );
                    continue;
                }
            };

            match serde_json::from_slice::<serde_json::Value>(&decoded) {
                Ok(meta) => images.push(meta),
                Err(error) => {
                    eprintln!(
                        "[UploadManager] Failed to parse {}: {}",
                        entry.meta_path, error
                    );
                }
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

    async fn upsert_metadata_with_index(&self, item: &PreparedMetadata) -> Result<()> {
        let meta_sha = self
            .github
            .get_file(&item.meta_path)
            .await?
            .map(|file| file.sha);

        self.github
            .put_file(
                &item.meta_path,
                item.raw.as_bytes(),
                &format!("Upload metadata {}", item.image_id),
                meta_sha,
            )
            .await
            .with_context(|| format!("Failed to upload metadata {}", item.image_id))?;

        let mut index = self.github.get_image_index().await?;
        index.add_item(ImageIndexItem {
            image_id: item.image_id.clone(),
            created_at: item.created_at.clone(),
            meta_path: item.meta_path.clone(),
        });
        self.github.update_image_index(index).await?;

        Ok(())
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
