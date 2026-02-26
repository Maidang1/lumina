use crate::types::GeoRegion;
use chrono::Utc;
use std::time::Duration;

const REGION_RESOLVE_TIMEOUT_MS: u64 = 3000;

pub async fn resolve_region(lat: f64, lng: f64) -> Option<GeoRegion> {
    let client = reqwest::Client::builder()
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
        .header("User-Agent", "lumina-image/1.0")
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    #[derive(serde::Deserialize)]
    struct NominatimResponse {
        address: Option<NominatimAddress>,
    }

    #[derive(serde::Deserialize)]
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

    let payload = response.json::<NominatimResponse>().await.ok()?;
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
