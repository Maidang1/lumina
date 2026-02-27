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
use image::{DynamicImage, GenericImageView};
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
    let parse_profile = config.parse_profile.unwrap_or_default();
    let max_thumb_size = config.max_thumb_size.unwrap_or(1024);
    let thumb_quality = config.thumb_quality.unwrap_or(0.78).clamp(0.1, 1.0);
    let blur_threshold = config.blur_threshold.unwrap_or(100.0);
    let enable_region_resolve = config.enable_region_resolve.unwrap_or(match parse_profile {
        ParseProfile::Turbo => false,
        ParseProfile::Quality => false,
    });
    let generate_thumb_variants = config.generate_thumb_variants.unwrap_or(match parse_profile {
        ParseProfile::Turbo => false,
        ParseProfile::Quality => true,
    });
    let webp_method = match parse_profile {
        ParseProfile::Turbo => 3,
        ParseProfile::Quality => 4,
    };

    let mut task_metrics: Vec<ProcessingTaskMetric> = Vec::new();
    let mut input_bytes = bytes;

    let t_format = Instant::now();
    let detected_mime = detect_mime(&input_bytes, &file_name, &declared_mime);
    let should_convert = !is_browser_supported(&detected_mime);
    task_metrics.push(ProcessingTaskMetric {
        task_id: "format_validate".to_string(),
        status: "completed".to_string(),
        duration_ms: t_format.elapsed().as_millis() as u64,
        degraded: None,
    });

    let ((decode_result, decode_ms), (exif_result, exif_ms)) = rayon::join(
        || {
            let t_decode = Instant::now();
            let result = decode_image(&input_bytes, &detected_mime);
            (result, t_decode.elapsed().as_millis() as u64)
        },
        || {
            let t_exif = Instant::now();
            let result = extract_exif_summary(&input_bytes);
            (result, t_exif.elapsed().as_millis() as u64)
        },
    );
    let source_image = decode_result
        .with_context(|| format!("unsupported/invalid image format: {}", detected_mime))?;
    let exif_summary = exif_result.unwrap_or_default();
    task_metrics.push(ProcessingTaskMetric {
        task_id: "decode".to_string(),
        status: "completed".to_string(),
        duration_ms: decode_ms,
        degraded: None,
    });
    task_metrics.push(ProcessingTaskMetric {
        task_id: "exif".to_string(),
        status: "completed".to_string(),
        duration_ms: exif_ms,
        degraded: None,
    });

    let orientation = exif_summary.orientation;
    let needs_orientation = orientation.map_or(false, |o| o != 1);
    let oriented_image = if needs_orientation {
        apply_exif_orientation(&source_image, orientation)
    } else {
        source_image
    };

    let t_normalize = Instant::now();
    let bake_orientation_into_original = !matches!(parse_profile, ParseProfile::Turbo);
    let can_skip_normalize = is_browser_supported(&detected_mime)
        && (!needs_orientation || !bake_orientation_into_original);
    let (
        normalized_original_bytes,
        normalized_original_mime,
        normalized_original_filename,
        actually_converted,
        used_original_bytes_directly,
    ) =
        if can_skip_normalize {
            (
                std::mem::take(&mut input_bytes),
                detected_mime.clone(),
                file_name.clone(),
                false,
                true,
            )
        } else {
            let quality = if should_convert { 90 } else { 95 };
            let encoded = encode_jpeg(&oriented_image, quality)?;
            (
                encoded,
                "image/jpeg".to_string(),
                replace_extension(&file_name, "jpg"),
                true,
                false,
            )
        };
    task_metrics.push(ProcessingTaskMetric {
        task_id: "normalize_original".to_string(),
        status: if can_skip_normalize { "skipped" } else { "completed" }.to_string(),
        duration_ms: t_normalize.elapsed().as_millis() as u64,
        degraded: None,
    });

    let t_hash = Instant::now();
    let hash_source = if used_original_bytes_directly {
        normalized_original_bytes.as_slice()
    } else {
        input_bytes.as_slice()
    };
    let image_id = sha256_with_prefix(hash_source);
    task_metrics.push(ProcessingTaskMetric {
        task_id: "hash".to_string(),
        status: "completed".to_string(),
        duration_ms: t_hash.elapsed().as_millis() as u64,
        degraded: None,
    });

    let t_thumb = Instant::now();
    let (width, height) = oriented_image.dimensions();
    let has_gps = exif_summary.gps_latitude.is_some() && exif_summary.gps_longitude.is_some();

    let cascaded_images = generate_cascaded_thumbnails(&oriented_image, max_thumb_size, generate_thumb_variants);

    let thumb_image = &cascaded_images.main_thumb;
    let thumb_bytes = encode_webp_with_method(thumb_image, thumb_quality, webp_method)?;
    let (thumb_w, thumb_h) = thumb_image.dimensions();

    let variant_images = &cascaded_images.variants;

    let parallel_results = rayon::join(
        || {
            if generate_thumb_variants {
                let variant_results: Result<Vec<(u32, u32, u32, Vec<u8>)>> = variant_images
                    .par_iter()
                    .map(|(size, img)| {
                        let (vw, vh) = img.dimensions();
                        let variant_bytes = encode_webp_with_method(img, thumb_quality, webp_method)?;
                        Ok((*size, vw, vh, variant_bytes))
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
                    let dominant = dominant_color_hex(thumb_image);
                    let blur = variance_of_laplacian(thumb_image, 128);
                    (dominant, blur)
                },
                || {
                    let phash = blockhash16(thumb_image);
                    let thash = build_thumbhash(thumb_image);
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
            converted: actually_converted,
            reason: if actually_converted {
                format!(
                    "{} converted to image/jpeg (format unsupported or orientation applied)",
                    detected_mime
                )
            } else {
                "already browser-display-safe, no conversion needed".to_string()
            },
        },
        stage_metrics: task_metrics,
    })
}

struct CascadedThumbnails {
    main_thumb: DynamicImage,
    variants: Vec<(u32, DynamicImage)>,
}

fn generate_cascaded_thumbnails(
    source: &DynamicImage,
    max_thumb_size: u32,
    generate_variants: bool,
) -> CascadedThumbnails {
    let (w, h) = source.dimensions();
    let max_dim = w.max(h);

    if !generate_variants {
        let main_thumb = resize_inside(source, max_thumb_size);
        return CascadedThumbnails {
            main_thumb,
            variants: Vec::new(),
        };
    }

    let mut sorted_sizes: Vec<u32> = THUMB_VARIANT_SIZES
        .iter()
        .copied()
        .filter(|&s| s < max_dim)
        .collect();
    sorted_sizes.sort_by(|a, b| b.cmp(a));

    let mut variants: Vec<(u32, DynamicImage)> = Vec::with_capacity(sorted_sizes.len());
    for size in &sorted_sizes {
        let resized = if let Some((_, previous)) = variants.last() {
            resize_inside(previous, *size)
        } else {
            resize_inside(source, *size)
        };
        variants.push((*size, resized));
    }

    let main_thumb = if max_thumb_size < *sorted_sizes.last().unwrap_or(&max_dim) {
        if let Some((_, smallest_variant)) = variants.last() {
            resize_inside(smallest_variant, max_thumb_size)
        } else {
            resize_inside(source, max_thumb_size)
        }
    } else if let Some((_, img)) = variants.iter().find(|(s, _)| *s <= max_thumb_size) {
        img.clone()
    } else {
        resize_inside(source, max_thumb_size)
    };

    CascadedThumbnails {
        main_thumb,
        variants,
    }
}

fn replace_extension(file_name: &str, ext: &str) -> String {
    if let Some((head, _)) = file_name.rsplit_once('.') {
        format!("{}.{}", head, ext)
    } else {
        format!("{}.{}", file_name, ext)
    }
}
