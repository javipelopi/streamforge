# Story 6.2: Configuration Export/Import

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to export and import my configuration,
So that I can backup my settings or migrate to a new machine.

## Acceptance Criteria

1. **Export Configuration Button**
   - Given the Settings view
   - When I click "Export Configuration"
   - Then a file save dialog opens
   - And I can choose the save location and filename

2. **Export File Contents**
   - Given I complete the export
   - Then a JSON file is saved containing:
     - All application settings (server port, autostart, EPG schedule)
     - Account info (name, server_url, username - **excluding passwords**)
     - XMLTV source URLs and settings
     - Channel mappings (XMLTV to Xtream associations)
     - Channel enable/disable states
     - Display order preferences (Plex lineup order)
   - And the file includes metadata (version, export date)

3. **Import Configuration Button**
   - Given I have a configuration export file
   - When I click "Import Configuration" and select the file
   - Then a preview dialog shows what will be imported

4. **Import Preview Dialog**
   - Given the preview dialog is displayed
   - Then I see a summary of:
     - Number of accounts (with note: "Passwords must be re-entered")
     - Number of XMLTV sources
     - Number of channel mappings
     - Settings that will be applied
   - And I can confirm or cancel the import

5. **Import Confirmation and Execution**
   - Given I confirm the import
   - When the import completes
   - Then all settings are applied
   - And I'm prompted to re-enter account passwords (not exported for security)
   - And a success message is shown
   - And existing data is replaced (not merged)

6. **Import Error Handling**
   - Given the import file is invalid, corrupted, or incompatible version
   - When import is attempted
   - Then an error message explains the problem
   - And existing configuration is not modified
   - And the user can try another file or cancel

## Tasks / Subtasks

