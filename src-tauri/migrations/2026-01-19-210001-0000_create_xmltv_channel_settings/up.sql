-- XMLTV channel settings for Plex lineup (one per XMLTV channel)
-- Controls which channels appear in Plex and their display order
CREATE TABLE xmltv_channel_settings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL UNIQUE REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    is_enabled INTEGER DEFAULT 0 CHECK (is_enabled IN (0, 1)),
    plex_display_order INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index for quick lookup by XMLTV channel
CREATE INDEX idx_xmltv_channel_settings_channel_id ON xmltv_channel_settings(xmltv_channel_id);

-- Index for ordering enabled channels in Plex lineup
CREATE INDEX idx_xmltv_channel_settings_enabled_order ON xmltv_channel_settings(is_enabled, plex_display_order);

-- Trigger to auto-update updated_at timestamp on modification
CREATE TRIGGER update_xmltv_channel_settings_timestamp
AFTER UPDATE ON xmltv_channel_settings
FOR EACH ROW
BEGIN
    UPDATE xmltv_channel_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
