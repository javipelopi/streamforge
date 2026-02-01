//! Acestream Sources Commands
//!
//! Tauri commands for managing Acestream P2P stream sources.
//! Multi-Source Stream Support feature.

use chrono::Utc;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::acestream::{
    build_acestream_url, get_acestream_status, parse_acestream_url, AcestreamStatus,
};
use crate::db::models::{AcestreamSource, NewAcestreamSource};
use crate::db::schema::acestream_sources;
use crate::db::DbConnection;

// ============================================================================
// Response Types
// ============================================================================

/// Acestream source for frontend display
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcestreamSourceResponse {
    pub id: i32,
    pub name: String,
    pub content_id: String,
    pub is_active: bool,
    pub created_at: String,
    /// Pre-computed stream URL for display
    pub stream_url: Option<String>,
    /// "linked" | "orphan" | "promoted"
    pub link_status: String,
    /// XMLTV channel IDs this source is linked to
    pub linked_xmltv_ids: Vec<i32>,
}

/// Input for adding a new Acestream source
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddAcestreamSourceInput {
    pub name: String,
    /// Can be either content ID or acestream:// URL
    pub content_id_or_url: String,
}

// ============================================================================
// Commands
// ============================================================================

/// Get Acestream platform status.
///
/// Returns whether Acestream is supported on this platform and if the engine is running.
///
/// # Returns
///
/// Acestream status including platform support and engine availability
#[tauri::command]
pub async fn check_acestream_status() -> Result<AcestreamStatus, String> {
    Ok(get_acestream_status().await)
}

/// Add a new Acestream source.
///
/// # Arguments
///
/// * `input` - Acestream source details (name, content ID or acestream:// URL)
///
/// # Returns
///
/// The created Acestream source
#[tauri::command]
pub fn add_acestream_source(
    db: State<DbConnection>,
    input: AddAcestreamSourceInput,
) -> Result<AcestreamSourceResponse, String> {
    // Validate input
    if input.name.trim().is_empty() {
        return Err("Source name cannot be empty".to_string());
    }

    // Parse content ID from URL or use directly
    // Content IDs are normalized to lowercase for consistent storage
    let content_id = if input.content_id_or_url.starts_with("acestream://") {
        parse_acestream_url(&input.content_id_or_url)
            .ok_or("Invalid acestream:// URL format")?
    } else {
        // Validate as content ID (40 hex chars) and normalize to lowercase
        let id = input.content_id_or_url.trim().to_lowercase();
        if id.len() != 40 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(
                "Invalid content ID. Must be 40 hexadecimal characters or an acestream:// URL"
                    .to_string(),
            );
        }
        id
    };

    let mut conn = db
        .get_connection()
        .map_err(|e| {
            tracing::error!("Database connection error in add_acestream_source: {}", e);
            "Database connection unavailable. Please try again.".to_string()
        })?;

    // Issue 4: Wrap duplicate check and insert in transaction to prevent TOCTOU race
    let source = conn.transaction::<AcestreamSource, diesel::result::Error, _>(|conn| {
        // Check if content ID already exists
        let existing: Option<AcestreamSource> = acestream_sources::table
            .filter(acestream_sources::content_id.eq(&content_id))
            .first(conn)
            .optional()?;

        if existing.is_some() {
            return Err(diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                Box::new("An Acestream source with this content ID already exists".to_string()),
            ));
        }

        // Create the source
        let new_source = NewAcestreamSource {
            name: input.name.trim().to_string(),
            content_id: content_id.clone(),
            is_active: 1,
        };

        diesel::insert_into(acestream_sources::table)
            .values(&new_source)
            .execute(conn)?;

        // Get the inserted source by unique content_id
        acestream_sources::table
            .filter(acestream_sources::content_id.eq(&content_id))
            .first(conn)
    }).map_err(|e| match e {
        diesel::result::Error::DatabaseError(diesel::result::DatabaseErrorKind::UniqueViolation, msg) => {
            msg.message().to_string()
        }
        _ => {
            tracing::error!("Failed to create Acestream source in add_acestream_source: {}", e);
            "Failed to create Acestream source. Please try again.".to_string()
        }
    })?;

    let source_id = source.id.ok_or("Source ID is null")?;

    // Build stream URL if platform supports it
    let stream_url = build_acestream_url(&content_id).ok();

    Ok(AcestreamSourceResponse {
        id: source_id,
        name: source.name,
        content_id: source.content_id,
        is_active: source.is_active != 0,
        created_at: source.created_at,
        stream_url,
        link_status: "orphan".to_string(), // Newly added sources are always orphans
        linked_xmltv_ids: vec![],
    })
}

