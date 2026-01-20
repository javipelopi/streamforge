# Story 4.2: Serve XMLTV EPG Endpoint

Status: ready-for-dev

## Story

As a user,
I want an EPG/XMLTV URL I can add to Plex,
So that Plex shows program guide data.

## Background

This is the **second story in Epic 4: Plex Integration & Streaming**. Epic 4 enables users to add StreamForge as a tuner in Plex and watch live TV. This story implements the XMLTV EPG endpoint that Plex uses to fetch program guide data.

**XMLTV-First Design Principle:** The EPG endpoint serves XMLTV data for **enabled channels only** because XMLTV channels are the PRIMARY channel list for Plex. Only channels the user has enabled appear in the guide, matching the M3U playlist.

**Epic 4 Story Sequence:**
1. Story 4-1 (done): M3U playlist endpoint
2. **Story 4-2 (this):** XMLTV EPG endpoint
3. Story 4-3: HDHomeRun emulation
4. Story 4-4: Stream proxy with quality selection
5. Story 4-5: Automatic stream failover
6. Story 4-6: Display Plex configuration URLs

## Acceptance Criteria

1. **Given** the HTTP server is running
   **When** Plex requests `GET /epg.xml`
   **Then** XMLTV-format EPG is generated containing:
   - Only **enabled** XMLTV channels
   - Channel IDs matching those in M3U playlist
   - Program data for enabled channels only
   - 7-day program guide data

2. **Given** a synthetic channel exists (promoted orphan from Story 3-8)
   **When** EPG is generated
   **Then** synthetic channels include placeholder programs:
   - 2-hour blocks: "{Channel Name} - Live Programming"
   - Regenerated for next 7 days

3. **Given** EPG is requested frequently
   **When** generating the response
   **Then** the EPG is cached and only regenerated when:
   - Channel settings change (enable/disable)
   - EPG data is refreshed
   - Synthetic channels are added/modified

## Tasks / Subtasks

### Backend - EPG Endpoint Implementation

