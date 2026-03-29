//! Acestream service — acestream source CRUD operations.
//!
//! Extracted from `commands/acestream_sources.rs`.

use chrono::Utc;
use diesel::prelude::*;

use crate::acestream::{build_acestream_url, parse_acestream_url};
use crate::types::{
    AcestreamSourceResponse, AddAcestreamSourceInput, UpdateAcestreamSourceInput,
};
use crate::db::models::{AcestreamSource, NewAcestreamSource};
use crate::db::schema::acestream_sources;

/// Add a new Acestream source.
pub fn add_acestream_source(
    conn: &mut SqliteConnection,
    input: &AddAcestreamSourceInput,
) -> Result<AcestreamSourceResponse, String> {
    if input.name.trim().is_empty() {
        return Err("Source name cannot be empty".to_string());
    }

    let content_id = if input.content_id_or_url.starts_with("acestream://") {
        parse_acestream_url(&input.content_id_or_url)
            .ok_or("Invalid acestream:// URL format")?
    } else {
        let id = input.content_id_or_url.trim().to_lowercase();
        if id.len() != 40 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(
                "Invalid content ID. Must be 40 hexadecimal characters or an acestream:// URL"
                    .to_string(),
            );
        }
        id
    };

    let source =
        conn.transaction::<AcestreamSource, diesel::result::Error, _>(|conn| {
            let existing: Option<AcestreamSource> = acestream_sources::table
                .filter(acestream_sources::content_id.eq(&content_id))
                .first(conn)
                .optional()?;

            if existing.is_some() {
                return Err(diesel::result::Error::DatabaseError(
                    diesel::result::DatabaseErrorKind::UniqueViolation,
                    Box::new(
                        "An Acestream source with this content ID already exists".to_string(),
                    ),
                ));
            }

            let new_source = NewAcestreamSource {
                name: input.name.trim().to_string(),
                content_id: content_id.clone(),
                is_active: 1,
            };

            diesel::insert_into(acestream_sources::table)
                .values(&new_source)
                .execute(conn)?;

            acestream_sources::table
                .filter(acestream_sources::content_id.eq(&content_id))
                .first(conn)
        })
        .map_err(|e| match e {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                msg,
            ) => msg.message().to_string(),
            _ => {
                tracing::error!(
                    "Failed to create Acestream source in add_acestream_source: {}",
                    e
                );
                "Failed to create Acestream source. Please try again.".to_string()
            }
        })?;

    let source_id = source.id.ok_or("Source ID is null")?;
    let stream_url = build_acestream_url(&content_id).ok();

    Ok(AcestreamSourceResponse {
        id: source_id,
        name: source.name,
        content_id: source.content_id,
        is_active: source.is_active != 0,
        created_at: source.created_at,
        stream_url,
        link_status: "orphan".to_string(),
        linked_xmltv_ids: vec![],
    })
}

