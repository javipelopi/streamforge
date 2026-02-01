-- Remove is_local_file column from m3u_sources
-- WARNING: This drops the column, losing local file source identification

DROP INDEX IF EXISTS idx_m3u_sources_is_local_file;

-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
CREATE TABLE m3u_sources_backup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    refresh_interval_hours INTEGER NOT NULL DEFAULT 24,
    last_refresh TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO m3u_sources_backup (id, name, url, refresh_interval_hours, last_refresh, is_active, created_at, updated_at)
SELECT id, name, url, refresh_interval_hours, last_refresh, is_active, created_at, updated_at
FROM m3u_sources;

DROP TABLE m3u_sources;

ALTER TABLE m3u_sources_backup RENAME TO m3u_sources;

-- Recreate indexes
CREATE INDEX idx_m3u_sources_is_active ON m3u_sources(is_active);
