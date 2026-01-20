-- Migration: Add performance indexes for M3U playlist generation
-- Story 4-1 Code Review: Fix MEDIUM-2
--
-- These indexes optimize the M3U playlist query which filters on is_enabled
-- and orders by plex_display_order. Without indexes, the query does table scans.

-- Index on xmltv_channel_settings.is_enabled for fast filtering
CREATE INDEX IF NOT EXISTS idx_xmltv_channel_settings_enabled
ON xmltv_channel_settings(is_enabled)
WHERE is_enabled = 1;

-- Composite index on (is_enabled, plex_display_order) for optimal query performance
-- This supports both filtering and ordering in a single index lookup
CREATE INDEX IF NOT EXISTS idx_xmltv_channel_settings_enabled_order
ON xmltv_channel_settings(is_enabled, plex_display_order);

-- Index on channel_mappings for EXISTS subquery performance
CREATE INDEX IF NOT EXISTS idx_channel_mappings_xmltv_channel_id
ON channel_mappings(xmltv_channel_id);

-- Composite index for logo fallback query optimization
-- Supports ORDER BY is_primary DESC, stream_priority ASC
CREATE INDEX IF NOT EXISTS idx_channel_mappings_logo_lookup
ON channel_mappings(xmltv_channel_id, is_primary, stream_priority);
