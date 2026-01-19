# Story 3.1: Implement Fuzzy Channel Matching Algorithm

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want Xtream streams automatically matched to my XMLTV channels,
So that I don't have to manually match hundreds of channels.

## Acceptance Criteria

1. **Given** XMLTV channels and Xtream channels exist in the database
   **When** matching is triggered (after scan or manually)
   **Then** the fuzzy matching algorithm runs:
   1. For each XMLTV channel, find ALL candidate Xtream streams above threshold
   2. Normalize channel names (lowercase, remove HD/SD/FHD suffixes, strip punctuation)
   3. Calculate Jaro-Winkler similarity score
   4. Boost score for exact EPG ID matches
   5. Apply confidence threshold (default: 0.85)
   **And** `channel_mappings` records are created:
   - **One XMLTV channel → Multiple Xtream streams** (one-to-many)
   - Each mapping includes: `xmltv_channel_id`, `xtream_channel_id`, `match_confidence`, `is_primary`
   - The highest-confidence match is marked `is_primary = true`
   - Additional matches stored for failover purposes

2. **Given** multiple Xtream streams match a single XMLTV channel (e.g., "ESPN HD", "ESPN SD", "ESPN 4K" all match "ESPN")
   **When** matching completes
   **Then** all matching streams are stored in `channel_mappings`
   **And** the best match (highest confidence) is marked as primary
   **And** other matches are available as failover sources

3. **Given** no Xtream stream matches above threshold
   **When** matching completes for an XMLTV channel
   **Then** the XMLTV channel exists with no mapped streams
   **And** `is_enabled` = false in `xmltv_channel_settings`
   **And** the channel shows as "No stream matched"

4. **Given** the matching algorithm runs
   **When** processing 1000+ channels
   **Then** matching completes within 60 seconds (NFR3)

## Tasks / Subtasks

