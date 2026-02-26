use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::{imageops::FilterType, DynamicImage, GenericImageView};
use sha2::{Digest, Sha256};

pub fn sha256_with_prefix(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let hash = hasher.finalize();
    format!("sha256:{:x}", hash)
}

pub fn blockhash16(image: &DynamicImage) -> String {
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

pub fn build_thumbhash(image: &DynamicImage) -> Option<String> {
    let (w, h) = image.dimensions();
    if w == 0 || h == 0 {
        return None;
    }

    let max_dimension = 100u32;
    let ratio = (max_dimension as f32 / w.max(h) as f32).min(1.0);
    let tw = ((w as f32 * ratio).round().max(1.0)) as u32;
    let th = ((h as f32 * ratio).round().max(1.0)) as u32;

    let resized = image
        .resize_exact(tw, th, FilterType::Triangle)
        .to_rgba8();
    let hash = thumbhash::rgba_to_thumb_hash(tw as usize, th as usize, resized.as_raw());
    Some(BASE64.encode(hash))
}

pub fn compute_thumbhash_from_rgba(width: u32, height: u32, rgba: &[u8]) -> Option<String> {
    if width == 0 || height == 0 || rgba.len() != (width * height * 4) as usize {
        return None;
    }
    let hash = thumbhash::rgba_to_thumb_hash(width as usize, height as usize, rgba);
    Some(BASE64.encode(hash))
}
