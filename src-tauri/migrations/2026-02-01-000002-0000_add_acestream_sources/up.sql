-- Acestream Sources
-- Stores Acestream content IDs for P2P streaming
CREATE TABLE acestream_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content_id TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    -- Timestamps use ISO8601 format: 'YYYY-MM-DD HH:MM:SS' via datetime('now')
    -- Note: updated_at must be set by application code on UPDATE operations.
    -- SQLite doesn't support automatic timestamp triggers without extensions.
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (is_active IN (0, 1)),
    CHECK (length(content_id) = 40 AND content_id GLOB '[0-9a-f]*')
);

-- Index for filtering by active status
CREATE INDEX idx_acestream_sources_is_active ON acestream_sources(is_active);
