# Story 2.4: Add XMLTV Source Management

Status: ready-for-dev

## Story

As a user,
I want to add and manage XMLTV EPG sources,
So that I can get program guide data for my channels.

## Acceptance Criteria

1. **Given** the Accounts view (EPG Sources section)
   **When** I click "Add EPG Source"
   **Then** a form appears with fields:
   - Source name
   - URL
   - Format (auto-detect or manual: xml, xml.gz)

2. **Given** I submit a valid XMLTV URL
   **When** the source is saved
   **Then** it appears in the EPG sources list
   **And** is stored in `xmltv_sources` table

3. **Given** multiple EPG sources exist
   **When** I view the sources list
   **Then** I can edit or delete each source
   **And** I can enable/disable individual sources

## Tasks / Subtasks

- [ ] Task 1: Create database migration for xmltv_sources table (AC: #2)
  - [ ] 1.1 Generate migration: `diesel migration generate create_xmltv_sources`
  - [ ] 1.2 Create `xmltv_sources` table with columns: id, name, url, format (enum: xml, xml.gz, auto), refresh_hour (default 4), last_refresh, is_active, created_at, updated_at
  - [ ] 1.3 Add UNIQUE constraint on url to prevent duplicates
  - [ ] 1.4 Run migration and verify schema.rs updates

- [ ] Task 2: Create Diesel models for xmltv_sources (AC: #2)
  - [ ] 2.1 Create `XmltvSource` struct in `src-tauri/src/db/models.rs` for querying
  - [ ] 2.2 Create `NewXmltvSource` struct for inserting records
  - [ ] 2.3 Create `XmltvSourceUpdate` changeset for partial updates (name, url, format, refresh_hour, is_active)
  - [ ] 2.4 Add helper methods for CRUD operations

- [ ] Task 3: Create Tauri commands for XMLTV source management (AC: #1, #2, #3)
  - [ ] 3.1 Create `src-tauri/src/commands/epg.rs` module
  - [ ] 3.2 Implement `add_xmltv_source(name, url, format)` command
  - [ ] 3.3 Implement `get_xmltv_sources()` command to list all sources
  - [ ] 3.4 Implement `update_xmltv_source(id, updates)` command for editing
  - [ ] 3.5 Implement `delete_xmltv_source(id)` command
  - [ ] 3.6 Implement `toggle_xmltv_source(id, is_active)` command for enable/disable
  - [ ] 3.7 Add URL validation (must be valid http/https URL)
  - [ ] 3.8 Register commands in lib.rs

- [ ] Task 4: Implement format detection logic (AC: #1)
  - [ ] 4.1 Create `detect_xmltv_format(url: &str) -> XmltvFormat` function
  - [ ] 4.2 Check URL suffix for .xml.gz or .xml
  - [ ] 4.3 Check Content-Type header if URL doesn't indicate format
  - [ ] 4.4 Check for gzip magic bytes in response for .gz detection
  - [ ] 4.5 Return format enum: Xml, XmlGz, Auto

- [ ] Task 5: Create TypeScript types and API functions (AC: #1, #2, #3)
  - [ ] 5.1 Add `XmltvSource` interface in `src/lib/tauri.ts`
  - [ ] 5.2 Add `NewXmltvSource` and `XmltvSourceUpdate` interfaces
  - [ ] 5.3 Add `XmltvFormat` enum type ('xml' | 'xml.gz' | 'auto')
  - [ ] 5.4 Add `addXmltvSource()` function
  - [ ] 5.5 Add `getXmltvSources()` function
  - [ ] 5.6 Add `updateXmltvSource()` function
  - [ ] 5.7 Add `deleteXmltvSource()` function
  - [ ] 5.8 Add `toggleXmltvSource()` function

- [ ] Task 6: Create EPG Sources section in Accounts view (AC: #1, #2, #3)
  - [ ] 6.1 Create `src/components/epg/EpgSourcesList.tsx` component
  - [ ] 6.2 Display list of XMLTV sources with name, URL, format, status
  - [ ] 6.3 Show last refresh timestamp if available
  - [ ] 6.4 Add enable/disable toggle for each source
  - [ ] 6.5 Add edit and delete action buttons

- [ ] Task 7: Create Add/Edit EPG Source dialog (AC: #1, #3)
  - [ ] 7.1 Create `src/components/epg/EpgSourceDialog.tsx` component
  - [ ] 7.2 Form fields: Source name (text), URL (text), Format (select: auto-detect, xml, xml.gz)
  - [ ] 7.3 Add URL validation with user-friendly error messages
  - [ ] 7.4 Show loading state during save
  - [ ] 7.5 Support both add and edit modes using same component
  - [ ] 7.6 Auto-detect format when URL changes (debounced)

- [ ] Task 8: Integrate EPG Sources into Accounts view (AC: #1, #2, #3)
  - [ ] 8.1 Add "EPG Sources" section to `src/views/Accounts.tsx` below Xtream accounts
  - [ ] 8.2 Add "Add EPG Source" button that opens EpgSourceDialog
  - [ ] 8.3 Wire up EpgSourcesList component with TanStack Query
  - [ ] 8.4 Handle empty state with helpful message

- [ ] Task 9: Testing and verification (AC: #1, #2, #3)
  - [ ] 9.1 Run `cargo check` and `cargo clippy` - verify no warnings
  - [ ] 9.2 Run `pnpm exec tsc --noEmit` - verify TypeScript compiles
  - [ ] 9.3 Add unit tests for URL validation
  - [ ] 9.4 Add unit tests for format detection
  - [ ] 9.5 Add E2E tests for add/edit/delete EPG source flow
  - [ ] 9.6 Verify CRUD operations work correctly with database

## Dev Notes

### Architecture Compliance

This story implements FR8 from the PRD, building on the database foundation from Epic 1.

**From PRD:**
> FR8: User can add multiple XMLTV source URLs
> FR9: System can load XMLTV data from .xml and .xml.gz formats (partially - format detection)

[Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements - XMLTV/EPG Management]

**From Architecture - Database Schema:**
```sql
-- XMLTV sources
CREATE TABLE xmltv_sources (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    format TEXT CHECK(format IN ('xml', 'xml.gz')) DEFAULT 'xml',
    refresh_hour INTEGER DEFAULT 4,
    last_refresh TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

[Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Database Schema]

**From Architecture - XMLTV Parser Module:**
```
xmltv/
├── mod.rs           # Module exports
├── parser.rs        # Streaming XML parser
├── types.rs         # XMLTV data structures
└── fetcher.rs       # Download and decompress
```

[Source: _bmad-output/planning-artifacts/architecture.md#Core Modules - XMLTV Parser]

### XMLTV Format Specification

**XMLTV File Structure:**
- Root element: `<tv>` with optional `source-info-url`, `source-info-name`, `generator-info-name` attributes
- Channel records: `<channel id="unique-id">` with `<display-name>` and optional `<icon src="url"/>`
- Programme records: `<programme start="YYYYMMDDhhmmss ±HHMM" stop="YYYYMMDDhhmmss ±HHMM" channel="channel-id">`

**Date/Time Format:**
- Timestamps: `YYYYMMDDhhmmss ±HHMM` (e.g., "20260119120000 +0000")
- The timezone offset is required for proper parsing

**File Encoding:**
- Typically UTF-8 or ISO-8859-1
- Declared in XML prolog: `<?xml version="1.0" encoding="UTF-8"?>`

**Gzipped Format (.xml.gz):**
- Same XML content compressed with gzip
- Use `flate2` crate for decompression in Rust
- Check for gzip magic bytes: `0x1f 0x8b`

[Source: https://wiki.xmltv.org/index.php/XMLTVFormat]

### Format Detection Logic

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum XmltvFormat {
    Xml,
    XmlGz,
    Auto,
}

/// Detect XMLTV format from URL or content
pub fn detect_format_from_url(url: &str) -> XmltvFormat {
    let url_lower = url.to_lowercase();

    if url_lower.ends_with(".xml.gz") || url_lower.ends_with(".xmltv.gz") {
        XmltvFormat::XmlGz
    } else if url_lower.ends_with(".xml") || url_lower.ends_with(".xmltv") {
        XmltvFormat::Xml
    } else {
        XmltvFormat::Auto
    }
}

/// Detect format from response content (first bytes)
pub fn detect_format_from_content(bytes: &[u8]) -> XmltvFormat {
    // Gzip magic bytes: 0x1f 0x8b
    if bytes.len() >= 2 && bytes[0] == 0x1f && bytes[1] == 0x8b {
        XmltvFormat::XmlGz
    } else if bytes.starts_with(b"<?xml") || bytes.starts_with(b"<tv") {
        XmltvFormat::Xml
    } else {
        XmltvFormat::Auto
    }
}
```

### Database Migration

```sql
-- up.sql
CREATE TABLE xmltv_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    format TEXT NOT NULL DEFAULT 'auto' CHECK(format IN ('xml', 'xml_gz', 'auto')),
    refresh_hour INTEGER NOT NULL DEFAULT 4 CHECK(refresh_hour >= 0 AND refresh_hour <= 23),
    last_refresh TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_xmltv_sources_is_active ON xmltv_sources(is_active);

-- down.sql
DROP TABLE IF EXISTS xmltv_sources;
```

### Diesel Models

```rust
// src-tauri/src/db/models.rs

use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use crate::db::schema::xmltv_sources;

/// XMLTV source from database
#[derive(Debug, Clone, Queryable, Selectable, Serialize)]
#[diesel(table_name = xmltv_sources)]
#[serde(rename_all = "camelCase")]
pub struct XmltvSource {
    pub id: i32,
    pub name: String,
    pub url: String,
    pub format: String,
    pub refresh_hour: i32,
    pub last_refresh: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// New XMLTV source for insertion
#[derive(Debug, Insertable, Deserialize)]
#[diesel(table_name = xmltv_sources)]
#[serde(rename_all = "camelCase")]
pub struct NewXmltvSource {
    pub name: String,
    pub url: String,
    pub format: String,
    #[serde(default = "default_refresh_hour")]
    pub refresh_hour: i32,
    #[serde(default = "default_is_active")]
    pub is_active: bool,
}

fn default_refresh_hour() -> i32 { 4 }
fn default_is_active() -> bool { true }

/// XMLTV source update changeset
#[derive(Debug, AsChangeset, Deserialize)]
#[diesel(table_name = xmltv_sources)]
#[serde(rename_all = "camelCase")]
pub struct XmltvSourceUpdate {
    pub name: Option<String>,
    pub url: Option<String>,
    pub format: Option<String>,
    pub refresh_hour: Option<i32>,
    pub is_active: Option<bool>,
}
```

### Tauri Commands

```rust
// src-tauri/src/commands/epg.rs

use crate::db::models::{NewXmltvSource, XmltvSource, XmltvSourceUpdate};
use crate::db::DbConnection;
use diesel::prelude::*;

#[tauri::command]
pub async fn add_xmltv_source(
    state: tauri::State<'_, DbConnection>,
    name: String,
    url: String,
    format: String,
) -> Result<XmltvSource, String> {
    // Validate URL
    let parsed_url = url::Url::parse(&url)
        .map_err(|_| "Invalid URL format".to_string())?;

    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err("URL must use http or https".to_string());
    }

    // Validate format
    let valid_formats = ["xml", "xml_gz", "auto"];
    if !valid_formats.contains(&format.as_str()) {
        return Err(format!("Invalid format. Must be one of: {:?}", valid_formats));
    }

    let new_source = NewXmltvSource {
        name,
        url,
        format,
        refresh_hour: 4,
        is_active: true,
    };

    let mut conn = state.lock().map_err(|e| e.to_string())?;

    use crate::db::schema::xmltv_sources::dsl::*;

    diesel::insert_into(xmltv_sources)
        .values(&new_source)
        .execute(&mut *conn)
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                "An EPG source with this URL already exists".to_string()
            } else {
                format!("Failed to add EPG source: {}", e)
            }
        })?;

    // Return the inserted record
    xmltv_sources
        .order(id.desc())
        .first(&mut *conn)
        .map_err(|e| format!("Failed to retrieve EPG source: {}", e))
}

#[tauri::command]
pub async fn get_xmltv_sources(
    state: tauri::State<'_, DbConnection>,
) -> Result<Vec<XmltvSource>, String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;

    use crate::db::schema::xmltv_sources::dsl::*;

    xmltv_sources
        .order(name.asc())
        .load::<XmltvSource>(&mut *conn)
        .map_err(|e| format!("Failed to load EPG sources: {}", e))
}

#[tauri::command]
pub async fn update_xmltv_source(
    state: tauri::State<'_, DbConnection>,
    source_id: i32,
    updates: XmltvSourceUpdate,
) -> Result<XmltvSource, String> {
    // Validate URL if provided
    if let Some(ref new_url) = updates.url {
        let parsed_url = url::Url::parse(new_url)
            .map_err(|_| "Invalid URL format".to_string())?;

        if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
            return Err("URL must use http or https".to_string());
        }
    }

    // Validate format if provided
    if let Some(ref new_format) = updates.format {
        let valid_formats = ["xml", "xml_gz", "auto"];
        if !valid_formats.contains(&new_format.as_str()) {
            return Err(format!("Invalid format. Must be one of: {:?}", valid_formats));
        }
    }

    let mut conn = state.lock().map_err(|e| e.to_string())?;

    use crate::db::schema::xmltv_sources::dsl::*;

    diesel::update(xmltv_sources.filter(id.eq(source_id)))
        .set(&updates)
        .execute(&mut *conn)
        .map_err(|e| format!("Failed to update EPG source: {}", e))?;

    xmltv_sources
        .filter(id.eq(source_id))
        .first(&mut *conn)
        .map_err(|e| format!("EPG source not found: {}", e))
}

#[tauri::command]
pub async fn delete_xmltv_source(
    state: tauri::State<'_, DbConnection>,
    source_id: i32,
) -> Result<(), String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;

    use crate::db::schema::xmltv_sources::dsl::*;

    let deleted = diesel::delete(xmltv_sources.filter(id.eq(source_id)))
        .execute(&mut *conn)
        .map_err(|e| format!("Failed to delete EPG source: {}", e))?;

    if deleted == 0 {
        return Err("EPG source not found".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn toggle_xmltv_source(
    state: tauri::State<'_, DbConnection>,
    source_id: i32,
    active: bool,
) -> Result<XmltvSource, String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;

    use crate::db::schema::xmltv_sources::dsl::*;

    diesel::update(xmltv_sources.filter(id.eq(source_id)))
        .set(is_active.eq(active))
        .execute(&mut *conn)
        .map_err(|e| format!("Failed to toggle EPG source: {}", e))?;

    xmltv_sources
        .filter(id.eq(source_id))
        .first(&mut *conn)
        .map_err(|e| format!("EPG source not found: {}", e))
}
```

### TypeScript Types

```typescript
// Add to src/lib/tauri.ts

export type XmltvFormat = 'xml' | 'xml_gz' | 'auto';

export interface XmltvSource {
  id: number;
  name: string;
  url: string;
  format: XmltvFormat;
  refreshHour: number;
  lastRefresh?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewXmltvSource {
  name: string;
  url: string;
  format: XmltvFormat;
}

export interface XmltvSourceUpdate {
  name?: string;
  url?: string;
  format?: XmltvFormat;
  refreshHour?: number;
  isActive?: boolean;
}

export async function addXmltvSource(source: NewXmltvSource): Promise<XmltvSource> {
  return invoke<XmltvSource>("add_xmltv_source", {
    name: source.name,
    url: source.url,
    format: source.format,
  });
}

export async function getXmltvSources(): Promise<XmltvSource[]> {
  return invoke<XmltvSource[]>("get_xmltv_sources");
}

export async function updateXmltvSource(
  sourceId: number,
  updates: XmltvSourceUpdate
): Promise<XmltvSource> {
  return invoke<XmltvSource>("update_xmltv_source", { sourceId, updates });
}

export async function deleteXmltvSource(sourceId: number): Promise<void> {
  return invoke<void>("delete_xmltv_source", { sourceId });
}

export async function toggleXmltvSource(
  sourceId: number,
  active: boolean
): Promise<XmltvSource> {
  return invoke<XmltvSource>("toggle_xmltv_source", { sourceId, active });
}
```

### UI Components

**EpgSourcesList.tsx:**
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getXmltvSources, deleteXmltvSource, toggleXmltvSource, XmltvSource } from '@/lib/tauri';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface EpgSourcesListProps {
  onEdit: (source: XmltvSource) => void;
}

export function EpgSourcesList({ onEdit }: EpgSourcesListProps) {
  const queryClient = useQueryClient();

  const { data: sources, isLoading } = useQuery({
    queryKey: ['xmltv-sources'],
    queryFn: getXmltvSources,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      toggleXmltvSource(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xmltv-sources'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteXmltvSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xmltv-sources'] });
    },
  });

  if (isLoading) return <div>Loading EPG sources...</div>;
  if (!sources?.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        No EPG sources configured. Add one to get program guide data.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => (
        <div
          key={source.id}
          className="flex items-center gap-4 p-3 border rounded-lg"
        >
          <Switch
            checked={source.isActive}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ id: source.id, active: checked })
            }
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{source.name}</div>
            <div className="text-sm text-gray-500 truncate">{source.url}</div>
            <div className="text-xs text-gray-400">
              Format: {source.format === 'xml_gz' ? 'xml.gz' : source.format}
              {source.lastRefresh && (
                <> · Last refresh: {formatDistanceToNow(new Date(source.lastRefresh))} ago</>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(source)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm(`Delete "${source.name}"?`)) {
                  deleteMutation.mutate(source.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**EpgSourceDialog.tsx:**
```tsx
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  addXmltvSource,
  updateXmltvSource,
  XmltvSource,
  XmltvFormat,
} from '@/lib/tauri';

interface EpgSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: XmltvSource; // If provided, edit mode; otherwise, add mode
}

export function EpgSourceDialog({
  open,
  onOpenChange,
  source,
}: EpgSourceDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!source;

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<XmltvFormat>('auto');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source) {
      setName(source.name);
      setUrl(source.url);
      setFormat(source.format);
    } else {
      setName('');
      setUrl('');
      setFormat('auto');
    }
    setError(null);
  }, [source, open]);

  // Auto-detect format when URL changes
  useEffect(() => {
    if (url && format === 'auto') {
      const urlLower = url.toLowerCase();
      if (urlLower.endsWith('.xml.gz') || urlLower.endsWith('.xmltv.gz')) {
        setFormat('xml_gz');
      } else if (urlLower.endsWith('.xml') || urlLower.endsWith('.xmltv')) {
        setFormat('xml');
      }
    }
  }, [url]);

  const addMutation = useMutation({
    mutationFn: () => addXmltvSource({ name, url, format }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xmltv-sources'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateXmltvSource(source!.id, { name, url, format }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xmltv-sources'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    // URL validation
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('URL must use http or https');
        return;
      }
    } catch {
      setError('Invalid URL format');
      return;
    }

    if (isEdit) {
      updateMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  const isLoading = addMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit EPG Source' : 'Add EPG Source'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Source Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My EPG Source"
              data-testid="epg-source-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/epg.xml"
              data-testid="epg-source-url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as XmltvFormat)}>
              <SelectTrigger data-testid="epg-source-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="xml">XML (.xml)</SelectItem>
                <SelectItem value="xml_gz">Gzipped XML (.xml.gz)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="text-sm text-red-500" data-testid="epg-source-error">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              data-testid="epg-source-submit"
            >
              {isLoading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Source'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Previous Story Intelligence

**From Story 2-3 Implementation:**
- Database migrations follow pattern: `YYYY-MM-DD-HHMMSS_description/up.sql` and `down.sql`
- Diesel models use `Queryable`, `Selectable`, `Insertable`, `AsChangeset` derives
- Commands return `Result<T, String>` with user-friendly error messages
- URL validation uses `url` crate for proper parsing
- Used TanStack Query for data fetching with invalidation on mutations
- Components use shadcn/ui primitives (Button, Input, Dialog, etc.)

**Key Patterns to Follow:**
- Use `#[serde(rename_all = "camelCase")]` for API types
- Use transactions for batch operations
- Validate inputs before database operations
- Return the modified entity after update operations
- Use optimistic UI updates where appropriate

**Files Modified in Previous Stories:**
- `src-tauri/src/db/models.rs` - Account, XtreamChannel models
- `src-tauri/src/db/schema.rs` - Auto-generated by Diesel
- `src-tauri/src/commands/mod.rs` - Command module exports
- `src-tauri/src/lib.rs` - Command registration
- `src/lib/tauri.ts` - TypeScript API functions

### Git Intelligence

**Recent Commits (from Story 2-3):**
```
7b6886c Code review fixes for story 2-3: Removed channels tracking, auto-scan, tuner refresh
3562d78 Implement story 2-3: Retrieve and store channel list from Xtream
510a6e4 Generate ATDD failing tests for story 2-3
01e8d1b Create story 2-3: Retrieve and store channel list from Xtream
86bcab8 Code review fixes for story 2-2: Security and validation improvements
```

**Files to Create:**
- `src-tauri/migrations/YYYY-MM-DD-HHMMSS_create_xmltv_sources/up.sql`
- `src-tauri/migrations/YYYY-MM-DD-HHMMSS_create_xmltv_sources/down.sql`
- `src-tauri/src/commands/epg.rs`
- `src/components/epg/EpgSourcesList.tsx`
- `src/components/epg/EpgSourceDialog.tsx`
- `src/components/epg/index.ts`
- `tests/e2e/epg-sources.spec.ts`

**Files to Modify:**
- `src-tauri/src/db/models.rs` - Add XmltvSource, NewXmltvSource, XmltvSourceUpdate
- `src-tauri/src/db/schema.rs` - Auto-updated by Diesel
- `src-tauri/src/db/mod.rs` - Export new models
- `src-tauri/src/commands/mod.rs` - Add epg module
- `src-tauri/src/lib.rs` - Register new commands
- `src/lib/tauri.ts` - Add XMLTV types and functions
- `src/views/Accounts.tsx` - Add EPG Sources section

### Project Structure Notes

**Alignment with unified project structure:**
- Commands go in `src-tauri/src/commands/epg.rs` (new module for EPG-related commands)
- Models go in `src-tauri/src/db/models.rs` (existing file)
- Components go in `src/components/epg/` (new directory)
- Types go in `src/lib/tauri.ts` (existing file)

**Database Considerations:**
- `xmltv_sources` table is independent of `accounts` table
- No foreign key relationship needed at this stage
- Future stories will link EPG data to channels via `xmltv_channels` table

### Security Checklist

- [ ] URL validated to be valid http/https before storage
- [ ] No sensitive data in XMLTV sources (URLs are not credentials)
- [ ] SQL injection prevented via Diesel parameterized queries
- [ ] Error messages don't leak internal database details
- [ ] User input sanitized before use

### Testing Strategy

**Unit Tests:**
- URL validation: valid URLs, invalid schemes, malformed URLs
- Format detection: .xml, .xml.gz, no extension, mixed case

**E2E Tests:**
- Add EPG source with valid data
- Add EPG source with duplicate URL (should fail)
- Edit existing EPG source
- Delete EPG source
- Toggle enable/disable
- Form validation errors displayed

### Web Research References

- [XMLTV Format Specification](https://wiki.xmltv.org/index.php/XMLTVFormat)
- [quick-xml crate for streaming parsing](https://github.com/tafia/quick-xml)
- [Parsing huge XML files with Rust](https://capnfabs.net/posts/parsing-huge-xml-quickxml-rust-serde/)
- [XMLTV Rust crate](https://lib.rs/crates/xmltv)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Core Modules - XMLTV Parser]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Database Schema]
- [Source: _bmad-output/planning-artifacts/architecture.md#Technology Stack]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4]
- [Source: _bmad-output/planning-artifacts/prd.md#XMLTV/EPG Management]
- [Previous Story 2-3 Implementation](_bmad-output/implementation-artifacts/2-3-retrieve-and-store-channel-list-from-xtream.md)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
