use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::Path;
use std::time::Instant;
use std::time::Duration;

use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use exif::{In, Reader as ExifReader, Tag, Value};
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView, ImageFormat};
use rayon::prelude::*;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sha2::{Digest, Sha256};

const THUMB_VARIANT_SIZES: [u32; 3] = [400, 800, 1600];
const REGION_RESOLVE_TIMEOUT_MS: u64 = 3000;

fn get_upload_cache_dir() -> Result<std::path::PathBuf> {
    // 在 Tauri v2 中，使用 dirs 或手动构建缓存路径
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
#[serde(rename_all = "camelCase")]
pub struct ParseConfig {
    pub max_thumb_size: Option<u32>,
    pub thumb_quality: Option<f32>,
    pub blur_threshold: Option<f64>,
    pub enable_region_resolve: Option<bool>,
    pub generate_thumb_variants: Option<bool>,
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
    pub thumb_variants: HashMap<String, String>,  // size -> path
    pub metadata: JsonValue,
    pub format_report: FormatReport,
    pub stage_metrics: Vec<ProcessingTaskMetric>,
}

#[derive(Debug, Default)]
struct ExifSummary {
    make: Option<String>,
    model: Option<String>,
    lens_model: Option<String>,
    datetime_original: Option<String>,
    exposure_time: Option<f64>,
    f_number: Option<f64>,
    iso: Option<u32>,
    focal_length: Option<f64>,
    orientation: Option<u16>,
    software: Option<String>,
    artist: Option<String>,
    copyright: Option<String>,
    gps_latitude: Option<f64>,
    gps_longitude: Option<f64>,
}

#[derive(Debug, Serialize)]
struct GeoRegion {
    country: String,
    province: String,
    city: String,
    display_name: String,
    cache_key: String,
    source: String,
    resolved_at: String,
}

#[derive(Debug, Deserialize)]
struct NominatimReverseResponse {
    address: Option<NominatimAddress>,
}

#[derive(Debug, Deserialize)]
struct NominatimAddress {
    country: Option<String>,
    state: Option<String>,
    province: Option<String>,
    region: Option<String>,
    city: Option<String>,
    municipality: Option<String>,
    town: Option<String>,
    county: Option<String>,
}

#[tauri::command]
pub async fn parse_image_for_upload_from_path(
    path: String,
    declared_mime: Option<String>,
    config: Option<ParseConfig>,
) -> Result<ParseImageForUploadResult, String> {
    let bytes = fs::read(&path).map_err(|e| format!("failed to read file: {}", e))?;
    let file_name = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "upload.bin".to_string());
    let mime = declared_mime.unwrap_or_else(|| "application/octet-stream".to_string());
    parse_image_for_upload_impl(file_name, mime, bytes, config)
        .await
        .map_err(|e| e.to_string())
}