- [ ] Task 1: Create Rust export command (AC: #1, #2)
  - [ ] 1.1: Define ConfigExport struct with all exportable data
  - [ ] 1.2: Implement `export_configuration` Tauri command
  - [ ] 1.3: Query all settings from settings table
  - [ ] 1.4: Query all accounts (exclude password_encrypted field)
  - [ ] 1.5: Query all xmltv_sources
  - [ ] 1.6: Query all channel_mappings with settings
  - [ ] 1.7: Query all xmltv_channel_settings (enabled state, display order)
  - [ ] 1.8: Serialize to JSON with metadata (version, date)
  - [ ] 1.9: Use Tauri file dialog for save location

- [ ] Task 2: Create Rust import command (AC: #3, #4, #5, #6)
  - [ ] 2.1: Define ConfigImport validation types
  - [ ] 2.2: Implement `validate_import_file` Tauri command (for preview)
  - [ ] 2.3: Implement `import_configuration` Tauri command
  - [ ] 2.4: Validate JSON structure and version compatibility
  - [ ] 2.5: Use Tauri file dialog for file selection
  - [ ] 2.6: Begin database transaction for atomic import
  - [ ] 2.7: Clear existing data (settings, accounts, sources, mappings)
  - [ ] 2.8: Insert imported settings
  - [ ] 2.9: Insert accounts with placeholder passwords (empty/flag)
  - [ ] 2.10: Insert xmltv_sources
  - [ ] 2.11: Insert channel_mappings (handle FK dependencies)
  - [ ] 2.12: Insert xmltv_channel_settings
  - [ ] 2.13: Commit transaction or rollback on error

- [ ] Task 3: Add TypeScript bindings (AC: #1, #3)
  - [ ] 3.1: Add `exportConfiguration()` function to tauri.ts
  - [ ] 3.2: Add `validateImportFile(path: string)` function to tauri.ts
  - [ ] 3.3: Add `importConfiguration(path: string)` function to tauri.ts
  - [ ] 3.4: Define TypeScript types for ConfigExport and ImportPreview

- [ ] Task 4: Create Export UI in Settings.tsx (AC: #1)
  - [ ] 4.1: Add "Configuration Backup" section to Settings view
  - [ ] 4.2: Add "Export Configuration" button with download icon
  - [ ] 4.3: Show loading state during export
  - [ ] 4.4: Show success toast with file path on completion
  - [ ] 4.5: Show error message if export fails

- [ ] Task 5: Create Import UI and Preview Dialog (AC: #3, #4, #5)
  - [ ] 5.1: Add "Import Configuration" button next to Export
  - [ ] 5.2: Create ImportPreviewDialog component
  - [ ] 5.3: Display import summary (accounts, sources, mappings counts)
  - [ ] 5.4: Show security warning about password re-entry
  - [ ] 5.5: Add Confirm/Cancel buttons
  - [ ] 5.6: Show loading state during import
  - [ ] 5.7: Show success message with password re-entry prompt
  - [ ] 5.8: Navigate to Accounts view after import for password entry

- [ ] Task 6: Implement error handling (AC: #6)
  - [ ] 6.1: Validate JSON parse errors with user message
  - [ ] 6.2: Validate version compatibility (min/max supported versions)
  - [ ] 6.3: Validate required fields presence
  - [ ] 6.4: Handle database constraint violations gracefully
  - [ ] 6.5: Ensure rollback on any import failure

- [ ] Task 7: Write tests (All ACs)
  - [ ] 7.1: Unit test for ConfigExport struct serialization
  - [ ] 7.2: Unit test for import validation logic
  - [ ] 7.3: Integration test for export/import round-trip
  - [ ] 7.4: E2E test for export button flow
  - [ ] 7.5: E2E test for import with preview dialog
  - [ ] 7.6: E2E test for invalid file error handling

## Dev Notes

### Architecture Patterns to Follow

**Frontend (React + TypeScript):**
- Follow existing Settings.tsx patterns (form-based with Save/Reset buttons)
- Use Tailwind CSS consistent with existing sections
- Use `invoke<Type>('command_name', { params })` pattern for Tauri calls
- Import preview dialog: Modal component with summary and action buttons

**Backend (Rust + Tauri):**
- Commands in `src-tauri/src/commands/mod.rs` or new `config.rs` submodule
- Use `State<DbConnection>` pattern for database access
- Use Diesel queries consistent with existing commands
- Transaction pattern: Diesel's `conn.transaction(|conn| { ... })`

### Export File Format (JSON)

```json
{
  "version": "1.0",
  "exportDate": "2026-01-23T12:00:00Z",
  "appVersion": "0.1.0",
  "data": {
    "settings": {
      "server_port": "5004",
      "autostart_enabled": "true",
      "epg_schedule_hour": "4",
      "epg_schedule_minute": "0",
      "epg_schedule_enabled": "true"
    },
    "accounts": [
      {
        "id": 1,
        "name": "My Provider",
        "server_url": "http://provider.example.com",
        "username": "user123",
        "max_connections": 2,
        "is_active": true
      }
    ],
    "xmltv_sources": [
      {
        "id": 1,
        "name": "EPG Source 1",
        "url": "http://epg.example.com/guide.xml",
        "format": "xml",
        "refresh_hour": 4,
        "is_active": true
      }
    ],
    "channel_mappings": [
      {
        "xmltv_channel_id": 1,
        "xtream_channel_id": 42,
        "match_confidence": 0.95,
        "is_manual": false,
        "is_primary": true,
        "stream_priority": 0
      }
    ],
    "xmltv_channel_settings": [
      {
        "xmltv_channel_id": 1,
        "is_enabled": true,
        "plex_display_order": 1
      }
    ]
  }
}
```

### Security Considerations

**CRITICAL: Passwords are NEVER exported**
- The `password_encrypted` field from accounts table is excluded
- On import, accounts are created with a "needs password" flag
- User is prompted to enter passwords in Accounts view after import
- This prevents credential theft if export file is compromised

### Database Schema Reference

**From architecture.md:**
```sql
-- Settings table (key-value)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Accounts (password_encrypted is NOT exported)
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted BLOB NOT NULL,
    max_connections INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- XMLTV Sources
CREATE TABLE xmltv_sources (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    format TEXT DEFAULT 'xml',
    refresh_hour INTEGER DEFAULT 4,
    last_refresh TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Channel Mappings (XMLTV -> Xtream)
CREATE TABLE channel_mappings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL,
    xtream_channel_id INTEGER NOT NULL,
    match_confidence REAL,
    is_manual BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,
    stream_priority INTEGER DEFAULT 0
);

-- XMLTV Channel Settings (Plex lineup)
CREATE TABLE xmltv_channel_settings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL UNIQUE,
    is_enabled BOOLEAN DEFAULT FALSE,
    plex_display_order INTEGER
);
```

### Tauri File Dialog Usage

**Tauri 2.0 Dialog Plugin:**
```rust
use tauri_plugin_dialog::DialogExt;

// Save dialog for export
let file_path = app.dialog()
    .file()
    .add_filter("JSON", &["json"])
    .set_file_name("streamforge-config.json")
    .blocking_save_file();

// Open dialog for import
let file_path = app.dialog()
    .file()
    .add_filter("JSON", &["json"])
    .blocking_pick_file();
```

### Import Flow Sequence

1. User clicks "Import Configuration"
2. File picker opens (JSON filter)
3. User selects file
4. Backend validates file structure → returns ImportPreview
5. Frontend shows preview dialog with summary
6. User confirms import
7. Backend performs atomic import in transaction:
   - Clear settings, accounts, sources, mappings, channel_settings
   - Insert all imported data
   - Mark accounts as needing password re-entry
8. Frontend shows success message
9. Navigate to Accounts view for password entry

### What NOT to Export

Per architecture requirements:
- `password_encrypted` (security)
- `expiry_date`, `max_connections_actual` (runtime connection data)
- `last_refresh` on xmltv_sources (runtime state)
- `event_log` table (diagnostic data, not config)
- `xtream_channels` table (re-fetched from provider)
- `xmltv_channels` table (re-fetched from XMLTV source)
- `programs` table (EPG data, re-fetched)

### Project Structure Notes

**Files to Create/Modify:**
- `src-tauri/src/commands/config.rs` (new) - Export/import commands
- `src-tauri/src/commands/mod.rs` - Register new module
- `src-tauri/src/lib.rs` - Register new commands in invoke_handler
- `src/lib/tauri.ts` - Add TypeScript bindings
- `src/views/Settings.tsx` - Add Configuration Backup section
- `src/components/settings/ImportPreviewDialog.tsx` (new)

**Tauri Plugin Dependencies:**
- `tauri-plugin-dialog` - Already available in Tauri 2.0 for file dialogs

### Previous Story Learnings (6-1)

From Story 6-1 Settings GUI implementation:
- Settings.tsx uses form-based architecture with unsaved changes tracking
- Sections use consistent card styling: `bg-white rounded-lg shadow p-4`
- Success/error messages via toast notifications
- Loading states during async operations
- TypeScript bindings follow `invoke<Type>('command', { param })` pattern

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema]
- [Source: _bmad-output/planning-artifacts/architecture.md#Security Considerations]
- [Source: src/views/Settings.tsx - existing patterns]
- [Source: src-tauri/src/commands/mod.rs - command patterns]
- [Source: src-tauri/src/db/models.rs - data structures]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
