use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub size: u64,
    pub modified: u64,
    pub is_file: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderImageInfo {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub modified_at: u64,
    pub mime_type: String,
    pub is_browser_supported: bool,
}

fn extension_to_mime(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "heic" => "image/heic",
        "heif" => "image/heif",
        "avif" => "image/avif",
        "tiff" | "tif" => "image/tiff",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
}

fn is_browser_supported_ext(ext: &str) -> bool {
    matches!(ext, "jpg" | "jpeg" | "png" | "webp" | "gif" | "avif" | "bmp")
}

#[tauri::command]
pub async fn read_file_as_bytes(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let metadata =
        fs::metadata(&path).map_err(|e| format!("Failed to get file metadata: {}", e))?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .ok_or("Invalid modified time".to_string())?;

    Ok(FileInfo {
        path,
        size: metadata.len(),
        modified,
        is_file: metadata.is_file(),
    })
}

#[tauri::command]
pub async fn scan_directory(
    path: String,
    extensions: Vec<String>,
    recursive: bool,
) -> Result<Vec<String>, String> {
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let max_depth = if recursive { usize::MAX } else { 1 };
    let extensions_lower: Vec<String> = extensions.iter().map(|e| e.to_lowercase()).collect();
    let filter_extensions = !extensions_lower.is_empty();

    let files = WalkDir::new(path_obj)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| {
            let file_path = e.path();
            let ext = file_path.extension()?.to_string_lossy().to_lowercase();
            
            if filter_extensions && !extensions_lower.contains(&ext) {
                return None;
            }
            
            file_path.to_str().map(|s| s.to_string())
        })
        .collect();

    Ok(files)
}

#[tauri::command]
pub async fn scan_folder_images(
    folder_path: String,
    recursive: bool,
) -> Result<Vec<FolderImageInfo>, String> {
    let path_obj = Path::new(&folder_path);
    if !path_obj.exists() {
        return Err(format!("Path does not exist: {}", folder_path));
    }
    if !path_obj.is_dir() {
        return Err(format!("Path is not a directory: {}", folder_path));
    }

    let image_extensions: HashSet<&str> = [
        "jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif", "tiff", "tif", "bmp",
    ]
    .into_iter()
    .collect();

    let max_depth = if recursive { usize::MAX } else { 1 };

    let mut images: Vec<FolderImageInfo> = WalkDir::new(path_obj)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|entry| {
            let file_path = entry.path();
            let ext = file_path.extension()?.to_string_lossy().to_lowercase();

            if !image_extensions.contains(ext.as_str()) {
                return None;
            }

            let metadata = entry.metadata().ok()?;
            let modified_at = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            Some(FolderImageInfo {
                path: file_path.to_string_lossy().to_string(),
                name,
                size_bytes: metadata.len(),
                modified_at,
                mime_type: extension_to_mime(&ext).to_string(),
                is_browser_supported: is_browser_supported_ext(&ext),
            })
        })
        .collect();

    // Sort by modified date descending (newest first)
    images.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(images)
}
