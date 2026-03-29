//! M3U service — M3U source and channel management.
//!
//! Extracted from `commands/m3u_sources.rs`.

use chrono::Utc;
use diesel::prelude::*;
use diesel::Connection;

use crate::commands::m3u_sources::{
    AddM3uSourceInput, M3uChannelResponse, M3uSourceWithStats, RefreshM3uResult,
    UpdateM3uSourceInput,
};
use crate::db::models::{M3uChannel, M3uSource, NewM3uChannel, NewM3uSource};
use crate::db::schema::{m3u_channels, m3u_sources};
use crate::m3u::{fetch_m3u_playlist, parse_m3u_playlist, read_local_m3u_file};

/// Add a new M3U source and fetch its channels.
pub async fn add_m3u_source(
    conn: &mut SqliteConnection,
    input: &AddM3uSourceInput,
) -> Result<M3uSourceWithStats, String> {
    if input.name.trim().is_empty() {
        return Err("Source name cannot be empty".to_string());
    }
    if input.url.trim().is_empty() {
        return Err(if input.is_local_file {
            "File path cannot be empty".to_string()
        } else {
            "URL cannot be empty".to_string()
        });
    }

    let refresh_hours = if input.is_local_file || input.is_single_stream {
        0
    } else {
        if !input.url.starts_with("http://") && !input.url.starts_with("https://") {
            return Err("URL must start with http:// or https://".to_string());
        }
        if input.url.len() > 8192 {
            return Err("URL exceeds maximum length of 8192 characters".to_string());
        }
        let hours = input.refresh_interval_hours.unwrap_or(24);
        if hours < 1 || hours > 168 {
            return Err("Refresh interval must be between 1 and 168 hours".to_string());
        }
        hours
    };

    if input.is_single_stream {
        if !input.url.starts_with("http://") && !input.url.starts_with("https://") {
            return Err("Stream URL must start with http:// or https://".to_string());
        }
        if input.url.len() > 8192 {
            return Err("Stream URL exceeds maximum length of 8192 characters".to_string());
        }
    }

    let parsed_channels: Vec<crate::m3u::M3uChannelEntry> = if input.is_single_stream {
        vec![crate::m3u::M3uChannelEntry {
            stream_url: input.url.trim().to_string(),
            name: input.name.trim().to_string(),
            tvg_id: None,
            tvg_name: Some(input.name.trim().to_string()),
            tvg_logo: None,
            group_title: Some("Single Streams".to_string()),
        }]
    } else if input.is_local_file {
        let playlist_content = read_local_m3u_file(&input.url)
            .map_err(|e| format!("Failed to read M3U file: {}", e))?;
        let channels = parse_m3u_playlist(&playlist_content);
        if channels.is_empty() {
            return Err(
                "No channels found in M3U file. Please check the file contents.".to_string(),
            );
        }
        channels
    } else {
        let playlist_content = fetch_m3u_playlist(&input.url)
            .await
            .map_err(|e| format!("Failed to fetch M3U playlist: {}", e))?;
        let channels = parse_m3u_playlist(&playlist_content);
        if channels.is_empty() {
            return Err(
                "No channels found in M3U playlist. Please check the URL.".to_string(),
            );
        }
        channels
    };

    let source_url = input.url.trim().to_string();
    let source_name = input.name.trim().to_string();
    let is_local_file = input.is_local_file;

    let result =
        conn.transaction::<M3uSourceWithStats, diesel::result::Error, _>(|conn| {
            let existing = m3u_sources::table
                .filter(m3u_sources::url.eq(&source_url))
                .first::<M3uSource>(conn)
                .optional()?;

            if existing.is_some() {
                return Err(diesel::result::Error::RollbackTransaction);
            }

            let new_source = NewM3uSource {
                name: source_name,
                url: source_url.clone(),
                refresh_interval_hours: refresh_hours,
                is_active: 1,
                is_local_file: if is_local_file { 1 } else { 0 },
            };

            diesel::insert_into(m3u_sources::table)
                .values(&new_source)
                .execute(conn)?;

            let source: M3uSource = m3u_sources::table
                .filter(m3u_sources::url.eq(&source_url))
                .first(conn)?;

            let source_id = source.id.ok_or(diesel::result::Error::NotFound)?;

            let channel_count = insert_m3u_channels_internal(conn, source_id, &parsed_channels)?;

            let now = Utc::now().to_rfc3339();
            diesel::update(m3u_sources::table.filter(m3u_sources::id.eq(source_id)))
                .set(m3u_sources::last_refresh.eq(&now))
                .execute(conn)?;

            Ok(M3uSourceWithStats {
                id: source_id,
                name: source.name,
                url: source.url,
                refresh_interval_hours: source.refresh_interval_hours,
                last_refresh: Some(now),
                is_active: source.is_active != 0,
                is_local_file: source.is_local_file != 0,
                created_at: source.created_at,
                channel_count,
            })
        });

    result.map_err(|e| match e {
        diesel::result::Error::RollbackTransaction => {
            "An M3U source with this URL already exists".to_string()
        }
        _ => format!("Failed to add M3U source: {}", e),
    })
}