async fn parse_image_for_upload_impl(
    file_name: String,
    declared_mime: String,
    bytes: Vec<u8>,
    config: Option<ParseConfig>,
) -> Result<ParseImageForUploadResult> {
    let pipeline_start = Instant::now();
    let max_thumb_size = config.as_ref().and_then(|c| c.max_thumb_size).unwrap_or(1024);
    let thumb_quality = config
        .as_ref()
        .and_then(|c| c.thumb_quality)
        .unwrap_or(0.78)
        .clamp(0.1, 1.0);
    let blur_threshold = config
        .as_ref()
        .and_then(|c| c.blur_threshold)
        .unwrap_or(100.0);
    let enable_region_resolve = config
        .as_ref()
        .and_then(|c| c.enable_region_resolve)
        .unwrap_or(true);
    let generate_thumb_variants = config
        .as_ref()
        .and_then(|c| c.generate_thumb_variants)
        .unwrap_or(true);

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

    // Apply orientation correction early so both original and thumbnails are upright
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

    // 并行生成缩略图变体和计算派生属性
    let (width, height) = oriented_image.dimensions();
    let has_gps = exif_summary.gps_latitude.is_some() && exif_summary.gps_longitude.is_some();
    
    let parallel_results = rayon::join(
        || {
            // 并行生成缩略图变体
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
            // 并行计算派生属性
            rayon::join(
                || {
                    // 组1：主色和模糊度（使用 thumb_image）
                    let dominant = dominant_color_hex(&thumb_image);
                    let blur = variance_of_laplacian(&thumb_image, 128);
                    (dominant, blur)
                },
                || {
                    // 组2：phash 和 thumbhash（使用 thumb_image）
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
            json!({
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
    task_metrics.push(ProcessingTaskMetric {
        task_id: "derived".to_string(),
        status: "completed".to_string(),
        duration_ms: 0, // 将在后面更新
        degraded: None,
    });

    // 地理位置解析：默认跳过以提高性能，仅在明确启用时才执行
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

    Ok(ParseImageForUploadResult {
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
                format!("{} is not browser-display-safe; converted to image/jpeg", detected_mime)
            } else {
                "already browser-display-safe".to_string()
            },
        },
        stage_metrics: task_metrics,
    })
}

#[tauri::command]
pub async fn parse_image_for_upload_from_path_optimized(
    path: String,
    declared_mime: Option<String>,
    config: Option<ParseConfig>,
) -> Result<ParseImageForUploadResultOptimized, String> {
    let bytes = fs::read(&path).map_err(|e| format!("failed to read file: {}", e))?;
    let file_name = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "upload.bin".to_string());
    let mime = declared_mime.unwrap_or_else(|| "application/octet-stream".to_string());
    parse_image_for_upload_impl_optimized(file_name, mime, bytes, config)
        .await
        .map_err(|e| e.to_string())
}

async fn parse_image_for_upload_impl_optimized(
    file_name: String,
    declared_mime: String,
    bytes: Vec<u8>,
    config: Option<ParseConfig>,
) -> Result<ParseImageForUploadResultOptimized> {
    // 先调用原有的impl函数获取所有处理结果
    let result = parse_image_for_upload_impl(file_name, declared_mime.clone(), bytes, config).await?;
    
    // 获取缓存目录
    let cache_dir = get_upload_cache_dir()?;
    
    // 生成唯一的会话ID来分组这个批次的文件
    let session_id = uuid::Uuid::new_v4().to_string();
    let session_dir = cache_dir.join(&session_id);
    std::fs::create_dir_all(&session_dir)?;
    
    // 保存原始图片
    let normalized_original_path = session_dir.join(format!("original.jpg"));
    std::fs::write(&normalized_original_path, &result.normalized_original_bytes)?;
    
    // 保存缩略图
    let thumb_path = session_dir.join("thumb.webp");
    std::fs::write(&thumb_path, &result.thumb_bytes)?;
    
    // 保存缩略图变体
    let mut thumb_variants_paths = HashMap::new();
    for (size, bytes) in &result.thumb_variants {
        let variant_path = session_dir.join(format!("thumb_{}.webp", size));
        std::fs::write(&variant_path, bytes)?;
        thumb_variants_paths.insert(size.clone(), variant_path.to_string_lossy().to_string());
    }
    
    Ok(ParseImageForUploadResultOptimized {
        normalized_original_path: normalized_original_path.to_string_lossy().to_string(),
        normalized_original_mime: result.normalized_original_mime,
        normalized_original_filename: result.normalized_original_filename,
        thumb_path: thumb_path.to_string_lossy().to_string(),
        thumb_variants: thumb_variants_paths,
        metadata: result.metadata,
        format_report: result.format_report,
        stage_metrics: result.stage_metrics,
    })
}

fn build_metadata(
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
                "concurrency_profile": "desktop:rust",
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

async fn resolve_region(lat: f64, lng: f64) -> Option<GeoRegion> {
    let client = Client::builder()
        .timeout(Duration::from_millis(REGION_RESOLVE_TIMEOUT_MS))
        .build()
        .ok()?;

    let response = client
        .get("https://nominatim.openstreetmap.org/reverse")
        .query(&[
            ("format", "jsonv2"),
            ("lat", &lat.to_string()),
            ("lon", &lng.to_string()),
            ("zoom", "10"),
            ("addressdetails", "1"),
        ])
        .header("Accept-Language", "zh-CN,zh;q=0.95,en;q=0.8")
        .header("User-Agent", "lumina-desktop/1.0")
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    let payload = response.json::<NominatimReverseResponse>().await.ok()?;
    let address = payload.address?;

    let province = first_non_empty(&[
        address.state.as_deref(),
        address.province.as_deref(),
        address.region.as_deref(),
    ])?;
    let city = first_non_empty(&[
        address.city.as_deref(),
        address.municipality.as_deref(),
        address.town.as_deref(),
        address.county.as_deref(),
    ])
    .unwrap_or_else(|| province.clone());

    let country =
        first_non_empty(&[address.country.as_deref()]).unwrap_or_else(|| "China".to_string());
    let display_name = if city == province {
        province.clone()
    } else {
        format!("{}·{}", province, city)
    };

    Some(GeoRegion {
        country,
        province: province.clone(),
        city: city.clone(),
        display_name,
        cache_key: format!("CN|{}|{}", province, city),
        source: "nominatim".to_string(),
        resolved_at: Utc::now().to_rfc3339(),
    })
}

fn first_non_empty(values: &[Option<&str>]) -> Option<String> {
    values
        .iter()
        .flatten()
        .map(|v| v.trim())
        .find(|v| !v.is_empty())
        .map(|v| v.to_string())
}

fn detect_mime(bytes: &[u8], file_name: &str, declared_mime: &str) -> String {
    if let Some(kind) = infer::get(bytes) {
        let mime = kind.mime_type();
        if mime.starts_with("image/") {
            return mime.to_string();
        }
    }

    let lower = file_name.to_lowercase();
    if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        return "image/jpeg".to_string();
    }
    if lower.ends_with(".png") {
        return "image/png".to_string();
    }
    if lower.ends_with(".webp") {
        return "image/webp".to_string();
    }
    if lower.ends_with(".gif") {
        return "image/gif".to_string();
    }
    if lower.ends_with(".avif") {
        return "image/avif".to_string();
    }
    if lower.ends_with(".heic") {
        return "image/heic".to_string();
    }
    if lower.ends_with(".heif") {
        return "image/heif".to_string();
    }
    if lower.ends_with(".bmp") {
        return "image/bmp".to_string();
    }
    if lower.ends_with(".tif") || lower.ends_with(".tiff") {
        return "image/tiff".to_string();
    }

    if declared_mime.starts_with("image/") {
        return declared_mime.to_string();
    }

    "application/octet-stream".to_string()
}

fn is_browser_supported(mime: &str) -> bool {
    matches!(
        mime,
        "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/avif"
    )
}

fn decode_image(bytes: &[u8], mime: &str) -> Result<DynamicImage> {
    let guessed = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .context("failed to guess image format")?;
    if let Ok(img) = guessed.decode() {
        return Ok(img);
    }

    let format = match mime {
        "image/jpeg" => Some(ImageFormat::Jpeg),
        "image/png" => Some(ImageFormat::Png),
        "image/webp" => Some(ImageFormat::WebP),
        "image/gif" => Some(ImageFormat::Gif),
        "image/avif" => Some(ImageFormat::Avif),
        "image/bmp" => Some(ImageFormat::Bmp),
        "image/tiff" => Some(ImageFormat::Tiff),
        _ => None,
    };

    if let Some(fmt) = format {
        return image::load_from_memory_with_format(bytes, fmt)
            .context("failed to decode image by explicit format");
    }

    anyhow::bail!("unsupported image format: {}", mime)
}

fn apply_exif_orientation(image: &DynamicImage, orientation: Option<u16>) -> DynamicImage {
    match orientation.unwrap_or(1) {
        2 => image.fliph(),
        3 => image.rotate180(),
        4 => image.flipv(),
        5 => image.fliph().rotate90(),
        6 => image.rotate90(),
        7 => image.fliph().rotate270(),
        8 => image.rotate270(),
        _ => image.clone(),
    }
}

fn resize_inside(image: &DynamicImage, max_size: u32) -> DynamicImage {
    // 使用 Triangle 过滤器以提高速度，对于缩略图质量足够了
    let (w, h) = image.dimensions();
    if w <= max_size && h <= max_size {
        return image.clone();
    }
    image.resize(max_size, max_size, FilterType::Triangle)
}

fn encode_webp(image: &DynamicImage, quality: f32) -> Result<Vec<u8>> {
    let rgba = image.to_rgba8();
    let (w, h) = image.dimensions();
    let encoder = webp::Encoder::from_rgba(rgba.as_raw(), w, h);
    let q = (quality * 100.0).clamp(1.0, 100.0);
    Ok(encoder.encode(q).to_vec())
}

fn encode_jpeg(image: &DynamicImage, quality: u8) -> Result<Vec<u8>> {
    let rgb = image.to_rgb8();
    let (w, h) = image.dimensions();
    let mut out = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut out, quality);
    encoder
        .encode(&rgb, w, h, image::ColorType::Rgb8.into())
        .context("failed to encode jpeg")?;
    Ok(out)
}

fn sha256_with_prefix(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let hash = hasher.finalize();
    format!("sha256:{:x}", hash)
}

fn replace_extension(file_name: &str, ext: &str) -> String {
    if let Some((head, _)) = file_name.rsplit_once('.') {
        format!("{}.{}", head, ext)
    } else {
        format!("{}.{}", file_name, ext)
    }
}

fn extract_exif_summary(bytes: &[u8]) -> Result<ExifSummary> {
    let mut cursor = Cursor::new(bytes);
    let exif = ExifReader::new().read_from_container(&mut cursor)?;

    let mut summary = ExifSummary::default();
    summary.make = read_tag_string(&exif, Tag::Make, In::PRIMARY);
    summary.model = read_tag_string(&exif, Tag::Model, In::PRIMARY);
    summary.lens_model = read_tag_string(&exif, Tag::LensModel, In::PRIMARY);
    summary.datetime_original = read_tag_string(&exif, Tag::DateTimeOriginal, In::PRIMARY);
    summary.exposure_time = read_tag_rational(&exif, Tag::ExposureTime, In::PRIMARY);
    summary.f_number = read_tag_rational(&exif, Tag::FNumber, In::PRIMARY);
    summary.iso = read_tag_u32(&exif, Tag::PhotographicSensitivity, In::PRIMARY);
    summary.focal_length = read_tag_rational(&exif, Tag::FocalLength, In::PRIMARY);
    summary.orientation = read_tag_u16(&exif, Tag::Orientation, In::PRIMARY);
    summary.software = read_tag_string(&exif, Tag::Software, In::PRIMARY);
    summary.artist = read_tag_string(&exif, Tag::Artist, In::PRIMARY);
    summary.copyright = read_tag_string(&exif, Tag::Copyright, In::PRIMARY);

    let gps_lat = read_gps_coordinate(&exif, true);
    let gps_lng = read_gps_coordinate(&exif, false);
    summary.gps_latitude = gps_lat;
    summary.gps_longitude = gps_lng;

    Ok(summary)
}

fn read_tag_string(exif: &exif::Exif, tag: Tag, ifd: In) -> Option<String> {
    exif.get_field(tag, ifd)
        .map(|f| f.display_value().with_unit(exif).to_string())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn read_tag_rational(exif: &exif::Exif, tag: Tag, ifd: In) -> Option<f64> {
    let field = exif.get_field(tag, ifd)?;
    match &field.value {
        Value::Rational(values) if !values.is_empty() => {
            let v = values[0];
            if v.denom == 0 {
                None
            } else {
                Some(v.num as f64 / v.denom as f64)
            }
        }
        Value::SRational(values) if !values.is_empty() => {
            let v = values[0];
            if v.denom == 0 {
                None
            } else {
                Some(v.num as f64 / v.denom as f64)
            }
        }
        _ => None,
    }
}

fn read_tag_u16(exif: &exif::Exif, tag: Tag, ifd: In) -> Option<u16> {
    let field = exif.get_field(tag, ifd)?;
    match &field.value {
        Value::Short(values) if !values.is_empty() => Some(values[0]),
        _ => None,
    }
}

fn read_tag_u32(exif: &exif::Exif, tag: Tag, ifd: In) -> Option<u32> {
    let field = exif.get_field(tag, ifd)?;
    match &field.value {
        Value::Short(values) if !values.is_empty() => Some(values[0] as u32),
        Value::Long(values) if !values.is_empty() => Some(values[0]),
        _ => None,
    }
}

fn read_gps_coordinate(exif: &exif::Exif, latitude: bool) -> Option<f64> {
    let (coord_tag, ref_tag) = if latitude {
        (Tag::GPSLatitude, Tag::GPSLatitudeRef)
    } else {
        (Tag::GPSLongitude, Tag::GPSLongitudeRef)
    };

    let coord_field = exif.get_field(coord_tag, In::PRIMARY)?;
    let ref_field = exif.get_field(ref_tag, In::PRIMARY);

    let values = match &coord_field.value {
        Value::Rational(v) if v.len() >= 3 => v,
        _ => return None,
    };

    let deg = rational_to_f64(values[0])?;
    let min = rational_to_f64(values[1])?;
    let sec = rational_to_f64(values[2])?;
    let mut out = deg + min / 60.0 + sec / 3600.0;

    if let Some(field) = ref_field {
        let dir = field.display_value().with_unit(exif).to_string().to_uppercase();
        if dir.contains('S') || dir.contains('W') {
            out = -out;
        }
    }

    Some(out)
}

fn rational_to_f64(v: exif::Rational) -> Option<f64> {
    if v.denom == 0 {
        return None;
    }
    Some(v.num as f64 / v.denom as f64)
}

fn dominant_color_hex(image: &DynamicImage) -> String {
    let sample = image.resize(32, 32, FilterType::Triangle).to_rgb8();
    let mut hist: HashMap<u16, usize> = HashMap::new();

    for px in sample.pixels() {
        let r = (px[0] >> 4) as u16;
        let g = (px[1] >> 4) as u16;
        let b = (px[2] >> 4) as u16;
        let key = (r << 8) | (g << 4) | b;
        *hist.entry(key).or_insert(0) += 1;
    }

    let best = hist
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(k, _)| k)
        .unwrap_or(0x888);

    let r = ((best >> 8) & 0x0f) as u8 * 17;
    let g = ((best >> 4) & 0x0f) as u8 * 17;
    let b = (best & 0x0f) as u8 * 17;
    format!("#{:02x}{:02x}{:02x}", r, g, b)
}

fn variance_of_laplacian(image: &DynamicImage, sample_size: u32) -> f64 {
    let gray = image
        .resize(sample_size, sample_size, FilterType::Triangle)
        .to_luma8();

    let (w, h) = gray.dimensions();
    if w < 3 || h < 3 {
        return 0.0;
    }

    let mut values = Vec::with_capacity(((w - 2) * (h - 2)) as usize);
    for y in 1..(h - 1) {
        for x in 1..(w - 1) {
            let c = gray.get_pixel(x, y)[0] as f64;
            let t = gray.get_pixel(x, y - 1)[0] as f64;
            let l = gray.get_pixel(x - 1, y)[0] as f64;
            let r = gray.get_pixel(x + 1, y)[0] as f64;
            let b = gray.get_pixel(x, y + 1)[0] as f64;
            values.push(t + l - 4.0 * c + r + b);
        }
    }

    if values.is_empty() {
        return 0.0;
    }

    let mean = values.iter().sum::<f64>() / values.len() as f64;
    values
        .iter()
        .map(|v| {
            let d = v - mean;
            d * d
        })
        .sum::<f64>()
        / values.len() as f64
}

fn blockhash16(image: &DynamicImage) -> String {
    let small = image.resize_exact(16, 16, FilterType::Triangle).to_luma8();
    let mut block_sums = [0f64; 16];
    for by in 0..4 {
        for bx in 0..4 {
            let mut sum = 0f64;
            for y in 0..4 {
                for x in 0..4 {
                    let px = small.get_pixel(bx * 4 + x, by * 4 + y)[0] as f64;
                    sum += px;
                }
            }
            block_sums[(by * 4 + bx) as usize] = sum;
        }
    }

    let mut sorted = block_sums;
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median = (sorted[7] + sorted[8]) / 2.0;

    let mut bits: u16 = 0;
    for (idx, val) in block_sums.iter().enumerate() {
        if *val >= median {
            bits |= 1 << (15 - idx);
        }
    }

    format!("{:04x}", bits)
}

fn build_thumbhash(image: &DynamicImage) -> Option<String> {
    let (w, h) = image.dimensions();
    if w == 0 || h == 0 {
        return None;
    }

    let max_dimension = 100u32;
    let ratio = (max_dimension as f32 / w.max(h) as f32).min(1.0);
    let tw = ((w as f32 * ratio).round().max(1.0)) as u32;
    let th = ((h as f32 * ratio).round().max(1.0)) as u32;

    let resized = image.resize_exact(tw, th, FilterType::Triangle).to_rgba8();
    let hash = thumbhash::rgba_to_thumb_hash(tw as usize, th as usize, resized.as_raw());
    Some(BASE64.encode(hash))
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

// ============ 优化的上传命令 ============

#[derive(Debug, Deserialize)]
pub struct CacheUploadRequest {
    pub image_id: String,
    pub original_path: String,
    pub original_mime: String,
    pub thumb_path: String,
    pub thumb_variants: HashMap<String, String>,  // size -> path
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
    
    // 并行读取所有文件，避免串行 I/O
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
    
    // 获取 GitHub manager 并上传
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

