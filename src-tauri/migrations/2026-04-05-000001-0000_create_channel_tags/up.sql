-- Channel tags: user-defined labels on XMLTV channels for filtered playlist endpoints.
-- Use case: one StreamForge instance serves multiple Plex/Jellyfin tuners,
-- each pointing to /playlist.m3u?tag=spain or /epg.xml?tag=movies.
CREATE TABLE channel_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    xmltv_channel_id INTEGER NOT NULL REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(xmltv_channel_id, tag)
);

CREATE INDEX idx_channel_tags_xmltv ON channel_tags(xmltv_channel_id);
CREATE INDEX idx_channel_tags_tag ON channel_tags(tag);
