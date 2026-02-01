-- M3U Playlist Sources
-- Stores M3U/M3U8 playlist URLs for fetching channel streams
CREATE TABLE m3u_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    refresh_interval_hours INTEGER NOT NULL DEFAULT 24,
    last_refresh TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    -- Timestamps use ISO8601 format: 'YYYY-MM-DD HH:MM:SS' via datetime('now')
    -- Note: updated_at must be set by application code on UPDATE operations.
    -- SQLite doesn't support automatic timestamp triggers without extensions.
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (refresh_interval_hours >= 1 AND refresh_interval_hours <= 168),
    CHECK (is_active IN (0, 1))
);

-- Index for filtering by active status
CREATE INDEX idx_m3u_sources_is_active ON m3u_sources(is_active);

-- M3U Channels parsed from playlists
-- Each channel entry from an M3U playlist gets stored here
CREATE TABLE m3u_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES m3u_sources(id) ON DELETE CASCADE,
    stream_url TEXT NOT NULL,
    name TEXT NOT NULL,
    tvg_id TEXT,
    tvg_name TEXT,
    tvg_logo TEXT,
    group_title TEXT,
    -- Timestamps use ISO8601 format: 'YYYY-MM-DD HH:MM:SS' via datetime('now')
    -- Note: updated_at must be set by application code on UPDATE operations.
    -- SQLite doesn't support automatic timestamp triggers without extensions.
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_id, stream_url)
);

-- Index for quick lookup by source
CREATE INDEX idx_m3u_channels_source_id ON m3u_channels(source_id);

-- Index for matching by tvg_id
CREATE INDEX idx_m3u_channels_tvg_id ON m3u_channels(tvg_id);

-- CR-43: Index for fuzzy matching searches by name
CREATE INDEX idx_m3u_channels_name ON m3u_channels(name);

-- Index for filtering channels by category
CREATE INDEX idx_m3u_channels_group_title ON m3u_channels(group_title);
