-- Create settings table for app configuration key-value storage
CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES ('server_port', '5004');
INSERT INTO settings (key, value) VALUES ('auto_start', 'false');
