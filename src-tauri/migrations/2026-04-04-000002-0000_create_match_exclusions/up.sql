-- Match exclusions: records (xmltv_channel, xtream_stream) pairs the user removed
-- so the auto-matcher skips them on future runs.
CREATE TABLE match_exclusions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    xmltv_channel_id INTEGER NOT NULL REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    xtream_channel_id INTEGER NOT NULL REFERENCES xtream_channels(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(xmltv_channel_id, xtream_channel_id)
);

CREATE INDEX idx_match_exclusions_xmltv ON match_exclusions(xmltv_channel_id);
CREATE INDEX idx_match_exclusions_xtream ON match_exclusions(xtream_channel_id);
