-- XMLTV Channels table
-- Stores channel information parsed from XMLTV sources

CREATE TABLE xmltv_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES xmltv_sources(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    icon TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_id, channel_id)
);

-- Index for efficient lookups by source
CREATE INDEX idx_xmltv_channels_source_id ON xmltv_channels(source_id);
