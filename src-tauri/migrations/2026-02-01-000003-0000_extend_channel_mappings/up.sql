-- Extend channel_mappings for multi-source support
-- Add source_type column to distinguish Xtream, M3U, and Acestream mappings
-- Add nullable FK columns for M3U and Acestream sources
-- Make xtream_channel_id NULLABLE for non-Xtream mappings (CR-5)
-- Add CHECK constraints for data integrity (CR-18, CR-23)

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
-- to make xtream_channel_id NULLABLE and add CHECK constraints
-- Note: Diesel wraps each migration in a transaction automatically

-- Step 1: Create new table with proper schema
CREATE TABLE channel_mappings_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    xmltv_channel_id INTEGER NOT NULL REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    xtream_channel_id INTEGER REFERENCES xtream_channels(id) ON DELETE CASCADE, -- Now NULLABLE (CR-5)
    match_confidence REAL,
    is_manual INTEGER DEFAULT 0,
    is_primary INTEGER DEFAULT 0,
    stream_priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'xtream',
    m3u_channel_id INTEGER REFERENCES m3u_channels(id) ON DELETE CASCADE,
    acestream_source_id INTEGER REFERENCES acestream_sources(id) ON DELETE CASCADE,

    -- CR-18: Constrain source_type to valid values only
    CHECK (source_type IN ('xtream', 'm3u', 'acestream')),

    -- CR-23: Ensure FK consistency based on source_type
    -- Xtream mappings must have xtream_channel_id and no other source IDs
    -- M3U mappings must have m3u_channel_id and no other source IDs
    -- Acestream mappings must have acestream_source_id and no other source IDs
    CHECK (
        (source_type = 'xtream' AND xtream_channel_id IS NOT NULL AND m3u_channel_id IS NULL AND acestream_source_id IS NULL) OR
        (source_type = 'm3u' AND m3u_channel_id IS NOT NULL AND xtream_channel_id IS NULL AND acestream_source_id IS NULL) OR
        (source_type = 'acestream' AND acestream_source_id IS NOT NULL AND xtream_channel_id IS NULL AND m3u_channel_id IS NULL)
    ),

    UNIQUE(xmltv_channel_id, xtream_channel_id),
    UNIQUE(xmltv_channel_id, m3u_channel_id),
    UNIQUE(xmltv_channel_id, acestream_source_id)
);

-- Step 2: Copy existing data (all existing mappings are Xtream type)
INSERT INTO channel_mappings_new (
    id, xmltv_channel_id, xtream_channel_id, match_confidence,
    is_manual, is_primary, stream_priority, created_at, source_type
)
SELECT
    id, xmltv_channel_id, xtream_channel_id, match_confidence,
    is_manual, is_primary, stream_priority, created_at, 'xtream'
FROM channel_mappings;

-- Step 3: Drop old table
DROP TABLE channel_mappings;

-- Step 4: Rename new table
ALTER TABLE channel_mappings_new RENAME TO channel_mappings;

-- Step 5: Recreate indexes
CREATE INDEX idx_channel_mappings_xmltv_id ON channel_mappings(xmltv_channel_id);
CREATE INDEX idx_channel_mappings_xtream_id ON channel_mappings(xtream_channel_id) WHERE xtream_channel_id IS NOT NULL;
CREATE INDEX idx_channel_mappings_source_type ON channel_mappings(source_type);
CREATE INDEX idx_channel_mappings_m3u_id ON channel_mappings(m3u_channel_id);
CREATE INDEX idx_channel_mappings_acestream_id ON channel_mappings(acestream_source_id);
