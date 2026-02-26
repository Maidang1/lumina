use crate::types::{ExifSummary, GeoRegion, ProcessingTaskMetric};
use chrono::Utc;
use serde_json::{json, Value as JsonValue};

pub fn build_metadata(
    image_id: &str,
    normalized_original_filename: &str,
    normalized_original_mime: &str,
    original_bytes: usize,
    thumb_w: u32,
    thumb_h: u32,
    thumb_bytes: usize,
    thumb_variant_meta: serde_json::Map<String, JsonValue>,
    exif_summary: ExifSummary,
    region: Option<GeoRegion>,
    has_gps: bool,
    width: u32,
    height: u32,
    dominant_hex: String,
    blur_score: f64,
    is_blurry: bool,
    phash_value: String,
    thumbhash: Option<String>,
    total_ms: u64,
    task_metrics: &[ProcessingTaskMetric],
) -> JsonValue {
    let now = Utc::now().to_rfc3339();

    let mut exif = serde_json::Map::new();
    put_opt_str(&mut exif, "Make", exif_summary.make);
    put_opt_str(&mut exif, "Model", exif_summary.model);
    put_opt_str(&mut exif, "LensModel", exif_summary.lens_model);
    put_opt_str(&mut exif, "DateTimeOriginal", exif_summary.datetime_original);
    put_opt_f64(&mut exif, "ExposureTime", exif_summary.exposure_time);
    put_opt_f64(&mut exif, "FNumber", exif_summary.f_number);
    put_opt_u32(&mut exif, "ISO", exif_summary.iso);
    put_opt_f64(&mut exif, "FocalLength", exif_summary.focal_length);
    put_opt_u16(&mut exif, "Orientation", exif_summary.orientation);
    put_opt_str(&mut exif, "Software", exif_summary.software);
    put_opt_str(&mut exif, "Artist", exif_summary.artist);
    put_opt_str(&mut exif, "Copyright", exif_summary.copyright);

    let mut metadata = json!({
        "schema_version": "1.3",
        "image_id": image_id,
        "thumbhash": thumbhash,
        "original_filename": normalized_original_filename,
        "timestamps": {
            "created_at": now,
            "client_processed_at": now,
        },
        "files": {
            "original": {
                "path": "",
                "mime": normalized_original_mime,
                "bytes": original_bytes,
            },
            "thumb": {
                "path": "",
                "mime": "image/webp",
                "bytes": thumb_bytes,
                "width": thumb_w,
                "height": thumb_h,
            },
            "thumb_variants": thumb_variant_meta,
        },
        "exif": JsonValue::Object(exif),
        "privacy": {
            "original_contains_gps": has_gps,
            "exif_gps_removed": has_gps,
        },
        "derived": {
            "dimensions": {
                "width": width,
                "height": height,
            },
            "dominant_color": {
                "hex": dominant_hex,
            },
            "blur": {
                "score": blur_score,
                "is_blurry": is_blurry,
                "method": "variance_of_laplacian",
            },
            "phash": {
                "algo": "blockhash",
                "bits": 16,
                "value": phash_value,
            },
            "ocr": {
                "status": "skipped",
                "summary": "",
            }
        },
        "processing": {
            "summary": {
                "total_ms": total_ms,
                "concurrency_profile": "lumina-image:rust",
                "stage_durations": task_metrics.iter().map(|m| json!({
                    "stage_id": m.task_id,
                    "duration_ms": m.duration_ms,
                })).collect::<Vec<_>>(),
            }
        }
    });

    if let Some(region) = region {
        if let Some(obj) = metadata.as_object_mut() {
            obj.insert("geo".to_string(), json!({ "region": region }));
        }
    }

    metadata
}

fn put_opt_str(map: &mut serde_json::Map<String, JsonValue>, key: &str, value: Option<String>) {
    if let Some(v) = value {
        map.insert(key.to_string(), JsonValue::String(v));
    }
}

fn put_opt_f64(map: &mut serde_json::Map<String, JsonValue>, key: &str, value: Option<f64>) {
    if let Some(v) = value {
        map.insert(key.to_string(), json!(v));
    }
}

fn put_opt_u16(map: &mut serde_json::Map<String, JsonValue>, key: &str, value: Option<u16>) {
    if let Some(v) = value {
        map.insert(key.to_string(), json!(v));
    }
}

fn put_opt_u32(map: &mut serde_json::Map<String, JsonValue>, key: &str, value: Option<u32>) {
    if let Some(v) = value {
        map.insert(key.to_string(), json!(v));
    }
}
