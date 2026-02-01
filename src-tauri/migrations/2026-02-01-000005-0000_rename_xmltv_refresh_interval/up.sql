-- Rename refresh_hour to refresh_interval_hours in xmltv_sources
-- SQLite doesn't support direct column rename, so we recreate the table

-- Create new table with correct column name
CREATE TABLE xmltv_sources_new (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'xmltv',
    refresh_interval_hours INTEGER NOT NULL DEFAULT 24,
    last_refresh TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Copy data from old table (refresh_hour becomes refresh_interval_hours)
INSERT INTO xmltv_sources_new (id, name, url, format, refresh_interval_hours, last_refresh, is_active, created_at, updated_at)
SELECT id, name, url, format, refresh_hour, last_refresh, is_active, created_at, updated_at
FROM xmltv_sources;

-- Drop old table
DROP TABLE xmltv_sources;

-- Rename new table to original name
ALTER TABLE xmltv_sources_new RENAME TO xmltv_sources;
