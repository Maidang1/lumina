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
    let metadata = fs::metadata(&path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    let modified = metadata
        .modified()
        .map_err(|e| format!("Failed to get modified time: {}", e))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Invalid modified time: {}", e))?
        .as_secs();

    Ok(FileInfo {
        path: path.clone(),
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

    let mut files = Vec::new();
    let max_depth = if recursive { usize::MAX } else { 1 };

    for entry in WalkDir::new(path_obj)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let file_path = entry.path();
        if let Some(ext) = file_path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            if extensions.is_empty() || extensions.contains(&ext_str) {
                if let Some(path_str) = file_path.to_str() {
                    files.push(path_str.to_string());
                }
            }
        }
    }

    Ok(files)
}
