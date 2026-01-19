-- Programs table
-- Stores EPG program data parsed from XMLTV sources

CREATE TABLE programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    xmltv_channel_id INTEGER NOT NULL REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    category TEXT,
    episode_info TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient queries by channel and time
CREATE INDEX idx_programs_channel_time ON programs(xmltv_channel_id, start_time);
