-- Restore the unique constraint (will fail if duplicate profiles exist)
DROP INDEX idx_matching_profiles_source_pair;

CREATE UNIQUE INDEX idx_matching_profiles_source_pair ON matching_profiles(xmltv_source_id, stream_source_type, stream_source_id);
