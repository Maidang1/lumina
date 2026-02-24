use std::collections::HashMap;

use crate::github::{GitHubClient, GitHubConfig, UploadManager};

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
    eprintln!("[GitHub Upload] Original size: {} bytes, mime: {}", original.len(), original_mime);
    eprintln!("[GitHub Upload] Thumb size: {} bytes", thumb.len());
    eprintln!("[GitHub Upload] Thumb variants: {:?}", thumb_variants.keys().collect::<Vec<_>>());

    let config = match GitHubConfig::from_store(&app) {
        Ok(cfg) => {
            eprintln!("[GitHub Upload] Config loaded: owner={}, repo={}, branch={}",
                cfg.owner, cfg.repo, cfg.branch);
            cfg
        }
        Err(e) => {
            eprintln!("[GitHub Upload] Failed to load config: {}", e);
            return Err(format!("配置加载失败: {}", e));
        }
    };

    let client = match GitHubClient::new(config) {
        Ok(c) => {
            eprintln!("[GitHub Upload] GitHub client created successfully");
            c
        }
        Err(e) => {
            eprintln!("[GitHub Upload] Failed to create GitHub client: {}", e);
            return Err(format!("GitHub 客户端创建失败: {}", e));
        }
    };

    let manager = UploadManager::new(client, 3);
    eprintln!("[GitHub Upload] Upload manager created, starting upload...");

    match manager
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
    {
        Ok(result) => {
            eprintln!("[GitHub Upload] Upload successful for image_id: {}", image_id);
            Ok(result)
        }
        Err(e) => {
            eprintln!("[GitHub Upload] Upload failed for image_id: {}", image_id);
            eprintln!("[GitHub Upload] Error details: {:?}", e);
            Err(format!("上传失败: {}", e))
        }
    }
}

#[tauri::command]
pub async fn github_delete_image(
    image_id: String,
    app: tauri::AppHandle,
) -> Result<crate::github::DeleteResult, String> {
    eprintln!("[GitHub Delete] Starting delete for image_id: {}", image_id);

    let config = GitHubConfig::from_store(&app).map_err(|e| {
        eprintln!("[GitHub Delete] Config load failed: {}", e);
        format!("配置加载失败: {}", e)
    })?;

    let client = GitHubClient::new(config).map_err(|e| {
        eprintln!("[GitHub Delete] Client creation failed: {}", e);
        format!("GitHub 客户端创建失败: {}", e)
    })?;

    let manager = UploadManager::new(client, 3);

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

    let config = GitHubConfig::from_store(&app).map_err(|e| {
        eprintln!("[GitHub Batch] Config load failed: {}", e);
        format!("配置加载失败: {}", e)
    })?;

    let client = GitHubClient::new(config).map_err(|e| {
        eprintln!("[GitHub Batch] Client creation failed: {}", e);
        format!("GitHub 客户端创建失败: {}", e)
    })?;

    let manager = UploadManager::new(client, 3);

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

    let config = GitHubConfig::from_store(&app).map_err(|e| {
        eprintln!("[GitHub List] Config load failed: {}", e);
        format!("配置加载失败: {}", e)
    })?;

    let client = GitHubClient::new(config).map_err(|e| {
        eprintln!("[GitHub List] Client creation failed: {}", e);
        format!("GitHub 客户端创建失败: {}", e)
    })?;

    let manager = UploadManager::new(client, 3);

    manager
        .list_images(cursor, limit)
        .await
        .map_err(|e| {
            eprintln!("[GitHub List] List failed: {:?}", e);
            format!("列表查询失败: {}", e)
        })
}
