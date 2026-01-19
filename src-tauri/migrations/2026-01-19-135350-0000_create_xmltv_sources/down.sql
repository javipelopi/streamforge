-- Revert XMLTV sources table
DROP INDEX IF EXISTS idx_xmltv_sources_is_active;
DROP TABLE IF EXISTS xmltv_sources;
