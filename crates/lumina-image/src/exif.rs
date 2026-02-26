use crate::types::ExifSummary;
use anyhow::Result;
use exif::{In, Reader as ExifReader, Tag, Value};
use std::io::Cursor;

pub fn extract_exif_summary(bytes: &[u8]) -> Result<ExifSummary> {
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
        let dir = field
            .display_value()
            .with_unit(exif)
            .to_string()
            .to_uppercase();
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
