pub mod decode;
pub mod exif;
pub mod hash;
pub mod metadata;
pub mod region;
pub mod thumbnail;
pub mod types;

pub use decode::*;
pub use exif::*;
pub use hash::*;
pub use metadata::*;
pub use region::*;
pub use thumbnail::*;
pub use types::*;

use anyhow::{Context, Result};
use rayon::prelude::*;
use std::collections::HashMap;
use std::time::Instant;

const THUMB_VARIANT_SIZES: [u32; 3] = [400, 800, 1600];

pub async fn parse_image(
    file_name: String,
    declared_mime: String,
    bytes: Vec<u8>,
    config: Option<ParseConfig>,
) -> Result<ParseImageResult> {
    let pipeline_start = Instant::now();
    let config = config.unwrap_or_default();
    let max_thumb_size = config.max_thumb_size.unwrap_or(1024);
    let thumb_quality = config.thumb_quality.unwrap_or(0.78).clamp(0.1, 1.0);
    let blur_threshold = config.blur_threshold.unwrap_or(100.0);
    let enable_region_resolve = config.enable_region_resolve.unwrap_or(false);
    let generate_thumb_variants = config.generate_thumb_variants.unwrap_or(true);

    let mut task_metrics: Vec<ProcessingTaskMetric> = Vec::new();

    let t_format = Instant::now();
    let detected_mime = detect_mime(&bytes, &file_name, &declared_mime);
    let should_convert = !is_browser_supported(&detected_mime);
    task_metrics.push(ProcessingTaskMetric {
        task_id: "format_validate".to_string(),
        status: "completed".to_string(),
        duration_ms: t_format.elapsed().as_millis() as u64,
        degraded: None,
    });

    let t_decode = Instant::now();
    let source_image = decode_image(&bytes, &detected_mime)
        .with_context(|| format!("unsupported/invalid image format: {}", detected_mime))?;
    task_metrics.push(ProcessingTaskMetric {
        task_id: "decode".to_string(),
        status: "completed".to_string(),
        duration_ms: t_decode.elapsed().as_millis() as u64,
        degraded: None,
    });

    let t_exif = Instant::now();
    let exif_summary = extract_exif_summary(&bytes).unwrap_or_default();
    task_metrics.push(ProcessingTaskMetric {
        task_id: "exif".to_string(),
        status: "completed".to_string(),
        duration_ms: t_exif.elapsed().as_millis() as u64,
        degraded: None,
    });

    let oriented_image = apply_exif_orientation(&source_image, exif_summary.orientation);

    let t_normalize = Instant::now();
    let quality = if should_convert { 90 } else { 95 };
    let normalized_original_bytes = encode_jpeg(&oriented_image, quality)?;
    let normalized_original_filename = replace_extension(&file_name, "jpg");
    let normalized_original_mime = "image/jpeg".to_string();
    task_metrics.push(ProcessingTaskMetric {
        task_id: "normalize_original".to_string(),
        status: "completed".to_string(),
        duration_ms: t_normalize.elapsed().as_millis() as u64,
        degraded: None,
    });

    let t_hash = Instant::now();
    let image_id = sha256_with_prefix(&normalized_original_bytes);
    task_metrics.push(ProcessingTaskMetric {
        task_id: "hash".to_string(),
        status: "completed".to_string(),
        duration_ms: t_hash.elapsed().as_millis() as u64,
        degraded: None,
    });

    let t_thumb = Instant::now();
    let thumb_image = resize_inside(&oriented_image, max_thumb_size);
    let thumb_bytes = encode_webp(&thumb_image, thumb_quality)?;
    let (thumb_w, thumb_h) = thumb_image.dimensions();

    let (width, height) = oriented_image.dimensions();
    let has_gps = exif_summary.gps_latitude.is_some() && exif_summary.gps_longitude.is_some();

    let parallel_results = rayon::join(
        || {
            if generate_thumb_variants {
                let variant_results: Result<Vec<(u32, u32, u32, Vec<u8>)>> = THUMB_VARIANT_SIZES
                    .par_iter()
                    .map(|&size| {
                        let variant = resize_inside(&oriented_image, size);
                        let (vw, vh) = variant.dimensions();
                        let variant_bytes = encode_webp(&variant, thumb_quality)?;
                        Ok((size, vw, vh, variant_bytes))
                    })
                    .collect();
                variant_results
            } else {
                Ok(Vec::new())
            }
        },
        || {
            rayon::join(
                || {
                    let dominant = dominant_color_hex(&thumb_image);
                    let blur = variance_of_laplacian(&thumb_image, 128);
                    (dominant, blur)
                },
                || {
                    let phash = blockhash16(&thumb_image);
                    let thash = build_thumbhash(&thumb_image);
                    (phash, thash)
                },
            )
        },
    );

    let (variant_results, ((dominant_hex, blur_score), (phash_value, thumbhash))) = parallel_results;
    let is_blurry = blur_score < blur_threshold;

    let mut thumb_variants = HashMap::new();
    let mut thumb_variant_meta = serde_json::Map::new();
    for (size, vw, vh, variant_bytes) in variant_results? {
        let bytes_len = variant_bytes.len();
        thumb_variants.insert(size.to_string(), variant_bytes);
        thumb_variant_meta.insert(
            size.to_string(),
            serde_json::json!({
                "path": "",
                "mime": "image/webp",
                "bytes": bytes_len,
                "width": vw,
                "height": vh,
                "size": size,
            }),
        );
    }

    task_metrics.push(ProcessingTaskMetric {
        task_id: "thumbnail".to_string(),
        status: "completed".to_string(),
        duration_ms: t_thumb.elapsed().as_millis() as u64,
        degraded: None,
    });

    let t_region = Instant::now();
    let region = if enable_region_resolve {
        if let (Some(lat), Some(lng)) = (exif_summary.gps_latitude, exif_summary.gps_longitude) {
            resolve_region(lat, lng).await
        } else {
            None
        }
    } else {
        None
    };
    let region_status = if enable_region_resolve {
        if region.is_some() {
            "completed"
        } else {
            "skipped"
        }
    } else {
        "skipped"
    };
    task_metrics.push(ProcessingTaskMetric {
        task_id: "region".to_string(),
        status: region_status.to_string(),
        duration_ms: t_region.elapsed().as_millis() as u64,
        degraded: None,
    });

    let metadata = build_metadata(
        &image_id,
        &normalized_original_filename,
        &normalized_original_mime,
        normalized_original_bytes.len(),
        thumb_w,
        thumb_h,
        thumb_bytes.len(),
        thumb_variant_meta,
        exif_summary,
        region,
        has_gps,
        width,
        height,
        dominant_hex,
        blur_score,
        is_blurry,
        phash_value,
        thumbhash,
        pipeline_start.elapsed().as_millis() as u64,
        &task_metrics,
    );

    Ok(ParseImageResult {
        normalized_original_bytes,
        normalized_original_mime,
        normalized_original_filename,
        thumb_bytes,
        thumb_variants,
        metadata,
        format_report: FormatReport {
            declared_mime,
            detected_mime: detected_mime.clone(),
            converted: should_convert,
            reason: if should_convert {
                format!(
                    "{} is not browser-display-safe; converted to image/jpeg",
                    detected_mime
                )
            } else {
                "already browser-display-safe".to_string()
            },
        },
        stage_metrics: task_metrics,
    })
}

fn replace_extension(file_name: &str, ext: &str) -> String {
    if let Some((head, _)) = file_name.rsplit_once('.') {
        format!("{}.{}", head, ext)
    } else {
        format!("{}.{}", file_name, ext)
    }
}

use image::GenericImageView;