- [ ] Task 1: Create EPG handler module (AC: #1, #2)
  - [ ] 1.1 Create `src-tauri/src/server/epg.rs` module
  - [ ] 1.2 Define structs for XMLTV format:
    ```rust
    struct XmltvOutput {
        channels: Vec<XmltvChannelOutput>,
        programmes: Vec<XmltvProgramme>,
    }

    struct XmltvChannelOutput {
        id: String,           // XMLTV channel_id
        display_name: String,
        icon: Option<String>,
    }

    struct XmltvProgramme {
        channel_id: String,   // Matches channel id
        title: String,
        description: Option<String>,
        start: String,        // XMLTV datetime format: "20260120200000 +0000"
        stop: String,
        category: Option<String>,
        episode_num: Option<String>,
    }
    ```
  - [ ] 1.3 Implement `generate_xmltv_epg` function
  - [ ] 1.4 Add module export in `src-tauri/src/server/mod.rs`

- [ ] Task 2: Implement enabled channels query (AC: #1)
  - [ ] 2.1 Create `get_enabled_channels_for_epg` function in `epg.rs`
  - [ ] 2.2 Query enabled XMLTV channels (reuse pattern from m3u.rs):
    ```sql
    SELECT xc.id, xc.channel_id, xc.display_name, xc.icon, xc.is_synthetic
    FROM xmltv_channels xc
    INNER JOIN xmltv_channel_settings xcs ON xc.id = xcs.xmltv_channel_id
    WHERE xcs.is_enabled = 1
    AND EXISTS (
      SELECT 1 FROM channel_mappings cm WHERE cm.xmltv_channel_id = xc.id
    )
    ORDER BY xcs.plex_display_order ASC NULLS LAST, xc.display_name ASC
    ```
  - [ ] 2.3 Return both internal id (for program lookup) and channel_id (for XMLTV output)

- [ ] Task 3: Implement program data query (AC: #1)
  - [ ] 3.1 Create `get_programs_for_channels` function
  - [ ] 3.2 Query programs for enabled channels with 7-day window:
    ```sql
    SELECT p.id, p.xmltv_channel_id, p.title, p.description,
           p.start_time, p.end_time, p.category, p.episode_info
    FROM programs p
    WHERE p.xmltv_channel_id IN (?) -- List of enabled channel IDs
    AND p.start_time >= datetime('now', '-1 hour')
    AND p.start_time < datetime('now', '+7 days')
    ORDER BY p.xmltv_channel_id, p.start_time ASC
    ```
  - [ ] 3.3 Use efficient batch query (single query, not N+1)
  - [ ] 3.4 Map internal xmltv_channel_id to XMLTV channel_id for output

- [ ] Task 4: Implement synthetic channel placeholder EPG (AC: #2)
  - [ ] 4.1 Create `generate_placeholder_programs` function
  - [ ] 4.2 For synthetic channels (is_synthetic = 1), generate:
    - Programs covering next 7 days
    - 2-hour time blocks starting from current hour
    - Title: "{display_name} - Live Programming"
    - Description: "Live content on {display_name}"
    - No category or episode info
  - [ ] 4.3 Calculate start/stop times using UTC with proper XMLTV format
  - [ ] 4.4 Merge placeholder programs with real programs for output

- [ ] Task 5: Implement XMLTV format generation (AC: #1)
  - [ ] 5.1 Create `format_xmltv_output` function
  - [ ] 5.2 Generate XMLTV XML structure:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE tv SYSTEM "xmltv.dtd">
    <tv generator-info-name="StreamForge" generator-info-url="https://github.com/user/streamforge">
      <channel id="ESPN.US">
        <display-name>ESPN</display-name>
        <icon src="http://example.com/espn.png"/>
      </channel>
      <!-- More channels -->
      <programme start="20260120200000 +0000" stop="20260120210000 +0000" channel="ESPN.US">
        <title lang="en">SportsCenter</title>
        <desc lang="en">Sports news and highlights.</desc>
        <category lang="en">Sports</category>
        <episode-num system="onscreen">S1E100</episode-num>
      </programme>
      <!-- More programmes -->
    </tv>
    ```
  - [ ] 5.3 Use `quick-xml` for efficient XML generation (same lib used for parsing)
  - [ ] 5.4 Format datetime as XMLTV format: `YYYYMMDDHHmmss +0000`
  - [ ] 5.5 Escape XML special characters (&, <, >, ", ')
  - [ ] 5.6 Pre-allocate string capacity for performance

- [ ] Task 6: Implement caching strategy (AC: #3)
  - [ ] 6.1 Store cache state in AppState:
    ```rust
    struct EpgCache {
        content: String,
        etag: String,
        generated_at: Instant,
    }
    ```
  - [ ] 6.2 Generate ETag from hash of:
    - Enabled channel IDs list
    - Latest program update timestamp
    - Synthetic channel count
  - [ ] 6.3 Implement cache invalidation triggers:
    - When xmltv_channel_settings is modified
    - When programs table is refreshed
    - When synthetic channels are created/modified
  - [ ] 6.4 Set cache TTL of 5 minutes (same as M3U endpoint)
  - [ ] 6.5 Add `Cache-Control: max-age=300` header
  - [ ] 6.6 Support `If-None-Match` header for 304 Not Modified responses

- [ ] Task 7: Create HTTP endpoint handler (AC: #1, #3)
  - [ ] 7.1 Add `epg_xml` handler function in `src-tauri/src/server/handlers.rs`:
    ```rust
    pub async fn epg_xml(
        State(state): State<AppState>,
        headers: HeaderMap,
    ) -> impl IntoResponse {
        // Check If-None-Match for caching
        // Generate or return cached EPG
        // Return with Content-Type: application/xml
    }
    ```
  - [ ] 7.2 Return proper Content-Type header: `application/xml; charset=utf-8`
  - [ ] 7.3 Return Content-Length header
  - [ ] 7.4 Handle database errors gracefully (return 500 with opaque error message)
  - [ ] 7.5 Log detailed errors server-side (follow pattern from Story 4-1)

- [ ] Task 8: Register route in router (AC: #1)
  - [ ] 8.1 Edit `src-tauri/src/server/routes.rs`
  - [ ] 8.2 Add route: `.route("/epg.xml", get(handlers::epg_xml))`
  - [ ] 8.3 Import handler in routes.rs

### Testing

- [ ] Task 9: Unit tests for EPG generation
  - [ ] 9.1 Create tests in `src-tauri/src/server/epg.rs` (mod tests)
  - [ ] 9.2 Test: Empty EPG when no enabled channels
  - [ ] 9.3 Test: Single channel generates correct XMLTV format
  - [ ] 9.4 Test: Multiple channels ordered correctly
  - [ ] 9.5 Test: Channels without streams are excluded
  - [ ] 9.6 Test: Program data formatted correctly (datetime, escaping)
  - [ ] 9.7 Test: Synthetic channels get placeholder programs
  - [ ] 9.8 Test: Placeholder programs cover 7 days in 2-hour blocks
  - [ ] 9.9 Test: XML special characters escaped properly
  - [ ] 9.10 Test: XMLTV datetime format is correct

- [ ] Task 10: E2E tests for EPG endpoint
  - [ ] 10.1 Create `tests/e2e/epg-xmltv.spec.ts`
  - [ ] 10.2 Test: GET /epg.xml returns 200 OK
  - [ ] 10.3 Test: Response Content-Type is application/xml
  - [ ] 10.4 Test: Response is valid XML
  - [ ] 10.5 Test: Only enabled channels appear in EPG
  - [ ] 10.6 Test: Disabled channels are excluded
  - [ ] 10.7 Test: Channel IDs match M3U playlist tvg-id values
  - [ ] 10.8 Test: ETag header is present
  - [ ] 10.9 Test: If-None-Match returns 304 when unchanged
  - [ ] 10.10 Test: Synthetic channels have placeholder programs

- [ ] Task 11: Build verification
  - [ ] 11.1 Run `cargo check` - no Rust errors
  - [ ] 11.2 Run `cargo test` - all tests pass
  - [ ] 11.3 Run `npm run build` - build succeeds

## Dev Notes

### CRITICAL: XMLTV-First Architecture

The EPG endpoint MUST serve XMLTV data for **enabled channels only** because:
- XMLTV channels define the Plex lineup (names, IDs, EPG data)
- Channels must match between M3U playlist (tvg-id) and EPG (channel id)
- The user explicitly enables channels they want in Plex

[Source: _bmad-output/planning-artifacts/architecture.md#Data Flow]

### Existing Server Infrastructure

The HTTP server foundation was built in Story 1-5, M3U endpoint added in Story 4-1. Key files:
- `src-tauri/src/server/mod.rs` - Server module with `start_server()`
- `src-tauri/src/server/routes.rs` - Axum router configuration
- `src-tauri/src/server/handlers.rs` - Request handlers (includes `playlist_m3u`)
- `src-tauri/src/server/state.rs` - AppState with DB pool
- `src-tauri/src/server/m3u.rs` - M3U generation (reference for patterns)

Current routes:
- `GET /health` - Health check (returns 200 OK)
- `GET /playlist.m3u` - M3U playlist (Story 4-1)
- Fallback - 404 Not Found

[Source: src-tauri/src/server/routes.rs]

### Database Schema Reference

**programs table:**
```sql
CREATE TABLE programs (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    category TEXT,
    episode_info TEXT
);
CREATE INDEX idx_programs_channel_time ON programs(xmltv_channel_id, start_time);
```

**xmltv_channels table:**
```sql
CREATE TABLE xmltv_channels (
    id INTEGER PRIMARY KEY,
    source_id INTEGER REFERENCES xmltv_sources(id),
    channel_id TEXT NOT NULL,      -- XMLTV channel ID (used in EPG output)
    display_name TEXT NOT NULL,
    icon TEXT,
    is_synthetic INTEGER DEFAULT 0
);
```

**xmltv_channel_settings table:**
```sql
CREATE TABLE xmltv_channel_settings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER UNIQUE REFERENCES xmltv_channels(id),
    is_enabled INTEGER DEFAULT 0,
    plex_display_order INTEGER
);
```

[Source: src-tauri/src/db/schema.rs]

### XMLTV Format Specification

Standard XMLTV format for Plex compatibility:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE tv SYSTEM "xmltv.dtd">
<tv generator-info-name="StreamForge" generator-info-url="">
  <channel id="ESPN.US">
    <display-name>ESPN</display-name>
    <icon src="http://example.com/espn.png"/>
  </channel>
  <programme start="20260120200000 +0000" stop="20260120210000 +0000" channel="ESPN.US">
    <title lang="en">SportsCenter</title>
    <desc lang="en">Sports highlights and analysis.</desc>
    <category lang="en">Sports</category>
    <episode-num system="onscreen">S1E100</episode-num>
  </programme>
</tv>
```

**Key Requirements:**
- `channel id` must match `tvg-id` in M3U playlist
- Datetime format: `YYYYMMDDHHmmss +0000` (space before timezone)
- Timezone should be UTC (+0000) for consistency
- `lang="en"` attribute on text elements (optional but recommended)
- XML must be valid and properly escaped

[Source: _bmad-output/planning-artifacts/architecture.md#HTTP Server Endpoints]
[Source: XMLTV 0.5 specification - NFR14 compliance]

### Plex Requirements

Plex expects:
1. Content-Type: `application/xml` or `text/xml`
2. UTF-8 encoding with proper declaration
3. Valid XMLTV format
4. Channel IDs matching M3U tvg-id values
5. Programs within reasonable time window (7 days typical)

### Performance Considerations (From Story 4-1 Code Review)

**CRITICAL - Avoid N+1 queries:**
- Story 4-1 had HIGH severity N+1 query issue that was fixed
- Use batch queries: single query for channels, single query for all programs
- Pre-allocate string capacity for large outputs

**Indexes already exist (from 4-1 migration):**
- `idx_settings_enabled` on `xmltv_channel_settings(is_enabled)`
- `idx_settings_order` on `xmltv_channel_settings(plex_display_order)`
- `idx_programs_channel_time` on `programs(xmltv_channel_id, start_time)`

**Response time targets:**
- EPG generation should be <100ms for normal channel counts (NFR5)
- Use caching to avoid regeneration on every Plex poll

### Memory Considerations

For large EPGs (500+ channels, 7 days of programs):
- Pre-allocate string capacity based on estimated output size
- Estimate: ~500 bytes per channel + ~300 bytes per program
- 500 channels × 84 programs/channel = 42,000 programs
- Estimated size: ~15MB - consider streaming for very large guides

For MVP, in-memory generation is acceptable if capacity is pre-allocated.

### Previous Story Learnings (Story 4-1 Code Review)

**HIGH priority fixes applied in 4-1 that apply here:**
1. **Logo fallback query logic** - Fixed ORDER BY to prefer primary mappings
2. **Security - Error message disclosure** - Return opaque errors to clients, log details server-side
3. **N+1 query pattern** - Must use batch queries

**MEDIUM priority fixes applied in 4-1:**
1. **Memory pre-allocation** - Pre-allocate string capacity
2. **Caching strategy** - ETag + Cache-Control headers (5-minute cache)
3. **Content-Length header** - Include for better client compatibility

**Pattern to follow from handlers.rs:**
```rust
pub async fn epg_xml(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Check If-None-Match for caching
    if let Some(client_etag) = headers.get(header::IF_NONE_MATCH) {
        if let Ok(etag_str) = client_etag.to_str() {
            if let Some(cache) = state.get_epg_cache() {
                if cache.etag == etag_str {
                    return Ok((StatusCode::NOT_MODIFIED, HeaderMap::new(), String::new()));
                }
            }
        }
    }

    let conn = state.get_connection()
        .map_err(|e| {
            tracing::error!("Database connection error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
        })?;

    let xml_content = epg::generate_xmltv_epg(&mut conn)
        .map_err(|e| {
            tracing::error!("EPG generation error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
        })?;

    let etag = calculate_etag(&xml_content);
    let content_length = xml_content.len();

    let mut response_headers = HeaderMap::new();
    response_headers.insert(header::CONTENT_TYPE, "application/xml; charset=utf-8".parse().unwrap());
    response_headers.insert(header::CONTENT_LENGTH, content_length.to_string().parse().unwrap());
    response_headers.insert(header::CACHE_CONTROL, "max-age=300".parse().unwrap());
    response_headers.insert(header::ETAG, etag.parse().unwrap());

    Ok((StatusCode::OK, response_headers, xml_content))
}
```

### XML Generation with quick-xml

Use the same quick-xml crate used for XMLTV parsing (Story 2-5):

```rust
use quick_xml::events::{Event, BytesDecl, BytesStart, BytesEnd, BytesText};
use quick_xml::Writer;
use std::io::Cursor;

fn generate_xmltv(channels: &[XmltvChannelOutput], programmes: &[XmltvProgramme]) -> Result<String> {
    let mut writer = Writer::new(Cursor::new(Vec::new()));

    // XML declaration
    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))?;

    // DOCTYPE
    writer.write_event(Event::DocType(BytesText::from_escaped("tv SYSTEM \"xmltv.dtd\"")))?;

    // Root <tv> element
    let mut tv = BytesStart::new("tv");
    tv.push_attribute(("generator-info-name", "StreamForge"));
    writer.write_event(Event::Start(tv))?;

    // Channels
    for channel in channels {
        let mut ch = BytesStart::new("channel");
        ch.push_attribute(("id", channel.id.as_str()));
        writer.write_event(Event::Start(ch))?;

        // display-name
        writer.write_event(Event::Start(BytesStart::new("display-name")))?;
        writer.write_event(Event::Text(BytesText::new(&channel.display_name)))?;
        writer.write_event(Event::End(BytesEnd::new("display-name")))?;

        // icon (if present)
        if let Some(icon) = &channel.icon {
            let mut icon_elem = BytesStart::new("icon");
            icon_elem.push_attribute(("src", icon.as_str()));
            writer.write_event(Event::Empty(icon_elem))?;
        }

        writer.write_event(Event::End(BytesEnd::new("channel")))?;
    }

    // Programmes
    for prog in programmes {
        let mut p = BytesStart::new("programme");
        p.push_attribute(("start", prog.start.as_str()));
        p.push_attribute(("stop", prog.stop.as_str()));
        p.push_attribute(("channel", prog.channel_id.as_str()));
        writer.write_event(Event::Start(p))?;

        // title
        let mut title = BytesStart::new("title");
        title.push_attribute(("lang", "en"));
        writer.write_event(Event::Start(title))?;
        writer.write_event(Event::Text(BytesText::new(&prog.title)))?;
        writer.write_event(Event::End(BytesEnd::new("title")))?;

        // More elements...

        writer.write_event(Event::End(BytesEnd::new("programme")))?;
    }

    writer.write_event(Event::End(BytesEnd::new("tv")))?;

    let result = writer.into_inner().into_inner();
    Ok(String::from_utf8(result)?)
}
```

### XMLTV Datetime Format Helper

```rust
use chrono::{DateTime, Utc};

/// Format datetime to XMLTV format: "YYYYMMDDHHmmss +0000"
fn format_xmltv_datetime(dt: DateTime<Utc>) -> String {
    dt.format("%Y%m%d%H%M%S +0000").to_string()
}

// Example: 2026-01-20 20:00:00 UTC -> "20260120200000 +0000"
```

### Placeholder Program Generation for Synthetic Channels

```rust
use chrono::{Duration, Utc, Timelike};

fn generate_placeholder_programs(channel: &XmltvChannelOutput) -> Vec<XmltvProgramme> {
    let now = Utc::now();
    // Round down to current hour
    let start_hour = now.with_minute(0).unwrap().with_second(0).unwrap().with_nanosecond(0).unwrap();

    let mut programs = Vec::new();
    let mut current = start_hour;
    let end_date = start_hour + Duration::days(7);

    while current < end_date {
        let stop = current + Duration::hours(2);
        programs.push(XmltvProgramme {
            channel_id: channel.id.clone(),
            title: format!("{} - Live Programming", channel.display_name),
            description: Some(format!("Live content on {}", channel.display_name)),
            start: format_xmltv_datetime(current),
            stop: format_xmltv_datetime(stop),
            category: None,
            episode_num: None,
        });
        current = stop;
    }

    programs
}
```

### Files to Create

```
src-tauri/src/server/epg.rs  (new - EPG generation logic)
tests/e2e/epg-xmltv.spec.ts  (new - E2E tests)
```

### Files to Modify

```
src-tauri/src/server/mod.rs (add epg module export)
src-tauri/src/server/routes.rs (add /epg.xml route)
src-tauri/src/server/handlers.rs (add epg_xml handler)
src-tauri/src/server/state.rs (add EpgCache to AppState if implementing cache)
```

### Testing Strategy

**Unit Tests (Rust):**
- Test XMLTV format generation with mock data
- Test channel ordering logic
- Test program datetime formatting
- Test synthetic channel placeholder generation
- Test XML escaping
- Test empty channel handling

**E2E Tests (Playwright):**
- Test HTTP endpoint returns correct content
- Test only enabled channels appear
- Test proper Content-Type header
- Test ETag/caching behavior
- Test XML validity

### Integration with M3U Playlist

The EPG channel IDs MUST match the M3U tvg-id values:
- M3U uses `tvg-id="{channel_id}"` from xmltv_channels.channel_id
- EPG uses `<channel id="{channel_id}">` from the same field
- This ensures Plex can correlate channels between playlist and guide

### Project Structure Notes

This story follows the established patterns:
- Server modules in `src-tauri/src/server/`
- Database queries using Diesel ORM patterns
- E2E tests in `tests/e2e/`
- Follow error handling patterns from Story 4-1

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#HTTP Server Endpoints]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Flow]
- [Source: _bmad-output/planning-artifacts/prd.md#FR35 - System can serve XMLTV/EPG endpoint]
- [Source: src-tauri/src/server/mod.rs]
- [Source: src-tauri/src/server/routes.rs]
- [Source: src-tauri/src/server/handlers.rs]
- [Source: src-tauri/src/server/m3u.rs - Pattern reference]
- [Source: src-tauri/src/db/schema.rs - programs table]
- [Source: _bmad-output/implementation-artifacts/4-1-serve-m3u-playlist-endpoint.md - Code review learnings]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

