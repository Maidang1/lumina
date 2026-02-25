use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{Manager, Emitter};

/// 上传开始事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadStartedPayload {
    pub image_id: String,
    pub total_size: u64,
}

/// 上传进度事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadProgressPayload {
    pub image_id: String,
    pub progress: u32,  // 0-100
    pub bytes_transferred: u64,
    pub total_bytes: u64,
}

/// 上传完成事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadCompletedPayload {
    pub image_id: String,
    pub success: bool,
    pub message: String,
    pub result: Option<serde_json::Value>,
}

/// 批量上传开始事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchUploadStartedPayload {
    pub batch_id: String,
    pub total_items: usize,
    pub total_bytes: u64,
}

/// 批量上传统计事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchUploadStatsPayload {
    pub batch_id: String,
    pub completed: usize,
    pub failed: usize,
    pub pending: usize,
    pub overall_progress: u32,  // 0-100
}

/// 批量上传完成事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchUploadCompletedPayload {
    pub batch_id: String,
    pub total_items: usize,
    pub successful_items: usize,
    pub failed_items: usize,
    pub total_duration_ms: u64,
    pub failures: Vec<BatchUploadFailure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchUploadFailure {
    pub image_id: String,
    pub reason: String,
}

/// 准备上传项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreparedUploadItem {
    pub image_id: String,
    pub original_path: String,
    pub original_mime: String,
    pub thumb_path: String,
    pub thumb_variants: HashMap<String, String>,  // size -> path
    pub metadata: String,  // JSON
}

/// 启动批量上传（事件驱动）
#[tauri::command]
pub async fn start_batch_upload_with_events(
    window: tauri::WebviewWindow,
    items: Vec<PreparedUploadItem>,
) -> Result<String, String> {
    use uuid::Uuid;
    use std::time::Instant;

    let batch_id = Uuid::new_v4().to_string();
    let batch_id_clone = batch_id.clone();
    let total_items = items.len();
    let total_bytes: u64 = 0;  // TODO: 计算实际大小

    // 发送批量上传开始事件
    let _ = window.emit("batch_upload_started", BatchUploadStartedPayload {
        batch_id: batch_id_clone.clone(),
        total_items,
        total_bytes,
    });

    // 在后台任务中处理上传
    let window_clone = window.clone();
    let batch_id_for_task = batch_id_clone.clone();
    
    tokio::spawn(async move {
        let start_time = Instant::now();
        let mut successful = 0;
        let mut failed = 0;
        let mut failures = Vec::new();

        for (index, item) in items.into_iter().enumerate() {
            let image_id = item.image_id.clone();

            // 发送上传开始事件
            let _ = window_clone.emit("upload_started", UploadStartedPayload {
                image_id: image_id.clone(),
                total_size: 0,  // TODO: 计算实际大小
            });

            // 执行上传（使用现有的上传逻辑）
            match upload_single_item(&window_clone, &item).await {
                Ok(result) => {
                    successful += 1;
                    let _ = window_clone.emit("upload_completed", UploadCompletedPayload {
                        image_id,
                        success: true,
                        message: "Upload successful".to_string(),
                        result: Some(serde_json::to_value(&result).unwrap_or(serde_json::json!({}))),
                    });
                }
                Err(e) => {
                    failed += 1;
                    failures.push(BatchUploadFailure {
                        image_id: item.image_id.clone(),
                        reason: e.to_string(),
                    });
                    let _ = window_clone.emit("upload_completed", UploadCompletedPayload {
                        image_id: item.image_id,
                        success: false,
                        message: format!("Upload failed: {}", e),
                        result: None,
                    });
                }
            }

            // 发送批量统计事件
            let pending = total_items - (successful + failed);
            let overall_progress = if total_items > 0 {
                ((successful + failed) * 100 / total_items) as u32
            } else {
                0
            };

            let _ = window_clone.emit("batch_upload_stats", BatchUploadStatsPayload {
                batch_id: batch_id_for_task.clone(),
                completed: successful + failed,
                failed,
                pending,
                overall_progress,
            });
        }

        let duration = start_time.elapsed().as_millis() as u64;

        // 发送批量上传完成事件
        let _ = window_clone.emit("batch_upload_completed", BatchUploadCompletedPayload {
            batch_id: batch_id_for_task,
            total_items,
            successful_items: successful,
            failed_items: failed,
            total_duration_ms: duration,
            failures,
        });
    });

    Ok(batch_id)
}

/// 内部函数：上传单个项
async fn upload_single_item(
    window: &tauri::WebviewWindow,
    item: &PreparedUploadItem,
) -> anyhow::Result<serde_json::Value> {
    use crate::commands::github::create_github_manager;

    // 获取 app handle
    let app_handle = window.app_handle();

    // 并行读取所有文件
    let original_bytes = tokio::fs::read(&item.original_path)
        .await
        .context("Failed to read original file")?;
    let thumb_bytes = tokio::fs::read(&item.thumb_path)
        .await
        .context("Failed to read thumb file")?;

    let mut thumb_variants = std::collections::HashMap::new();
    for (size, path) in &item.thumb_variants {
        let bytes = tokio::fs::read(path)
            .await
            .with_context(|| format!("Failed to read thumb variant {}", size))?;
        thumb_variants.insert(size.clone(), bytes);
    }

    // 获取 GitHub manager 并上传
    let manager = create_github_manager(&app_handle, "EventDrivenUpload")
        .map_err(|e| anyhow::anyhow!("Failed to create GitHub manager: {}", e))?;

    let result = manager
        .upload_image_concurrent(
            item.image_id.clone(),
            original_bytes,
            item.original_mime.clone(),
            thumb_bytes,
            thumb_variants,
            item.metadata.clone(),
            true,  // defer_finalize = true，由前端批量 finalize
        )
        .await?;

    Ok(serde_json::to_value(&result).unwrap_or(serde_json::json!({})))
}

use anyhow::Context;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_upload_payload_serialization() {
        let payload = BatchUploadStartedPayload {
            batch_id: "test-batch".to_string(),
            total_items: 5,
            total_bytes: 1024 * 1024 * 100,  // 100 MB
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("test-batch"));
        assert!(json.contains("5"));
    }
}
