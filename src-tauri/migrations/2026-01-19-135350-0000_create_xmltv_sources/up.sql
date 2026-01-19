-- XMLTV EPG Sources
-- Stores external XMLTV source URLs for fetching EPG data
CREATE TABLE xmltv_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    format TEXT NOT NULL DEFAULT 'auto' CHECK(format IN ('xml', 'xml_gz', 'auto')),
    refresh_hour INTEGER NOT NULL DEFAULT 4 CHECK(refresh_hour >= 0 AND refresh_hour <= 23),
    last_refresh TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for filtering by active status
CREATE INDEX idx_xmltv_sources_is_active ON xmltv_sources(is_active);
