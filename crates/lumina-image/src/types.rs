use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ParseProfile {
    Quality,
    Turbo,
}

impl Default for ParseProfile {
    fn default() -> Self {
        Self::Quality
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ParseConfig {
    pub max_thumb_size: Option<u32>,
    pub thumb_quality: Option<f64>,
    pub blur_threshold: Option<f64>,
    pub enable_region_resolve: Option<bool>,
    pub generate_thumb_variants: Option<bool>,
    pub parse_profile: Option<ParseProfile>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FormatReport {
    pub declared_mime: String,
    pub detected_mime: String,
    pub converted: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProcessingTaskMetric {
    pub task_id: String,
    pub status: String,
    pub duration_ms: u64,
    pub degraded: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct ParseImageResult {
    pub normalized_original_bytes: Vec<u8>,
    pub normalized_original_mime: String,
    pub normalized_original_filename: String,
    pub thumb_bytes: Vec<u8>,
    pub thumb_variants: HashMap<String, Vec<u8>>,
    pub metadata: serde_json::Value,
    pub format_report: FormatReport,
    pub stage_metrics: Vec<ProcessingTaskMetric>,
}

#[derive(Debug, Default)]
pub struct ExifSummary {
    pub make: Option<String>,
    pub model: Option<String>,
    pub lens_model: Option<String>,
    pub datetime_original: Option<String>,
    pub exposure_time: Option<f64>,
    pub f_number: Option<f64>,
    pub iso: Option<u32>,
    pub focal_length: Option<f64>,
    pub orientation: Option<u16>,
    pub software: Option<String>,
    pub artist: Option<String>,
    pub copyright: Option<String>,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GeoRegion {
    pub country: String,
    pub province: String,
    pub city: String,
    pub display_name: String,
    pub cache_key: String,
    pub source: String,
    pub resolved_at: String,
}