- [ ] Task 1: Create database schema for channel mappings (AC: #1, #2, #3)
  - [ ] 1.1 Create migration for `channel_mappings` table with columns:
    - `id` INTEGER PRIMARY KEY
    - `xmltv_channel_id` INTEGER NOT NULL REFERENCES xmltv_channels(id) ON DELETE CASCADE
    - `xtream_channel_id` INTEGER NOT NULL REFERENCES xtream_channels(id) ON DELETE CASCADE
    - `match_confidence` REAL
    - `is_manual` BOOLEAN DEFAULT FALSE
    - `is_primary` BOOLEAN DEFAULT FALSE
    - `stream_priority` INTEGER DEFAULT 0
    - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - UNIQUE(xmltv_channel_id, xtream_channel_id)
  - [ ] 1.2 Create migration for `xmltv_channel_settings` table with columns:
    - `id` INTEGER PRIMARY KEY
    - `xmltv_channel_id` INTEGER NOT NULL UNIQUE REFERENCES xmltv_channels(id) ON DELETE CASCADE
    - `is_enabled` BOOLEAN DEFAULT FALSE
    - `plex_display_order` INTEGER
    - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - [ ] 1.3 Run `diesel migration run` to generate schema
  - [ ] 1.4 Create Rust models in `models.rs`: `ChannelMapping`, `NewChannelMapping`, `XmltvChannelSettings`, `NewXmltvChannelSettings`

- [ ] Task 2: Create matcher module foundation (AC: #1)
  - [ ] 2.1 Create `src-tauri/src/matcher/mod.rs` module structure
  - [ ] 2.2 Add `strsim` crate to Cargo.toml for Jaro-Winkler
  - [ ] 2.3 Create `MatchResult` struct to hold matching results
  - [ ] 2.4 Create `MatchConfig` struct for configurable thresholds

- [ ] Task 3: Implement name normalization (AC: #1)
  - [ ] 3.1 Create `normalize_channel_name()` function
  - [ ] 3.2 Implement lowercase conversion
  - [ ] 3.3 Implement HD/SD/FHD/4K/UHD suffix removal
  - [ ] 3.4 Implement punctuation stripping (preserve alphanumeric and spaces)
  - [ ] 3.5 Implement whitespace normalization (collapse multiple spaces)
  - [ ] 3.6 Add unit tests for normalization edge cases

- [ ] Task 4: Implement scoring algorithm (AC: #1)
  - [ ] 4.1 Create `calculate_match_score()` function using Jaro-Winkler
  - [ ] 4.2 Add EPG ID exact match boost (+0.15 if epg_channel_id matches xmltv channel_id)
  - [ ] 4.3 Add normalized name exact match boost (+0.10)
  - [ ] 4.4 Clamp final score to 1.0 maximum
  - [ ] 4.5 Add unit tests for scoring edge cases

- [ ] Task 5: Implement core matching algorithm (AC: #1, #2, #3)
  - [ ] 5.1 Create `match_channels()` function that takes XMLTV channels and Xtream channels
  - [ ] 5.2 For each XMLTV channel, iterate through all Xtream channels
  - [ ] 5.3 Calculate score for each pair using normalized names
  - [ ] 5.4 Filter matches above confidence threshold (default: 0.85)
  - [ ] 5.5 Sort matches by score descending
  - [ ] 5.6 Mark highest-confidence match as `is_primary = true`
  - [ ] 5.7 Assign `stream_priority` (0 = highest, incrementing for each additional match)
  - [ ] 5.8 Return `Vec<MatchResult>` with all matches

- [ ] Task 6: Implement database persistence (AC: #1, #2, #3)
  - [ ] 6.1 Create `save_channel_mappings()` function
  - [ ] 6.2 Clear existing auto-generated mappings before re-matching (preserve `is_manual = true`)
  - [ ] 6.3 Insert new `channel_mappings` records in batch
  - [ ] 6.4 Create/update `xmltv_channel_settings` for each XMLTV channel
  - [ ] 6.5 Set `is_enabled = false` for channels with no matches (AC #3)
  - [ ] 6.6 Preserve existing `is_enabled` state for channels that already have settings
  - [ ] 6.7 Wrap operations in a transaction for atomicity

- [ ] Task 7: Create Tauri commands (AC: #1, #4)
  - [ ] 7.1 Create `run_channel_matching()` command - triggers full matching algorithm
  - [ ] 7.2 Create `get_match_stats()` command - returns matching statistics (total XMLTV, matched, unmatched, pending)
  - [ ] 7.3 Create `get_match_threshold()` / `set_match_threshold()` commands for configurable threshold
  - [ ] 7.4 Register commands in lib.rs
  - [ ] 7.5 Add progress reporting during matching (emit events for UI progress bar)

- [ ] Task 8: Add TypeScript types and API functions (AC: #1)
  - [ ] 8.1 Add `ChannelMapping` interface to tauri.ts
  - [ ] 8.2 Add `XmltvChannelSettings` interface
  - [ ] 8.3 Add `MatchStats` interface
  - [ ] 8.4 Add `runChannelMatching()` function
  - [ ] 8.5 Add `getMatchStats()` function
  - [ ] 8.6 Add `getMatchThreshold()` / `setMatchThreshold()` functions

- [ ] Task 9: Testing and verification (AC: #1, #2, #3, #4)
  - [ ] 9.1 Add unit tests for `normalize_channel_name()` (10+ edge cases)
  - [ ] 9.2 Add unit tests for `calculate_match_score()` (10+ test cases)
  - [ ] 9.3 Add unit tests for `match_channels()` (5+ integration tests)
  - [ ] 9.4 Add performance test: matching 1000 XMLTV x 1000 Xtream channels < 60s
  - [ ] 9.5 Run `cargo check` - verify no errors
  - [ ] 9.6 Run `pnpm exec tsc --noEmit` - verify TypeScript compiles
  - [ ] 9.7 Build verification: `pnpm tauri build --debug`

## Dev Notes

### Architecture Compliance

**CRITICAL DESIGN PRINCIPLE:** XMLTV channels are the PRIMARY channel list for Plex. Xtream streams are matched TO XMLTV channels as video sources. This is the "XMLTV-first" architecture from the course correction.

**From PRD FR14:**
> System can perform fuzzy matching to associate Xtream streams with XMLTV channels. XMLTV channels are the primary channel list that defines what appears in Plex (channel names, numbers, icons, and EPG data)

[Source: _bmad-output/planning-artifacts/prd.md#Channel Matching]

**From Architecture - Channel Matcher Module:**
```
matcher/
├── mod.rs           # Module exports
├── fuzzy.rs         # Fuzzy matching algorithm
├── scorer.rs        # Match confidence scoring
└── auto_rematch.rs  # Change detection and rematch (Story 3-4)
```

[Source: _bmad-output/planning-artifacts/architecture.md#Core Modules - 3. Channel Matcher]

**From Architecture - Matching Algorithm:**
1. For each XMLTV channel, find candidate Xtream streams
2. Normalize channel names (lowercase, remove HD/SD/FHD suffixes, strip punctuation)
3. Calculate Jaro-Winkler similarity
4. Boost score for exact EPG ID matches
5. Apply confidence threshold (default: 0.85)
6. Return ranked matches with XMLTV as primary key

[Source: _bmad-output/planning-artifacts/architecture.md#Core Modules - 3. Channel Matcher]

**From Architecture - Database Schema:**
```sql
-- Channel mappings (XMLTV -> Xtream) - One XMLTV channel can have MULTIPLE Xtream streams
CREATE TABLE channel_mappings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    xtream_channel_id INTEGER NOT NULL REFERENCES xtream_channels(id) ON DELETE CASCADE,
    match_confidence REAL,
    is_manual BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,  -- Best match for this XMLTV channel
    stream_priority INTEGER DEFAULT 0,  -- Order for failover (0 = highest priority)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(xmltv_channel_id, xtream_channel_id)  -- Prevent duplicate mappings
);

-- XMLTV channel settings for Plex lineup (one per XMLTV channel)
CREATE TABLE xmltv_channel_settings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL UNIQUE REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT FALSE,  -- User must enable for Plex
    plex_display_order INTEGER,         -- Channel order in Plex lineup
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

[Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Database Schema]

### Technology Stack Additions

**Add to Cargo.toml:**
```toml
strsim = "0.11"  # Jaro-Winkler and other string similarity algorithms
```

The `strsim` crate provides Jaro-Winkler distance which is ideal for matching channel names:
- Good at handling typos and small variations
- Gives higher scores to strings that match from the beginning (prefix weighted)
- Efficient for comparing many string pairs

### Matching Algorithm Details

**Name Normalization Examples:**
| Input | Normalized Output |
|-------|------------------|
| "ESPN HD" | "espn" |
| "ESPN FHD" | "espn" |
| "ESPN - 4K" | "espn" |
| "BBC One (UK)" | "bbc one uk" |
| "CNN  News" | "cnn news" |
| "FOX Sports 1" | "fox sports 1" |

**Scoring Formula:**
```rust
fn calculate_match_score(xmltv: &str, xtream: &str, epg_id_match: bool, exact_name_match: bool) -> f64 {
    let base_score = strsim::jaro_winkler(xmltv, xtream);
    let epg_boost = if epg_id_match { 0.15 } else { 0.0 };
    let exact_boost = if exact_name_match { 0.10 } else { 0.0 };
    (base_score + epg_boost + exact_boost).min(1.0)
}
```

**Threshold Guidance:**
- 0.95+: Very high confidence (likely exact match with minor formatting differences)
- 0.85-0.95: High confidence (recommended default threshold)
- 0.70-0.85: Medium confidence (may need manual review)
- <0.70: Low confidence (likely wrong match)

### One-to-Many Mapping Strategy

The XMLTV-first design means:
1. Each XMLTV channel defines what appears in Plex
2. Multiple Xtream streams can map to ONE XMLTV channel
3. The highest-confidence match is marked `is_primary = true`
4. Other matches serve as failover sources (used in Story 4-5: Stream Failover)

Example:
```
XMLTV Channel: "ESPN"
├── Xtream Stream: "ESPN HD" (confidence: 0.98, is_primary: true, priority: 0)
├── Xtream Stream: "ESPN SD" (confidence: 0.95, is_primary: false, priority: 1)
└── Xtream Stream: "ESPN 4K" (confidence: 0.92, is_primary: false, priority: 2)
```

### Rust Model Patterns

Follow existing model patterns from `db/models.rs`:

```rust
/// Channel mapping model for querying
#[derive(Queryable, Selectable, Identifiable, Debug, Clone, Serialize)]
#[diesel(table_name = channel_mappings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[serde(rename_all = "camelCase")]
pub struct ChannelMapping {
    pub id: Option<i32>,
    pub xmltv_channel_id: i32,
    pub xtream_channel_id: i32,
    pub match_confidence: Option<f64>,
    pub is_manual: i32,  // SQLite uses INTEGER for BOOLEAN
    pub is_primary: i32,
    pub stream_priority: i32,
    pub created_at: String,
}

/// New channel mapping for insertion
#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = channel_mappings)]
pub struct NewChannelMapping {
    pub xmltv_channel_id: i32,
    pub xtream_channel_id: i32,
    pub match_confidence: Option<f64>,
    pub is_manual: i32,
    pub is_primary: i32,
    pub stream_priority: i32,
}

/// Match result struct for algorithm output
#[derive(Debug, Clone)]
pub struct MatchResult {
    pub xmltv_channel_id: i32,
    pub xtream_channel_id: i32,
    pub confidence: f64,
    pub is_primary: bool,
    pub stream_priority: i32,
    pub match_type: MatchType,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MatchType {
    ExactEpgId,    // epg_channel_id matches xmltv channel_id exactly
    ExactName,     // Normalized names match exactly
    Fuzzy,         // Jaro-Winkler match above threshold
    None,          // No match found
}
```

### Migration Naming Convention

Follow existing pattern from Story 2-6:
```
src-tauri/migrations/2026-01-19-HHMMSS_add_channel_mappings/up.sql
src-tauri/migrations/2026-01-19-HHMMSS_add_channel_mappings/down.sql
```

### Performance Considerations

**For NFR3 (< 60s for 1000 channels):**

1. **Pre-normalize all names**: Normalize once, store in memory
2. **Batch database operations**: Use bulk inserts, not individual INSERT statements
3. **Use transactions**: Single transaction for all writes
4. **Consider parallel scoring**: Use Rayon for parallel iteration if needed

```rust
// Example with pre-normalization
let xmltv_normalized: Vec<(i32, String)> = xmltv_channels
    .iter()
    .map(|c| (c.id.unwrap(), normalize_channel_name(&c.display_name)))
    .collect();

let xtream_normalized: Vec<(i32, String, Option<String>)> = xtream_channels
    .iter()
    .map(|c| (c.id.unwrap(), normalize_channel_name(&c.name), c.epg_channel_id.clone()))
    .collect();

// Then iterate and score
```

### Event Logging

Log matching events to `event_log` for troubleshooting:
- `category: "match"`
- `level: "info"` for successful matches
- `level: "warn"` for low-confidence matches (below 0.90 but above threshold)

```rust
// Log pattern from scheduler module
let details = serde_json::json!({
    "total_xmltv": xmltv_count,
    "total_xtream": xtream_count,
    "matched": matched_count,
    "unmatched": unmatched_count,
    "duration_ms": duration.as_millis()
});

log_event(&db, "info", "match", "Channel matching completed", Some(details)).await?;
```

### Previous Story Intelligence

**From Epic 2 Implementation:**
- Database connection pattern established in `db/connection.rs`
- Model patterns established in `db/models.rs`
- Command patterns established in `commands/` modules
- Event logging pattern established in `scheduler/mod.rs`
- Migration patterns established (see existing migrations)

**Key Files to Reference:**
- `src-tauri/src/db/models.rs` - Model patterns (XtreamChannel, XmltvChannel)
- `src-tauri/src/commands/channels.rs` - Channel command patterns
- `src-tauri/src/commands/epg.rs` - EPG command patterns, refresh_all_epg_sources
- `src-tauri/src/scheduler/mod.rs` - Event logging pattern

**Current Data Available:**
- `xtream_channels` table populated from Story 2-3
- `xmltv_channels` table populated from Story 2-5
- Both have `id`, `name`/`display_name`, and `epg_channel_id`/`channel_id` fields

### Project Structure Notes

**Files to Create:**
- `src-tauri/src/matcher/mod.rs` - Main matcher module
- `src-tauri/src/matcher/fuzzy.rs` - Fuzzy matching implementation
- `src-tauri/src/matcher/scorer.rs` - Scoring algorithm
- `src-tauri/migrations/YYYY-MM-DD-HHMMSS_add_channel_mappings/up.sql`
- `src-tauri/migrations/YYYY-MM-DD-HHMMSS_add_channel_mappings/down.sql`

**Files to Modify:**
- `src-tauri/Cargo.toml` - Add strsim crate
- `src-tauri/src/lib.rs` - Add matcher module, register new commands
- `src-tauri/src/db/models.rs` - Add ChannelMapping, XmltvChannelSettings models
- `src-tauri/src/db/schema.rs` - Will be auto-generated by Diesel
- `src/lib/tauri.ts` - Add TypeScript interfaces and functions

### Testing Strategy

**Unit Tests (in `matcher/mod.rs` or `matcher/fuzzy.rs`):**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_removes_hd_suffix() {
        assert_eq!(normalize_channel_name("ESPN HD"), "espn");
    }

    #[test]
    fn test_normalize_removes_4k_suffix() {
        assert_eq!(normalize_channel_name("ESPN 4K"), "espn");
    }

    #[test]
    fn test_scoring_exact_match() {
        let score = calculate_match_score("espn", "espn", false, true);
        assert!(score >= 0.99);
    }

    #[test]
    fn test_scoring_epg_id_boost() {
        let base = calculate_match_score("espn", "espn hd", false, false);
        let boosted = calculate_match_score("espn", "espn hd", true, false);
        assert!(boosted > base);
    }
}
```

**Performance Test:**
```rust
#[test]
#[ignore] // Run with: cargo test -- --ignored
fn test_matching_performance_1000_channels() {
    let xmltv = (0..1000).map(|i| XmltvChannel { id: Some(i), display_name: format!("Channel {}", i), /* ... */ }).collect::<Vec<_>>();
    let xtream = (0..1000).map(|i| XtreamChannel { id: Some(i), name: format!("Channel {} HD", i), /* ... */ }).collect::<Vec<_>>();

    let start = std::time::Instant::now();
    let results = match_channels(&xmltv, &xtream, 0.85);
    let duration = start.elapsed();

    assert!(duration.as_secs() < 60, "Matching took {:?}, expected < 60s", duration);
}
```

### Security Considerations

- No external network access in matching algorithm
- All operations are local database queries
- No credential handling in this story
- Input sanitization not required (data already in database from validated sources)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Core Modules - 3. Channel Matcher]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Database Schema]
- [Source: _bmad-output/planning-artifacts/prd.md#Channel Matching]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3 - Story 3.1]
- [strsim crate documentation](https://docs.rs/strsim/)
- [Jaro-Winkler algorithm](https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
