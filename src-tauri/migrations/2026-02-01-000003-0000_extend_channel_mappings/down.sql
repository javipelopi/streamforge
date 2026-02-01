-- Down migration for multi-source channel mappings
-- WARNING: This is a DESTRUCTIVE migration rollback!
-- All M3U and Acestream mappings will be PERMANENTLY DELETED.
-- Only Xtream mappings will be preserved.

-- CR-44: Safety check - abort if non-xtream mappings exist
-- This prevents accidental data loss.
SELECT CASE
    WHEN EXISTS (SELECT 1 FROM channel_mappings WHERE source_type != 'xtream')
    THEN RAISE(ABORT, 'Cannot rollback: M3U or Acestream mappings exist. Backup and migrate data before rolling back.')
END;

-- Drop new indexes first
DROP INDEX IF EXISTS idx_channel_mappings_acestream_id;
DROP INDEX IF EXISTS idx_channel_mappings_m3u_id;
DROP INDEX IF EXISTS idx_channel_mappings_source_type;

-- Create temporary table with original schema (xtream_channel_id NOT NULL)
CREATE TABLE channel_mappings_backup (
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

-- Copy only Xtream mappings back
-- NOTE: M3U and Acestream mappings are intentionally excluded and will be lost
INSERT INTO channel_mappings_backup
SELECT id, xmltv_channel_id, xtream_channel_id, match_confidence, is_manual, is_primary, stream_priority, created_at
FROM channel_mappings
WHERE source_type = 'xtream' AND xtream_channel_id IS NOT NULL;

-- Drop and recreate
DROP TABLE channel_mappings;
ALTER TABLE channel_mappings_backup RENAME TO channel_mappings;

-- Recreate original indexes
CREATE INDEX idx_channel_mappings_xmltv_id ON channel_mappings(xmltv_channel_id);
CREATE INDEX idx_channel_mappings_xtream_id ON channel_mappings(xtream_channel_id);
