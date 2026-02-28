use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::Instant;

use anyhow::{Context, Result};
use lumina_image::{ParseConfig, ParseImageResult, ParseProfile};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

fn get_upload_cache_dir() -> Result<std::path::PathBuf> {
    let cache_dir = if cfg!(target_os = "macos") {
        dirs::home_dir()
            .context("Failed to get home directory")?
            .join("Library/Caches")
    } else if cfg!(target_os = "linux") {
        dirs::cache_dir().context("Failed to get cache directory")?
    } else if cfg!(target_os = "windows") {
        dirs::cache_dir().context("Failed to get cache directory")?
    } else {
        anyhow::bail!("Unsupported platform")
    };

    let upload_cache = cache_dir.join("lumina_upload");
    std::fs::create_dir_all(&upload_cache)?;
    Ok(upload_cache)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TauriParseProfile {
    Quality,
    Turbo,
}

impl From<TauriParseProfile> for ParseProfile {
    fn from(value: TauriParseProfile) -> Self {
        match value {
            TauriParseProfile::Quality => ParseProfile::Quality,
            TauriParseProfile::Turbo => ParseProfile::Turbo,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TauriParseConfig {
    pub max_thumb_size: Option<u32>,
    pub thumb_quality: Option<f32>,
    pub blur_threshold: Option<f64>,
    pub enable_region_resolve: Option<bool>,
    pub generate_thumb_variants: Option<bool>,
    pub parse_profile: Option<TauriParseProfile>,
}

impl From<TauriParseConfig> for ParseConfig {
    fn from(config: TauriParseConfig) -> Self {
        ParseConfig {
            max_thumb_size: config.max_thumb_size,
            thumb_quality: config.thumb_quality.map(|q| q as f64),
            blur_threshold: config.blur_threshold,
            enable_region_resolve: config.enable_region_resolve,
            generate_thumb_variants: config.generate_thumb_variants,
            parse_profile: config.parse_profile.map(|value| value.into()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingTaskMetric {
    pub task_id: String,
    pub status: String,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub degraded: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatReport {
    pub declared_mime: String,
    pub detected_mime: String,
    pub converted: bool,
    pub reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseImageForUploadResult {
    pub normalized_original_bytes: Vec<u8>,
    pub normalized_original_mime: String,
    pub normalized_original_filename: String,
    pub thumb_bytes: Vec<u8>,
    pub thumb_variants: HashMap<String, Vec<u8>>,
    pub metadata: JsonValue,
    pub format_report: FormatReport,
    pub stage_metrics: Vec<ProcessingTaskMetric>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseImageForUploadResultOptimized {
    pub normalized_original_path: String,
    pub normalized_original_mime: String,
    pub normalized_original_filename: String,
    pub thumb_path: String,
    pub thumb_variants: HashMap<String, String>,
    pub metadata: JsonValue,
    pub format_report: FormatReport,
    pub stage_metrics: Vec<ProcessingTaskMetric>,
}

fn build_stage_metric(task_id: &str, status: &str, duration_ms: u64) -> ProcessingTaskMetric {
    ProcessingTaskMetric {
        task_id: task_id.to_string(),
        status: status.to_string(),
        duration_ms,
        degraded: None,
    }
}

fn convert_result(result: ParseImageResult) -> ParseImageForUploadResult {
    let stage_metrics: Vec<ProcessingTaskMetric> = result
        .stage_metrics
        .into_iter()
        .map(|m| ProcessingTaskMetric {
            task_id: m.task_id,
            status: m.status,
            duration_ms: m.duration_ms,
            degraded: m.degraded,
        })
        .collect();

    ParseImageForUploadResult {
        normalized_original_bytes: result.normalized_original_bytes,
        normalized_original_mime: result.normalized_original_mime,
        normalized_original_filename: result.normalized_original_filename,
        thumb_bytes: result.thumb_bytes,
        thumb_variants: result.thumb_variants,
        metadata: result.metadata,
        format_report: FormatReport {
            declared_mime: result.format_report.declared_mime,
            detected_mime: result.format_report.detected_mime,
            converted: result.format_report.converted,
            reason: result.format_report.reason,
        },
        stage_metrics,
    }
}

fn is_heif_like(path: &str, mime: &str) -> bool {
    let lower_path = path.to_lowercase();
    let lower_mime = mime.to_lowercase();
    lower_path.ends_with(".heic")
        || lower_path.ends_with(".heif")
        || lower_mime.contains("image/heic")
        || lower_mime.contains("image/heif")
}

fn convert_heif_to_jpeg_bytes(path: &str) -> Result<Vec<u8>, String> {
    #[cfg(target_os = "macos")]
    {
        let tmp_dir = std::env::temp_dir();
        let output_path = tmp_dir.join(format!("lumina_heif_{}.jpg", uuid::Uuid::new_v4()));
        let status = Command::new("sips")
            .args(["-s", "format", "jpeg", path, "--out"])
            .arg(&output_path)
            .status()
            .map_err(|e| format!("failed to execute sips for HEIF conversion: {}", e))?;

        if !status.success() {
            let _ = std::fs::remove_file(&output_path);
            return Err(format!(
                "HEIF conversion failed with sips exit code: {}",
                status
                    .code()
                    .map(|code| code.to_string())
                    .unwrap_or_else(|| "unknown".to_string())
            ));
        }

        let bytes =
            std::fs::read(&output_path).map_err(|e| format!("failed to read converted JPEG: {}", e))?;
        let _ = std::fs::remove_file(&output_path);
        Ok(bytes)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Err("HEIC/HEIF fallback conversion is currently supported on macOS only".to_string())
    }
}

async fn parse_with_heif_fallback(
    path: &str,
    file_name: &str,
    mime: &str,
    bytes: Vec<u8>,
    lumina_config: Option<ParseConfig>,
) -> Result<ParseImageResult, String> {
    match lumina_image::parse_image(
        file_name.to_string(),
        mime.to_string(),
        bytes,
        lumina_config.clone(),
    )
    .await
    {
        Ok(result) => Ok(result),
        Err(primary_error) => {
            if !is_heif_like(path, mime) {
                return Err(primary_error.to_string());
            }

            let converted_bytes = convert_heif_to_jpeg_bytes(path)?;
            let jpg_name = if file_name.to_lowercase().ends_with(".heif")
                || file_name.to_lowercase().ends_with(".heic")
            {
                file_name
                    .rsplit_once('.')
                    .map(|(name, _)| format!("{}.jpg", name))
                    .unwrap_or_else(|| format!("{}.jpg", file_name))
            } else {
                format!("{}.jpg", file_name)
            };

            lumina_image::parse_image(
                jpg_name,
                "image/jpeg".to_string(),
                converted_bytes,
                lumina_config,
            )
            .await
            .map_err(|fallback_error| {
                format!(
                    "HEIF parse failed. primary={} | fallback={}",
                    primary_error, fallback_error
                )
            })
        }
    }
}

#[tauri::command]
pub async fn parse_image_for_upload_from_path(
    path: String,
    declared_mime: Option<String>,
    config: Option<TauriParseConfig>,
) -> Result<ParseImageForUploadResult, String> {
    let read_start = Instant::now();
    let bytes = fs::read(&path).map_err(|e| format!("failed to read file: {}", e))?;
    let read_duration_ms = read_start.elapsed().as_millis() as u64;
    let file_name = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "upload.bin".to_string());
    let mime = declared_mime.unwrap_or_else(|| "application/octet-stream".to_string());
    let lumina_config = config.map(|c| c.into());

    let mut converted = parse_with_heif_fallback(&path, &file_name, &mime, bytes, lumina_config)
        .await
        .map(convert_result)
        .map_err(|e| e.to_string())?;

    let mut stage_metrics = Vec::with_capacity(converted.stage_metrics.len() + 1);
    stage_metrics.push(build_stage_metric("read_file", "completed", read_duration_ms));
    stage_metrics.extend(converted.stage_metrics);
    converted.stage_metrics = stage_metrics;
    Ok(converted)
}

#[tauri::command]
pub async fn parse_image_for_upload_from_path_optimized(
    path: String,
    declared_mime: Option<String>,
    config: Option<TauriParseConfig>,
) -> Result<ParseImageForUploadResultOptimized, String> {
    let read_start = Instant::now();
    let bytes = fs::read(&path).map_err(|e| format!("failed to read file: {}", e))?;
    let read_duration_ms = read_start.elapsed().as_millis() as u64;
    let file_name = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "upload.bin".to_string());
    let mime = declared_mime.unwrap_or_else(|| "application/octet-stream".to_string());
    let lumina_config = config.map(|c| c.into());

    let result = parse_with_heif_fallback(&path, &file_name, &mime, bytes, lumina_config)
        .await
        .map_err(|e| e.to_string())?;

    let write_start = Instant::now();
    let cache_dir = get_upload_cache_dir().map_err(|e| e.to_string())?;

    let session_id = uuid::Uuid::new_v4().to_string();
    let session_dir = cache_dir.join(&session_id);
    std::fs::create_dir_all(&session_dir).map_err(|e| e.to_string())?;

    let normalized_original_path = session_dir.join("original.jpg");
    std::fs::write(&normalized_original_path, &result.normalized_original_bytes)
        .map_err(|e| e.to_string())?;

    let thumb_path = session_dir.join("thumb.webp");
    std::fs::write(&thumb_path, &result.thumb_bytes).map_err(|e| e.to_string())?;

    let mut thumb_variants_paths = HashMap::new();
    for (size, bytes) in &result.thumb_variants {
        let variant_path = session_dir.join(format!("thumb_{}.webp", size));
        std::fs::write(&variant_path, bytes).map_err(|e| e.to_string())?;
        thumb_variants_paths.insert(size.clone(), variant_path.to_string_lossy().to_string());
    }
    let write_duration_ms = write_start.elapsed().as_millis() as u64;

    let stage_metrics: Vec<ProcessingTaskMetric> = result
        .stage_metrics
        .into_iter()
        .map(|m| ProcessingTaskMetric {
            task_id: m.task_id,
            status: m.status,
            duration_ms: m.duration_ms,
            degraded: m.degraded,
        })
        .collect();
    let mut end_to_end_stage_metrics = Vec::with_capacity(stage_metrics.len() + 2);
    end_to_end_stage_metrics.push(build_stage_metric("read_file", "completed", read_duration_ms));
    end_to_end_stage_metrics.extend(stage_metrics);
    end_to_end_stage_metrics.push(build_stage_metric(
        "write_cache",
        "completed",
        write_duration_ms,
    ));

    Ok(ParseImageForUploadResultOptimized {
        normalized_original_path: normalized_original_path.to_string_lossy().to_string(),
        normalized_original_mime: result.normalized_original_mime,
        normalized_original_filename: result.normalized_original_filename,
        thumb_path: thumb_path.to_string_lossy().to_string(),
        thumb_variants: thumb_variants_paths,
        metadata: result.metadata,
        format_report: FormatReport {
            declared_mime: result.format_report.declared_mime,
            detected_mime: result.format_report.detected_mime,
            converted: result.format_report.converted,
            reason: result.format_report.reason,
        },
        stage_metrics: end_to_end_stage_metrics,
    })
}

#[derive(Debug, Deserialize)]
pub struct CacheUploadRequest {
    pub image_id: String,
    pub original_path: String,
    pub original_mime: String,
    pub thumb_path: String,
    pub thumb_variants: HashMap<String, String>,
    pub metadata: String,
    pub defer_finalize: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CacheUploadResponse {
    pub success: bool,
    pub image_id: String,
    pub message: String,
}

#[tauri::command]
pub async fn upload_from_cache_to_github(
    requests: Vec<CacheUploadRequest>,
    app: tauri::AppHandle,
) -> Result<Vec<CacheUploadResponse>, String> {
    let mut responses = Vec::new();

    for req in requests {
        match upload_single_from_cache(&req, &app).await {
            Ok((image_id, message)) => {
                responses.push(CacheUploadResponse {
                    success: true,
                    image_id,
                    message,
                });
            }
            Err(e) => {
                responses.push(CacheUploadResponse {
                    success: false,
                    image_id: req.image_id.clone(),
                    message: e.to_string(),
                });
            }
        }
    }

    Ok(responses)
}

async fn upload_single_from_cache(
    req: &CacheUploadRequest,
    app: &tauri::AppHandle,
) -> Result<(String, String)> {
    use super::github::create_github_manager;

    let original_bytes = tokio::fs::read(&req.original_path)
        .await
        .context("Failed to read original file")?;
    let thumb_bytes = tokio::fs::read(&req.thumb_path)
        .await
        .context("Failed to read thumb file")?;

    let mut thumb_variants = HashMap::new();
    for (size, path) in &req.thumb_variants {
        let bytes = tokio::fs::read(path)
            .await
            .with_context(|| format!("Failed to read thumb variant {}", size))?;
        thumb_variants.insert(size.clone(), bytes);
    }

    let manager = create_github_manager(app, "CacheUpload")
        .map_err(|e| anyhow::anyhow!("Failed to create GitHub manager: {}", e))?;

    let result = manager
        .upload_image_concurrent(
            req.image_id.clone(),
            original_bytes,
            req.original_mime.clone(),
            thumb_bytes,
            thumb_variants,
            req.metadata.clone(),
            req.defer_finalize.unwrap_or(false),
        )
        .await
        .context("GitHub upload failed")?;

    Ok((result.image_id, "Uploaded successfully".to_string()))
}
