use serde::{Deserialize, Serialize};
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
