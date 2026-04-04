-- Drop the unique constraint on (xmltv_source_id, stream_source_type, stream_source_id)
-- to allow multiple matching profiles per XMLTV+stream source pair.
-- The priority_order column already handles ordering between profiles.

DROP INDEX idx_matching_profiles_source_pair;

-- Recreate as a non-unique index for query performance
CREATE INDEX idx_matching_profiles_source_pair ON matching_profiles(xmltv_source_id, stream_source_type, stream_source_id);