/// Get all Acestream sources with link status.
pub fn get_acestream_sources(
    conn: &mut SqliteConnection,
) -> Result<Vec<AcestreamSourceResponse>, String> {
    use crate::db::schema::{channel_mappings, xmltv_channels};

    let sources: Vec<AcestreamSource> = acestream_sources::table
        .order_by(acestream_sources::name.asc())
        .load(conn)
        .map_err(|e| {
            tracing::error!("Database query error in get_acestream_sources: {}", e);
            "Failed to load Acestream sources. Please try again.".to_string()
        })?;

    let source_ids: Vec<i32> = sources.iter().filter_map(|s| s.id).collect();

    let mappings: Vec<(Option<i32>, i32)> = channel_mappings::table
        .filter(channel_mappings::acestream_source_id.is_not_null())
        .filter(channel_mappings::acestream_source_id.eq_any(&source_ids))
        .select((
            channel_mappings::acestream_source_id,
            channel_mappings::xmltv_channel_id,
        ))
        .load(conn)
        .unwrap_or_default();

    let xmltv_ids: Vec<i32> = mappings.iter().map(|(_, xmltv_id)| *xmltv_id).collect();
    let synthetic_ids: Vec<i32> = xmltv_channels::table
        .filter(xmltv_channels::id.eq_any(&xmltv_ids))
        .filter(xmltv_channels::is_synthetic.eq(1))
        .select(xmltv_channels::id)
        .load::<Option<i32>>(conn)
        .unwrap_or_default()
        .into_iter()
        .flatten()
        .collect();

    let mut link_map: std::collections::HashMap<i32, (Vec<i32>, bool)> =
        std::collections::HashMap::new();
    for (acestream_id_opt, xmltv_id) in mappings {
        if let Some(acestream_id) = acestream_id_opt {
            let entry = link_map
                .entry(acestream_id)
                .or_insert_with(|| (Vec::new(), false));
            entry.0.push(xmltv_id);
            if synthetic_ids.contains(&xmltv_id) {
                entry.1 = true;
            }
        }
    }

    let result: Vec<AcestreamSourceResponse> = sources
        .into_iter()
        .filter_map(|source| {
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
pub fn delete_acestream_source(
    conn: &mut SqliteConnection,
    source_id: i32,
) -> Result<(), String> {
    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    let deleted =
        diesel::delete(acestream_sources::table.filter(acestream_sources::id.eq(source_id)))
            .execute(conn)
            .map_err(|e| {
                tracing::error!("Failed to delete Acestream source {}: {}", source_id, e);
                "Failed to delete Acestream source. Please try again.".to_string()
            })?;

    if deleted == 0 {
        return Err("Acestream source not found".to_string());
    }

    Ok(())
}

/// Update an existing Acestream source.
pub fn update_acestream_source(
    conn: &mut SqliteConnection,
    source_id: i32,
    input: &UpdateAcestreamSourceInput,
) -> Result<AcestreamSourceResponse, String> {
    use crate::db::schema::{channel_mappings, xmltv_channels};

    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    if let Some(ref name) = input.name {
        if name.trim().is_empty() {
            return Err("Source name cannot be empty".to_string());
        }
    }

    let source: AcestreamSource = acestream_sources::table
        .filter(acestream_sources::id.eq(source_id))
        .first(conn)
        .map_err(|_| "Acestream source not found".to_string())?;

    let now = Utc::now().to_rfc3339();
    let name_update = input
        .name
        .as_ref()
        .map(|n| n.trim().to_string())
        .unwrap_or(source.name.clone());

    diesel::update(acestream_sources::table.filter(acestream_sources::id.eq(source_id)))
        .set((
            acestream_sources::name.eq(&name_update),
            acestream_sources::updated_at.eq(&now),
        ))
        .execute(conn)
        .map_err(|e| {
            tracing::error!("Failed to update Acestream source {}: {}", source_id, e);
            "Failed to update Acestream source. Please try again.".to_string()
        })?;

    let stream_url = build_acestream_url(&source.content_id).ok();

    let mappings: Vec<(Option<i32>, i32)> = channel_mappings::table
        .filter(channel_mappings::acestream_source_id.eq(source_id))
        .select((
            channel_mappings::acestream_source_id,
            channel_mappings::xmltv_channel_id,
        ))
        .load(conn)
        .unwrap_or_default();

    let xmltv_ids: Vec<i32> = mappings.iter().map(|(_, xmltv_id)| *xmltv_id).collect();
    let synthetic_ids: Vec<i32> = xmltv_channels::table
        .filter(xmltv_channels::id.eq_any(&xmltv_ids))
        .filter(xmltv_channels::is_synthetic.eq(1))
        .select(xmltv_channels::id)
        .load::<Option<i32>>(conn)
        .unwrap_or_default()
        .into_iter()
        .flatten()
        .collect();

    let has_synthetic = synthetic_ids.iter().any(|id| xmltv_ids.contains(id));
    let link_status = if has_synthetic {
        "promoted".to_string()
    } else if !xmltv_ids.is_empty() {
        "linked".to_string()
    } else {
        "orphan".to_string()
    };

    Ok(AcestreamSourceResponse {
        id: source_id,
        name: name_update,
        content_id: source.content_id,
        is_active: source.is_active != 0,
        created_at: source.created_at,
        stream_url,
        link_status,
        linked_xmltv_ids: xmltv_ids,
    })
}

/// Toggle Acestream source active status.
pub fn toggle_acestream_source(
    conn: &mut SqliteConnection,
    source_id: i32,
    is_active: bool,
) -> Result<(), String> {
    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    let updated =
        diesel::update(acestream_sources::table.filter(acestream_sources::id.eq(source_id)))
            .set((
                acestream_sources::is_active.eq(if is_active { 1 } else { 0 }),
                acestream_sources::updated_at.eq(Utc::now().to_rfc3339()),
            ))
            .execute(conn)
            .map_err(|e| {
                tracing::error!("Failed to toggle Acestream source {}: {}", source_id, e);
                "Failed to update Acestream source. Please try again.".to_string()
            })?;

    if updated == 0 {
        return Err("Acestream source not found".to_string());
    }

    Ok(())
}
