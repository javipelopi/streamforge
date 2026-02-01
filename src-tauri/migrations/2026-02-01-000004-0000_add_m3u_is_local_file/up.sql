-- Add is_local_file column to m3u_sources
-- Indicates whether the source is a local file path vs remote URL
-- Local files don't support auto-refresh (refresh_interval_hours will be 0)

ALTER TABLE m3u_sources ADD COLUMN is_local_file INTEGER NOT NULL DEFAULT 0;

-- Create index for filtering local vs remote sources
CREATE INDEX idx_m3u_sources_is_local_file ON m3u_sources(is_local_file);