/// Get all Acestream sources.
///
/// # Returns
///
/// List of Acestream sources
#[tauri::command]
pub fn get_acestream_sources(
    db: State<DbConnection>,
) -> Result<Vec<AcestreamSourceResponse>, String> {
    use crate::db::schema::{channel_mappings, xmltv_channels};

    let mut conn = db
        .get_connection()
        .map_err(|e| {
            tracing::error!("Database connection error in get_acestream_sources: {}", e);
            "Database connection unavailable. Please try again.".to_string()
        })?;

    let sources: Vec<AcestreamSource> = acestream_sources::table
        .order_by(acestream_sources::name.asc())
        .load(&mut conn)
        .map_err(|e| {
            tracing::error!("Database query error in get_acestream_sources: {}", e);
            "Failed to load Acestream sources. Please try again.".to_string()
        })?;

    // Get all channel mappings for Acestream sources
    let source_ids: Vec<i32> = sources.iter().filter_map(|s| s.id).collect();

    let mappings: Vec<(Option<i32>, i32)> = channel_mappings::table
        .filter(channel_mappings::acestream_source_id.is_not_null())
        .filter(channel_mappings::acestream_source_id.eq_any(&source_ids))
        .select((
            channel_mappings::acestream_source_id,
            channel_mappings::xmltv_channel_id,
        ))
        .load(&mut conn)
        .unwrap_or_default();

    // Check which xmltv_channels are synthetic (promoted)
    let xmltv_ids: Vec<i32> = mappings.iter().map(|(_, xmltv_id)| *xmltv_id).collect();
    let synthetic_ids: Vec<i32> = xmltv_channels::table
        .filter(xmltv_channels::id.eq_any(&xmltv_ids))
        .filter(xmltv_channels::is_synthetic.eq(1))
        .select(xmltv_channels::id)
        .load::<Option<i32>>(&mut conn)
        .unwrap_or_default()
        .into_iter()
        .flatten()
        .collect();

    // Build a map of acestream_source_id -> (linked_xmltv_ids, has_synthetic)
    let mut link_map: std::collections::HashMap<i32, (Vec<i32>, bool)> = std::collections::HashMap::new();
    for (acestream_id_opt, xmltv_id) in mappings {
        if let Some(acestream_id) = acestream_id_opt {
            let entry = link_map.entry(acestream_id).or_insert_with(|| (Vec::new(), false));
            entry.0.push(xmltv_id);
            if synthetic_ids.contains(&xmltv_id) {
                entry.1 = true;
            }
        }
    }

    let result: Vec<AcestreamSourceResponse> = sources
        .into_iter()
        .filter_map(|source| {
            // Issue 5: Log warning when filtering out sources with null IDs
            let source_id = match source.id {
                Some(id) => id,
                None => {
                    tracing::warn!(
                        "Acestream source with content_id '{}' has null ID, skipping",
                        source.content_id
                    );
                    return None;
                }
            };
            let stream_url = build_acestream_url(&source.content_id).ok();

            let (linked_xmltv_ids, has_synthetic) = link_map
                .get(&source_id)
                .cloned()
                .unwrap_or_else(|| (Vec::new(), false));

            let link_status = if has_synthetic {
                "promoted".to_string()
            } else if !linked_xmltv_ids.is_empty() {
                "linked".to_string()
            } else {
                "orphan".to_string()
            };

            Some(AcestreamSourceResponse {
                id: source_id,
                name: source.name,
                content_id: source.content_id,
                is_active: source.is_active != 0,
                created_at: source.created_at,
                stream_url,
                link_status,
                linked_xmltv_ids,
            })
        })
        .collect();

    Ok(result)
}

/// Delete an Acestream source.
///
/// # Arguments
///
/// * `source_id` - The Acestream source ID to delete
#[tauri::command]
pub fn delete_acestream_source(db: State<DbConnection>, source_id: i32) -> Result<(), String> {
    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| {
            tracing::error!("Database connection error in delete_acestream_source: {}", e);
            "Database connection unavailable. Please try again.".to_string()
        })?;

    let deleted =
        diesel::delete(acestream_sources::table.filter(acestream_sources::id.eq(source_id)))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to delete Acestream source {}: {}", source_id, e);
                "Failed to delete Acestream source. Please try again.".to_string()
            })?;

    if deleted == 0 {
        return Err("Acestream source not found".to_string());
    }

    Ok(())
}

/// Toggle Acestream source active status.
///
/// # Arguments
///
/// * `source_id` - The Acestream source ID
/// * `is_active` - New active status
#[tauri::command]
pub fn toggle_acestream_source(
    db: State<DbConnection>,
    source_id: i32,
    is_active: bool,
) -> Result<(), String> {
    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    let mut conn = db
        .get_connection()
        .map_err(|e| {
            tracing::error!("Database connection error in toggle_acestream_source: {}", e);
            "Database connection unavailable. Please try again.".to_string()
        })?;

    let updated =
        diesel::update(acestream_sources::table.filter(acestream_sources::id.eq(source_id)))
            .set((
                acestream_sources::is_active.eq(if is_active { 1 } else { 0 }),
                acestream_sources::updated_at.eq(Utc::now().to_rfc3339()),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to toggle Acestream source {}: {}", source_id, e);
                "Failed to update Acestream source. Please try again.".to_string()
            })?;

    if updated == 0 {
        return Err("Acestream source not found".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_acestream_input_validation() {
        // Test name validation
        let input = AddAcestreamSourceInput {
            name: "  ".to_string(),
            content_id_or_url: "1234567890abcdef1234567890abcdef12345678".to_string(),
        };
        assert!(input.name.trim().is_empty());
    }

    #[test]
    fn test_acestream_source_response_serialization() {
        let source = AcestreamSourceResponse {
            id: 1,
            name: "Test Stream".to_string(),
            content_id: "1234567890abcdef1234567890abcdef12345678".to_string(),
            is_active: true,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            stream_url: Some("http://127.0.0.1:6878/ace/getstream?id=1234567890abcdef1234567890abcdef12345678".to_string()),
        };

        let json = serde_json::to_string(&source).unwrap();
        assert!(json.contains("\"isActive\":true"));
        assert!(json.contains("\"contentId\""));
    }
}
