use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditDraft {
    pub description: Option<String>,
    pub original_filename: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeMetadataRequest {
    pub metadata: JsonValue,
    pub edit_draft: EditDraft,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergedMetadata {
    pub metadata: JsonValue,
    pub validation_warnings: Vec<String>,
}

/// 合并和验证单个元数据
#[tauri::command]
pub fn merge_and_validate_metadata(
    request: MergeMetadataRequest,
) -> Result<MergedMetadata, String> {
    let mut metadata = request.metadata;
    let mut warnings = Vec::new();

    // 确保 metadata 是一个对象
    let metadata_obj = metadata
        .as_object_mut()
        .ok_or_else(|| "Metadata must be an object".to_string())?;

    // 合并 description
    if let Some(desc) = request.edit_draft.description {
        let trimmed = desc.trim();
        if trimmed.len() > 5000 {
            warnings.push("Description exceeds 5000 characters, will be truncated".to_string());
            metadata_obj.insert("description".to_string(), JsonValue::String(trimmed[..5000].to_string()));
        } else {
            metadata_obj.insert("description".to_string(), JsonValue::String(trimmed.to_string()));
        }
    } else {
        // 如果没有提供，确保设置为空字符串
        if !metadata_obj.contains_key("description") {
            metadata_obj.insert("description".to_string(), JsonValue::String("".to_string()));
        }
    }

    // 合并 original_filename
    if let Some(filename) = request.edit_draft.original_filename {
        let trimmed = filename.trim();
        if !trimmed.is_empty() {
            if trimmed.len() > 255 {
                warnings.push("Filename exceeds 255 characters, will be truncated".to_string());
                metadata_obj.insert("original_filename".to_string(), JsonValue::String(trimmed[..255].to_string()));
            } else {
                metadata_obj.insert("original_filename".to_string(), JsonValue::String(trimmed.to_string()));
            }
        } else {
            warnings.push("Filename is empty after trimming".to_string());
        }
    }

    // 合并 category
    if let Some(cat) = request.edit_draft.category {
        let trimmed = cat.trim();
        if trimmed.len() > 100 {
            warnings.push("Category exceeds 100 characters, will be truncated".to_string());
            metadata_obj.insert("category".to_string(), JsonValue::String(trimmed[..100].to_string()));
        } else {
            metadata_obj.insert("category".to_string(), JsonValue::String(trimmed.to_string()));
        }
    } else {
        // 如果没有提供，确保设置为空字符串
        if !metadata_obj.contains_key("category") {
            metadata_obj.insert("category".to_string(), JsonValue::String("".to_string()));
        }
    }

    // 验证必需字段
    if !metadata_obj.contains_key("image_id") {
        return Err("Missing required field: image_id".to_string());
    }
    if !metadata_obj.contains_key("schema_version") {
        return Err("Missing required field: schema_version".to_string());
    }

    Ok(MergedMetadata {
        metadata,
        validation_warnings: warnings,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchMergeRequest {
    pub items: Vec<MergeMetadataRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchMergeResult {
    pub results: Vec<MergedMetadata>,
    pub total_warnings: usize,
}

/// 批量合并和验证元数据（并行处理）
#[tauri::command]
pub fn batch_merge_and_validate_metadata(
    request: BatchMergeRequest,
) -> Result<BatchMergeResult, String> {
    use rayon::prelude::*;

    let results: Vec<Result<MergedMetadata, String>> = request
        .items
        .into_par_iter()
        .map(|item| merge_and_validate_metadata(item))
        .collect();

    // 收集所有成功的结果
    let mut merged_results = Vec::new();
    let mut total_warnings = 0;

    for result in results {
        match result {
            Ok(merged) => {
                total_warnings += merged.validation_warnings.len();
                merged_results.push(merged);
            }
            Err(e) => {
                return Err(format!("Batch validation failed: {}", e));
            }
        }
    }

    Ok(BatchMergeResult {
        results: merged_results,
        total_warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_merge_metadata_basic() {
        let metadata = json!({
            "schema_version": "1.3",
            "image_id": "test123",
            "description": "old description",
            "category": "",
        });

        let draft = EditDraft {
            description: Some("  new description  ".to_string()),
            original_filename: Some("test.jpg".to_string()),
            category: Some("  Nature  ".to_string()),
        };

        let request = MergeMetadataRequest {
            metadata,
            edit_draft: draft,
        };

        let result = merge_and_validate_metadata(request).unwrap();
        let obj = result.metadata.as_object().unwrap();

        assert_eq!(obj.get("description").unwrap().as_str().unwrap(), "new description");
        assert_eq!(obj.get("original_filename").unwrap().as_str().unwrap(), "test.jpg");
        assert_eq!(obj.get("category").unwrap().as_str().unwrap(), "Nature");
        assert_eq!(result.validation_warnings.len(), 0);
    }

    #[test]
    fn test_merge_metadata_truncation() {
        let metadata = json!({
            "schema_version": "1.3",
            "image_id": "test123",
        });

        let long_desc = "a".repeat(6000);
        let draft = EditDraft {
            description: Some(long_desc),
            original_filename: None,
            category: None,
        };

        let request = MergeMetadataRequest {
            metadata,
            edit_draft: draft,
        };

        let result = merge_and_validate_metadata(request).unwrap();
        assert!(result.validation_warnings.len() > 0);
        assert!(result.validation_warnings[0].contains("5000 characters"));
    }

    #[test]
    fn test_merge_metadata_missing_required() {
        let metadata = json!({
            "description": "test",
        });

        let draft = EditDraft {
            description: None,
            original_filename: None,
            category: None,
        };

        let request = MergeMetadataRequest {
            metadata,
            edit_draft: draft,
        };

        let result = merge_and_validate_metadata(request);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("image_id"));
    }
}
