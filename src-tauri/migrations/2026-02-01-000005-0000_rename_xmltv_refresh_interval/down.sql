-- Revert: rename refresh_interval_hours back to refresh_hour

-- Create table with original column name
CREATE TABLE xmltv_sources_old (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'xmltv',
    refresh_hour INTEGER NOT NULL DEFAULT 4,
    last_refresh TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Copy data back
INSERT INTO xmltv_sources_old (id, name, url, format, refresh_hour, last_refresh, is_active, created_at, updated_at)
SELECT id, name, url, format, refresh_interval_hours, last_refresh, is_active, created_at, updated_at
FROM xmltv_sources;

-- Drop new table
DROP TABLE xmltv_sources;

-- Rename old table back
ALTER TABLE xmltv_sources_old RENAME TO xmltv_sources;
