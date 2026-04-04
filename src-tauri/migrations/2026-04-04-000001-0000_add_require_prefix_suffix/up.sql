-- Add require_prefix and require_suffix toggles to matching_profiles.
-- Default 1 (true): only streams matching the prefix/suffix regex are candidates.
-- When 0 (false): the prefix/suffix is still stripped if present, but streams without it also match.
ALTER TABLE matching_profiles ADD COLUMN require_prefix INTEGER NOT NULL DEFAULT 1;
ALTER TABLE matching_profiles ADD COLUMN require_suffix INTEGER NOT NULL DEFAULT 1;
