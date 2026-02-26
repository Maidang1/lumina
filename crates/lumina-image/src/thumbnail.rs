use anyhow::{Context, Result};
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView};
use std::collections::HashMap;

pub fn resize_inside(image: &DynamicImage, max_size: u32) -> DynamicImage {
    let (w, h) = image.dimensions();
    if w <= max_size && h <= max_size {
        return image.clone();
    }
    image.resize(max_size, max_size, FilterType::Triangle)
}

pub fn encode_webp(image: &DynamicImage, quality: f64) -> Result<Vec<u8>> {
    let rgba = image.to_rgba8();
    let (w, h) = image.dimensions();
    let encoder = webp::Encoder::from_rgba(rgba.as_raw(), w, h);
    let q = (quality * 100.0).clamp(1.0, 100.0) as f32;
    let config = webp::WebPConfig::new().map_err(|_| anyhow::anyhow!("failed to create webp config"))?;
    Ok(encoder.encode_advanced(&config).map(|m| m.to_vec()).unwrap_or_else(|_| encoder.encode(q).to_vec()))
}

pub fn encode_jpeg(image: &DynamicImage, quality: u8) -> Result<Vec<u8>> {
    let rgb = image.to_rgb8();
    let (w, h) = image.dimensions();
    let mut out = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut out, quality);
    encoder
        .encode(&rgb, w, h, image::ExtendedColorType::Rgb8)
        .context("failed to encode jpeg")?;
    Ok(out)
}

pub fn dominant_color_hex(image: &DynamicImage) -> String {
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

pub fn variance_of_laplacian(image: &DynamicImage, sample_size: u32) -> f64 {
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
