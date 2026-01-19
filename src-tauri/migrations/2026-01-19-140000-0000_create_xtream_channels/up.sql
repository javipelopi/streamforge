-- Create xtream_channels table for storing channels from Xtream provider
-- Implements FR3 (channel list retrieval) and FR4 (quality tier detection) from PRD

CREATE TABLE xtream_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    stream_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    stream_icon TEXT,
    category_id INTEGER,
    category_name TEXT,
    qualities TEXT DEFAULT '["SD"]',
    epg_channel_id TEXT,
    tv_archive INTEGER DEFAULT 0,
    tv_archive_duration INTEGER DEFAULT 0,
    added_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(account_id, stream_id)
);

-- Index for fast lookups by account_id (most common query pattern)
CREATE INDEX idx_xtream_channels_account_id ON xtream_channels(account_id);

-- Index for category filtering
CREATE INDEX idx_xtream_channels_category_id ON xtream_channels(category_id);

-- Index for EPG matching
CREATE INDEX idx_xtream_channels_epg_channel_id ON xtream_channels(epg_channel_id);
