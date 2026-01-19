-- Channel mappings (XMLTV -> Xtream) - One XMLTV channel can have MULTIPLE Xtream streams
-- This follows the XMLTV-first architecture where XMLTV channels define the Plex lineup
-- and Xtream streams are matched TO XMLTV channels as video sources
CREATE TABLE channel_mappings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    xtream_channel_id INTEGER NOT NULL REFERENCES xtream_channels(id) ON DELETE CASCADE,
    match_confidence REAL,
    is_manual INTEGER DEFAULT 0,
    is_primary INTEGER DEFAULT 0,
    stream_priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(xmltv_channel_id, xtream_channel_id)
);

-- Index for quick lookup of mappings by XMLTV channel
CREATE INDEX idx_channel_mappings_xmltv_id ON channel_mappings(xmltv_channel_id);

-- Index for quick lookup of mappings by Xtream channel
CREATE INDEX idx_channel_mappings_xtream_id ON channel_mappings(xtream_channel_id);
