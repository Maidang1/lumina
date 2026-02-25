use std::collections::HashMap;

use crate::github::{GitHubClient, GitHubConfig, UploadManager};

pub fn create_github_manager(app: &tauri::AppHandle, operation: &str) -> Result<UploadManager, String> {
    let config = GitHubConfig::from_store(app).map_err(|e| {
        eprintln!("[{operation}] Config load failed: {e}");
        format!("配置加载失败: {e}")
    })?;
    let client = GitHubClient::new(config).map_err(|e| {
        eprintln!("[{operation}] Client creation failed: {e}");
        format!("GitHub 客户端创建失败: {e}")
    })?;
    Ok(UploadManager::new(client, 3))
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
    eprintln!("[GitHub Upload] Starting upload for image_id: {}", image_id);

    let manager = create_github_manager(&app, "GitHub Upload")?;

    manager
        .upload_image_concurrent(
            image_id.clone(),
            original,
            original_mime,
            thumb,
            thumb_variants,
            metadata,
            defer_finalize,
        )
        .await
        .map_err(|e| {
            eprintln!("[GitHub Upload] Upload failed: {:?}", e);
            format!("上传失败: {}", e)
        })
}

#[tauri::command]
pub async fn github_delete_image(
    image_id: String,
    app: tauri::AppHandle,
) -> Result<crate::github::DeleteResult, String> {
    eprintln!("[GitHub Delete] Starting delete for image_id: {}", image_id);

    let manager = create_github_manager(&app, "GitHub Delete")?;
    manager
        .delete_image(image_id.clone())
        .await
        .map_err(|e| {
            eprintln!("[GitHub Delete] Delete failed: {:?}", e);
            format!("删除失败: {}", e)
        })
}

#[tauri::command]
pub async fn github_finalize_batch(
    metadatas: Vec<String>,
    app: tauri::AppHandle,
) -> Result<crate::github::BatchFinalizeResult, String> {
    eprintln!("[GitHub Batch] Starting batch finalize for {} items", metadatas.len());

    let manager = create_github_manager(&app, "GitHub Batch")?;
    manager
        .finalize_batch(metadatas)
        .await
        .map_err(|e| {
            eprintln!("[GitHub Batch] Batch finalize failed: {:?}", e);
            format!("批量完成失败: {}", e)
        })
}

#[tauri::command]
pub async fn github_list_images(
    cursor: Option<String>,
    limit: usize,
    app: tauri::AppHandle,
) -> Result<crate::github::ImageListResponse, String> {
    eprintln!("[GitHub List] Listing images with cursor: {:?}, limit: {}", cursor, limit);

    let manager = create_github_manager(&app, "GitHub List")?;
    manager
        .list_images(cursor, limit)
        .await
        .map_err(|e| {
            eprintln!("[GitHub List] List failed: {:?}", e);
            format!("列表查询失败: {}", e)
        })
}
