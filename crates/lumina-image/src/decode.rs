use anyhow::{Context, Result};
use image::{DynamicImage, ImageFormat};
use std::io::Cursor;

pub fn detect_mime(bytes: &[u8], file_name: &str, declared_mime: &str) -> String {
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

pub fn is_browser_supported(mime: &str) -> bool {
    matches!(
        mime,
        "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/avif"
    )
}

pub fn decode_image(bytes: &[u8], mime: &str) -> Result<DynamicImage> {
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

pub fn apply_exif_orientation(image: &DynamicImage, orientation: Option<u16>) -> DynamicImage {
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