/// Get all M3U sources with channel counts.
pub fn get_m3u_sources(
    conn: &mut SqliteConnection,
) -> Result<Vec<M3uSourceWithStats>, String> {
    let sources: Vec<M3uSource> = m3u_sources::table
        .order_by(m3u_sources::name.asc())
        .load(conn)
        .map_err(|e| format!("Failed to load M3U sources: {}", e))?;

    let mut result = Vec::with_capacity(sources.len());

    for source in sources {
        let source_id = match source.id {
            Some(id) => id,
            None => continue,
        };

        let channel_count: i64 = m3u_channels::table
            .filter(m3u_channels::source_id.eq(source_id))
            .count()
            .get_result(conn)
            .unwrap_or(0);

        result.push(M3uSourceWithStats {
            id: source_id,
            name: source.name,
            url: source.url,
            refresh_interval_hours: source.refresh_interval_hours,
            last_refresh: source.last_refresh,
            is_active: source.is_active != 0,
            is_local_file: source.is_local_file != 0,
            created_at: source.created_at,
            channel_count: channel_count.try_into().unwrap_or(i32::MAX),
        });
    }

    Ok(result)
}

/// Refresh an M3U source by re-fetching and updating channels.
pub async fn refresh_m3u_source(
    conn: &mut SqliteConnection,
    source_id: i32,
) -> Result<RefreshM3uResult, String> {
    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    let source: M3uSource = m3u_sources::table
        .filter(m3u_sources::id.eq(source_id))
        .first(conn)
        .map_err(|_| "M3U source not found".to_string())?;

    let playlist_content = if source.is_local_file != 0 {
        read_local_m3u_file(&source.url)
            .map_err(|e| format!("Failed to read M3U file: {}", e))?
    } else {
        fetch_m3u_playlist(&source.url)
            .await
            .map_err(|e| format!("Failed to fetch M3U playlist: {}", e))?
    };

    let parsed_channels = parse_m3u_playlist(&playlist_content);

    let old_count: i64 = m3u_channels::table
        .filter(m3u_channels::source_id.eq(source_id))
        .count()
        .get_result(conn)
        .unwrap_or(0);

    let new_count = conn
        .transaction::<i32, diesel::result::Error, _>(|conn| {
            diesel::delete(m3u_channels::table.filter(m3u_channels::source_id.eq(source_id)))
                .execute(conn)?;
            insert_m3u_channels_internal(conn, source_id, &parsed_channels)
        })
        .map_err(|e| format!("Failed to refresh channels: {}", e))?;

    diesel::update(m3u_sources::table.filter(m3u_sources::id.eq(source_id)))
        .set((
            m3u_sources::last_refresh.eq(Utc::now().to_rfc3339()),
            m3u_sources::updated_at.eq(Utc::now().to_rfc3339()),
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to update last_refresh: {}", e))?;

    let old_count_i32 = old_count.try_into().unwrap_or(i32::MAX);

    Ok(RefreshM3uResult {
        source_id,
        channels_added: if new_count > old_count_i32 { new_count - old_count_i32 } else { 0 },
        channels_removed: if old_count_i32 > new_count { old_count_i32 - new_count } else { 0 },
        total_channels: new_count,
    })
}

/// Delete an M3U source and all its channels.
pub fn delete_m3u_source(conn: &mut SqliteConnection, source_id: i32) -> Result<(), String> {
    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    let deleted = diesel::delete(m3u_sources::table.filter(m3u_sources::id.eq(source_id)))
        .execute(conn)
        .map_err(|e| format!("Failed to delete M3U source: {}", e))?;

    if deleted == 0 {
        return Err("M3U source not found".to_string());
    }

    Ok(())
}

/// Get all channels for an M3U source with link status.
pub fn get_m3u_channels(
    conn: &mut SqliteConnection,
    source_id: i32,
) -> Result<Vec<M3uChannelResponse>, String> {
    use crate::db::schema::{channel_mappings, xmltv_channels};

    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    let channels: Vec<M3uChannel> = m3u_channels::table
        .filter(m3u_channels::source_id.eq(source_id))
        .order_by(m3u_channels::name.asc())
        .load(conn)
        .map_err(|e| format!("Failed to load M3U channels: {}", e))?;

    let channel_ids: Vec<i32> = channels.iter().filter_map(|ch| ch.id).collect();

    let mappings: Vec<(Option<i32>, i32)> = channel_mappings::table
        .filter(channel_mappings::m3u_channel_id.is_not_null())
        .filter(channel_mappings::m3u_channel_id.eq_any(&channel_ids))
        .select((
            channel_mappings::m3u_channel_id,
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
    for (m3u_id_opt, xmltv_id) in mappings {
        if let Some(m3u_id) = m3u_id_opt {
            let entry = link_map
                .entry(m3u_id)
                .or_insert_with(|| (Vec::new(), false));
            entry.0.push(xmltv_id);
            if synthetic_ids.contains(&xmltv_id) {
                entry.1 = true;
            }
        }
    }

    let result: Vec<M3uChannelResponse> = channels
        .into_iter()
        .filter_map(|ch| {
            let channel_id = ch.id?;
            let (linked_xmltv_ids, has_synthetic) = link_map
                .get(&channel_id)
                .cloned()
                .unwrap_or_else(|| (Vec::new(), false));

            let link_status = if has_synthetic {
                "promoted".to_string()
            } else if !linked_xmltv_ids.is_empty() {
                "linked".to_string()
            } else {
                "orphan".to_string()
            };

            Some(M3uChannelResponse {
                id: channel_id,
                source_id: ch.source_id,
                stream_url: ch.stream_url,
                name: ch.name,
                tvg_id: ch.tvg_id,
                tvg_name: ch.tvg_name,
                tvg_logo: ch.tvg_logo,
                group_title: ch.group_title,
                link_status,
                linked_xmltv_ids,
            })
        })
        .collect();

    Ok(result)
}

/// Update an existing M3U source.
pub fn update_m3u_source(
    conn: &mut SqliteConnection,
    source_id: i32,
    input: &UpdateM3uSourceInput,
) -> Result<M3uSourceWithStats, String> {
    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    if let Some(ref name) = input.name {
        if name.trim().is_empty() {
            return Err("Source name cannot be empty".to_string());
        }
    }
    if let Some(ref url) = input.url {
        if url.trim().is_empty() {
            return Err("URL cannot be empty".to_string());
        }
        if !url.starts_with("/") && !url.starts_with("http://") && !url.starts_with("https://") {
            return Err(
                "URL must start with http://, https://, or be a local file path".to_string(),
            );
        }
        if url.len() > 8192 {
            return Err("URL exceeds maximum length of 8192 characters".to_string());
        }
    }
    if let Some(hours) = input.refresh_interval_hours {
        if hours < 1 || hours > 168 {
            return Err("Refresh interval must be between 1 and 168 hours".to_string());
        }
    }

    let source: M3uSource = m3u_sources::table
        .filter(m3u_sources::id.eq(source_id))
        .first(conn)
        .map_err(|_| "M3U source not found".to_string())?;

    let now = Utc::now().to_rfc3339();
    let name_update = input
        .name
        .as_ref()
        .map(|n| n.trim().to_string())
        .unwrap_or(source.name);
    let url_update = input
        .url
        .as_ref()
        .map(|u| u.trim().to_string())
        .unwrap_or(source.url);
    let refresh_update = input
        .refresh_interval_hours
        .unwrap_or(source.refresh_interval_hours);

    diesel::update(m3u_sources::table.filter(m3u_sources::id.eq(source_id)))
        .set((
            m3u_sources::name.eq(&name_update),
            m3u_sources::url.eq(&url_update),
            m3u_sources::refresh_interval_hours.eq(refresh_update),
            m3u_sources::updated_at.eq(&now),
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to update M3U source: {}", e))?;

    let channel_count: i64 = m3u_channels::table
        .filter(m3u_channels::source_id.eq(source_id))
        .count()
        .get_result(conn)
        .unwrap_or(0);

    Ok(M3uSourceWithStats {
        id: source_id,
        name: name_update,
        url: url_update,
        refresh_interval_hours: refresh_update,
        last_refresh: source.last_refresh,
        is_active: source.is_active != 0,
        is_local_file: source.is_local_file != 0,
        created_at: source.created_at,
        channel_count: channel_count.try_into().unwrap_or(i32::MAX),
    })
}

/// Toggle M3U source active status.
pub fn toggle_m3u_source(
    conn: &mut SqliteConnection,
    source_id: i32,
    is_active: bool,
) -> Result<(), String> {
    if source_id <= 0 {
        return Err("Invalid source ID".to_string());
    }

    let updated = diesel::update(m3u_sources::table.filter(m3u_sources::id.eq(source_id)))
        .set((
            m3u_sources::is_active.eq(if is_active { 1 } else { 0 }),
            m3u_sources::updated_at.eq(Utc::now().to_rfc3339()),
        ))
        .execute(conn)
        .map_err(|e| format!("Failed to toggle M3U source: {}", e))?;

    if updated == 0 {
        return Err("M3U source not found".to_string());
    }

    Ok(())
}

/// Internal helper to insert M3U channels within a transaction.
fn insert_m3u_channels_internal(
    conn: &mut SqliteConnection,
    source_id: i32,
    channels: &[crate::m3u::M3uChannelEntry],
) -> Result<i32, diesel::result::Error> {
    let count_before: i64 = m3u_channels::table
        .filter(m3u_channels::source_id.eq(source_id))
        .count()
        .get_result(conn)?;

    for channel in channels {
        let new_channel = NewM3uChannel {
            source_id,
            stream_url: channel.stream_url.clone(),
            name: channel.name.clone(),
            tvg_id: channel.tvg_id.clone(),
            tvg_name: channel.tvg_name.clone(),
            tvg_logo: channel.tvg_logo.clone(),
            group_title: channel.group_title.clone(),
        };

        diesel::insert_or_ignore_into(m3u_channels::table)
            .values(&new_channel)
            .execute(conn)?;
    }

    let count_after: i64 = m3u_channels::table
        .filter(m3u_channels::source_id.eq(source_id))
        .count()
        .get_result(conn)?;

    Ok((count_after - count_before).try_into().unwrap_or(i32::MAX))
}
