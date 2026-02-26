#![deny(clippy::all)]

use lumina_image::{compute_thumbhash_from_rgba, sha256_with_prefix, ParseConfig as LuminaParseConfig};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::HashMap;
use std::path::Path;

#[napi(object)]
pub struct ParseConfig {
    pub max_thumb_size: Option<u32>,
    pub thumb_quality: Option<f64>,
    pub blur_threshold: Option<f64>,
    pub enable_region_resolve: Option<bool>,
    pub generate_thumb_variants: Option<bool>,
}

impl From<ParseConfig> for LuminaParseConfig {
    fn from(config: ParseConfig) -> Self {
        LuminaParseConfig {
            max_thumb_size: config.max_thumb_size,
            thumb_quality: config.thumb_quality,
            blur_threshold: config.blur_threshold,
            enable_region_resolve: config.enable_region_resolve,
            generate_thumb_variants: config.generate_thumb_variants,
        }
    }
}

#[napi(object)]
pub struct FormatReport {
    pub declared_mime: String,
    pub detected_mime: String,
    pub converted: bool,
    pub reason: String,
}

#[napi(object)]
pub struct ProcessingTaskMetric {
    pub task_id: String,
    pub status: String,
    pub duration_ms: u32,
    pub degraded: Option<bool>,
}

#[napi(object)]
pub struct ParseImageResult {
    pub normalized_original_bytes: Buffer,
    pub normalized_original_mime: String,
    pub normalized_original_filename: String,
    pub thumb_bytes: Buffer,
    pub thumb_variants: HashMap<String, Buffer>,
    pub metadata: serde_json::Value,
    pub format_report: FormatReport,
    pub stage_metrics: Vec<ProcessingTaskMetric>,
}

fn convert_result(result: lumina_image::ParseImageResult) -> ParseImageResult {
    let thumb_variants: HashMap<String, Buffer> = result
        .thumb_variants
        .into_iter()
        .map(|(k, v)| (k, Buffer::from(v)))
        .collect();

    let stage_metrics: Vec<ProcessingTaskMetric> = result
        .stage_metrics
        .into_iter()
        .map(|m| ProcessingTaskMetric {
            task_id: m.task_id,
            status: m.status,
            duration_ms: m.duration_ms as u32,
            degraded: m.degraded,
        })
        .collect();

    ParseImageResult {
        normalized_original_bytes: Buffer::from(result.normalized_original_bytes),
        normalized_original_mime: result.normalized_original_mime,
        normalized_original_filename: result.normalized_original_filename,
        thumb_bytes: Buffer::from(result.thumb_bytes),
        thumb_variants,
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

#[napi]
pub async fn parse_image_from_path(
    path: String,
    declared_mime: Option<String>,
    config: Option<ParseConfig>,
) -> Result<ParseImageResult> {
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| Error::from_reason(format!("failed to read file: {}", e)))?;

    let file_name = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "upload.bin".to_string());

    let mime = declared_mime.unwrap_or_else(|| "application/octet-stream".to_string());
    let lumina_config = config.map(|c| c.into());

    lumina_image::parse_image(file_name, mime, bytes, lumina_config)
        .await
        .map(convert_result)
        .map_err(|e| Error::from_reason(e.to_string()))
}

#[napi]
pub async fn parse_image_from_bytes(
    file_name: String,
    mime_type: String,
    bytes: Buffer,
    config: Option<ParseConfig>,
) -> Result<ParseImageResult> {
    let lumina_config = config.map(|c| c.into());

    lumina_image::parse_image(file_name, mime_type, bytes.to_vec(), lumina_config)
        .await
        .map(convert_result)
        .map_err(|e| Error::from_reason(e.to_string()))
}

#[napi]
pub fn compute_sha256(bytes: Buffer) -> String {
    sha256_with_prefix(&bytes)
}

#[napi]
pub fn compute_thumbhash(width: u32, height: u32, rgba: Buffer) -> Option<String> {
    compute_thumbhash_from_rgba(width, height, &rgba)
}
