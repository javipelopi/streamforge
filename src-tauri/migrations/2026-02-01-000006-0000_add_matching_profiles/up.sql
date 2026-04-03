-- Matching profiles: per-source-pair normalization rules for channel matching
-- Each profile defines normalization rules applied before fuzzy matching
-- for a specific XMLTV source × stream source pair.
-- Rule order (priority_order) determines stream priority: first match = primary.

CREATE TABLE matching_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- The XMLTV source these rules apply to
    xmltv_source_id INTEGER NOT NULL REFERENCES xmltv_sources(id) ON DELETE CASCADE,
    -- Stream source type: "xtream", "m3u", "acestream"
    stream_source_type TEXT NOT NULL CHECK(stream_source_type IN ('xtream', 'm3u', 'acestream')),
    -- Stream source ID (account_id for xtream, m3u_sources.id for m3u, acestream_sources.id for acestream)
    stream_source_id INTEGER NOT NULL,
    -- Priority order: lower = higher priority. Determines stream failover order.
    priority_order INTEGER NOT NULL DEFAULT 0,
    -- JSON array of normalization rules, e.g.:
    -- [{"type":"strip_prefix","value":"Spain "},{"type":"strip_suffix","value":" HD"},{"type":"regex_replace","pattern":"\\bES:\\s*","replacement":""}]
    rules TEXT NOT NULL DEFAULT '[]',
    -- Whether this profile is active
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast lookup by XMLTV source
CREATE INDEX idx_matching_profiles_xmltv_source ON matching_profiles(xmltv_source_id);

-- Unique constraint: one profile per source pair
CREATE UNIQUE INDEX idx_matching_profiles_source_pair ON matching_profiles(xmltv_source_id, stream_source_type, stream_source_id);
