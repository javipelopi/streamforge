//! Channel tags service — CRUD for user-defined tags on XMLTV channels.
//!
//! Tags let users label channels (e.g., "spain", "sports") and then request
//! filtered playlists: `/playlist.m3u?tag=spain`.

use diesel::prelude::*;
use std::collections::HashMap;

use crate::db::models::{ChannelTag, NewChannelTag};
use crate::db::schema::channel_tags;

/// Get all tags for a specific XMLTV channel.
pub fn get_tags_for_channel(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
) -> Result<Vec<String>, diesel::result::Error> {
    channel_tags::table
        .filter(channel_tags::xmltv_channel_id.eq(xmltv_channel_id))
        .select(channel_tags::tag)
        .order(channel_tags::tag.asc())
        .load::<String>(conn)
}

/// Get all unique tags across all channels (for autocomplete).
pub fn get_all_tags(conn: &mut SqliteConnection) -> Result<Vec<String>, diesel::result::Error> {
    channel_tags::table
        .select(channel_tags::tag)
        .distinct()
        .order(channel_tags::tag.asc())
        .load::<String>(conn)
}

/// Set tags for a channel (replaces existing tags).
pub fn set_tags_for_channel(
    conn: &mut SqliteConnection,
    xmltv_channel_id: i32,
    tags: &[String],
) -> Result<Vec<String>, diesel::result::Error> {
    conn.transaction(|conn| {
        // Delete existing tags
        diesel::delete(
            channel_tags::table.filter(channel_tags::xmltv_channel_id.eq(xmltv_channel_id)),
        )
        .execute(conn)?;

        // Insert new tags (skip empty/whitespace-only)
        for tag in tags {
            let tag = tag.trim().to_lowercase();
            if tag.is_empty() {
                continue;
            }
            diesel::insert_or_ignore_into(channel_tags::table)
                .values(NewChannelTag {
                    xmltv_channel_id,
                    tag,
                })
                .execute(conn)?;
        }

        // Return the current tags
        get_tags_for_channel(conn, xmltv_channel_id)
    })
}

/// Get tags for multiple channels at once (avoids N+1).
/// Returns a HashMap from xmltv_channel_id to Vec<String>.
pub fn get_tags_for_channels(
    conn: &mut SqliteConnection,
    channel_ids: &[i32],
) -> Result<HashMap<i32, Vec<String>>, diesel::result::Error> {
    if channel_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let rows: Vec<ChannelTag> = channel_tags::table
        .filter(channel_tags::xmltv_channel_id.eq_any(channel_ids))
        .order((channel_tags::xmltv_channel_id.asc(), channel_tags::tag.asc()))
        .load(conn)?;

    let mut map: HashMap<i32, Vec<String>> = HashMap::new();
    for row in rows {
        map.entry(row.xmltv_channel_id)
            .or_default()
            .push(row.tag);
    }

    Ok(map)
}

/// Get all XMLTV channel IDs that have a specific tag.
pub fn get_channel_ids_with_tag(
    conn: &mut SqliteConnection,
    tag: &str,
) -> Result<Vec<i32>, diesel::result::Error> {
    channel_tags::table
        .filter(channel_tags::tag.eq(tag.trim().to_lowercase()))
        .select(channel_tags::xmltv_channel_id)
        .load::<i32>(conn)
}
