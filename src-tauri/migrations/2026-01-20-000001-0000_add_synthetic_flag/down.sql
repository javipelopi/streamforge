-- Rollback: Remove is_synthetic column
-- Note: SQLite has limited ALTER TABLE support.
-- For proper rollback, we need to recreate the table without the column.

-- Create temporary table without is_synthetic
CREATE TABLE xmltv_channels_backup (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES xmltv_sources(id),
    channel_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    icon TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy data (excluding is_synthetic)
INSERT INTO xmltv_channels_backup (id, source_id, channel_id, display_name, icon, created_at, updated_at)
SELECT id, source_id, channel_id, display_name, icon, created_at, updated_at
FROM xmltv_channels;

-- Drop original table
DROP TABLE xmltv_channels;

-- Rename backup to original
ALTER TABLE xmltv_channels_backup RENAME TO xmltv_channels;
