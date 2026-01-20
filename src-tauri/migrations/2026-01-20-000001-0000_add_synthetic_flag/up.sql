-- Add is_synthetic column to xmltv_channels table
-- Story 3-8: Manage Orphan Xtream Channels
--
-- When an Xtream channel is "promoted" to Plex without a matching XMLTV channel,
-- a synthetic XMLTV channel entry is created with is_synthetic = 1.
-- These synthetic channels get placeholder EPG data.

ALTER TABLE xmltv_channels ADD COLUMN is_synthetic INTEGER DEFAULT 0;
