---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
inputDocuments:
  - product-brief-iptv-2026-01-18.md
  - prd.md
workflowType: 'architecture'
project_name: 'iptv'
user_name: 'Javier'
date: '2026-01-18'
completedDate: '2026-01-18'
---

# Architecture Decision Document - iptv

**Author:** Javier
**Date:** 2026-01-18

---

## Executive Summary

**iptv** is a cross-platform desktop application bridging Xtream Codes IPTV services to Plex Media Server. This architecture uses **Tauri 2.0** with a Rust backend and React frontend, optimized for long-running background operation, low resource usage, and maintainability.

**Key Architectural Decisions:**
- **Tauri 2.0** - Rust core + WebView GUI (not Electron - 10x lighter)
- **SQLite** - Local persistence with diesel ORM
- **Tokio** - Async runtime for concurrent stream handling
- **Axum** - HTTP server for M3U/EPG/stream endpoints
- **React + TypeScript** - GUI with Tailwind CSS

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         IPTV Application                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Tauri Shell                           │    │
│  │  ┌─────────────────┐    ┌─────────────────────────────┐ │    │
│  │  │   React GUI     │◄──►│      Tauri IPC Bridge       │ │    │
│  │  │  (WebView)      │    │   (Commands & Events)       │ │    │
│  │  └─────────────────┘    └──────────────┬──────────────┘ │    │
│  └─────────────────────────────────────────┼───────────────┘    │
│                                            │                     │
│  ┌─────────────────────────────────────────▼───────────────┐    │
│  │                    Rust Core Service                     │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │    │
│  │  │ Xtream API   │ │ XMLTV Parser │ │  Channel Matcher │ │    │
│  │  │   Client     │ │              │ │  (Fuzzy Search)  │ │    │
│  │  └──────────────┘ └──────────────┘ └──────────────────┘ │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │    │
│  │  │ Stream Proxy │ │  HTTP Server │ │  HDHomeRun       │ │    │
│  │  │ + Failover   │ │    (Axum)    │ │  Emulator        │ │    │
│  │  └──────────────┘ └──────────────┘ └──────────────────┘ │    │
│  │  ┌──────────────────────────────────────────────────────┐│    │
│  │  │              SQLite + Diesel ORM                     ││    │
│  │  └──────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐         ┌──────────┐
   │ Xtream   │        │  XMLTV   │         │   Plex   │
   │ Provider │        │  Source  │         │  Server  │
   └──────────┘        └──────────┘         └──────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **React GUI** | Configuration, channel management, EPG viewer, logs |
| **Tauri IPC** | Type-safe communication between frontend and Rust |
| **Xtream Client** | API authentication, channel/stream retrieval |
| **XMLTV Parser** | Parse XML/gzipped EPG data, extract programs |
| **Channel Matcher** | Fuzzy matching of Xtream streams to XMLTV channels (XMLTV is primary), auto-rematch on changes |
| **Stream Proxy** | Proxy streams, handle failover between quality tiers |
| **HTTP Server** | Serve M3U, EPG, and stream endpoints to Plex |
| **HDHomeRun Emulator** | Respond to Plex tuner discovery |
| **SQLite** | Persist config, channels, mappings, logs |

---

## Technology Stack

### Backend (Rust)

| Purpose | Technology | Rationale |
|---------|------------|-----------|
| **Framework** | Tauri 2.0 | Cross-platform, lightweight (~10MB vs Electron's 150MB+), native system tray |
| **Async Runtime** | Tokio | Industry standard, handles concurrent streams efficiently |
| **HTTP Server** | Axum | Modern, ergonomic, built on Tokio/Tower |
| **HTTP Client** | reqwest | Async, handles streaming responses |
| **Database** | SQLite + Diesel | Zero-config, file-based, compile-time query checking |
| **XML Parsing** | quick-xml | Fast, streaming XML parser for large XMLTV files |
| **Fuzzy Matching** | strsim + custom | Jaro-Winkler + normalized scoring |
| **Compression** | flate2 | Handle .xml.gz EPG files |
| **Logging** | tracing | Structured logging with multiple outputs |
| **Scheduling** | tokio-cron-scheduler | EPG refresh scheduling |

### Frontend (React)

| Purpose | Technology | Rationale |
|---------|------------|-----------|
| **Framework** | React 18 | Mature, large ecosystem |
| **Language** | TypeScript | Type safety, better DX |
| **Styling** | Tailwind CSS | Utility-first, fast development |
| **State** | Zustand | Simple, lightweight state management |
| **Data Fetching** | TanStack Query | Caching, background refresh for EPG data |
| **UI Components** | Radix UI | Accessible, unstyled primitives |
| **Drag & Drop** | dnd-kit | Modern, accessible drag-drop for channel ordering |
| **Virtual Lists** | TanStack Virtual | Performant rendering of large channel/EPG lists |
| **Build** | Vite | Fast builds, HMR |

### Development & Build

| Purpose | Technology |
|---------|------------|
| **Monorepo** | Cargo workspace + pnpm |
| **Testing (Rust)** | cargo test + mockall |
| **Testing (React)** | Vitest + React Testing Library |
| **E2E Testing** | Playwright |
| **CI/CD** | GitHub Actions |
| **Packaging** | Tauri bundler (MSI, DMG, AppImage, deb) |

---

## Data Architecture

### Database Schema (SQLite)

```sql
-- Xtream account configuration
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted BLOB NOT NULL,
    max_connections INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Channels from Xtream provider
CREATE TABLE xtream_channels (
    id INTEGER PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    stream_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    stream_icon TEXT,
    category_id INTEGER,
    category_name TEXT,
    qualities TEXT, -- JSON array: ["HD", "SD", "4K"]
    epg_channel_id TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, stream_id)
);

-- Channels from XMLTV (or synthetic for orphan Xtream channels)
CREATE TABLE xmltv_channels (
    id INTEGER PRIMARY KEY,
    source_id INTEGER REFERENCES xmltv_sources(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    icon TEXT,
    is_synthetic BOOLEAN DEFAULT FALSE,  -- True for promoted orphan Xtream channels
    UNIQUE(source_id, channel_id)
);

-- Channel mappings (XMLTV -> Xtream) - One XMLTV channel can have MULTIPLE Xtream streams
CREATE TABLE channel_mappings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    xtream_channel_id INTEGER NOT NULL REFERENCES xtream_channels(id) ON DELETE CASCADE,
    match_confidence REAL,
    is_manual BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,  -- Best match for this XMLTV channel
    stream_priority INTEGER DEFAULT 0,  -- Order for failover (0 = highest priority)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(xmltv_channel_id, xtream_channel_id)  -- Prevent duplicate mappings
);

-- XMLTV channel settings for Plex lineup (one per XMLTV channel)
CREATE TABLE xmltv_channel_settings (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER NOT NULL UNIQUE REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT FALSE,  -- User must enable for Plex
    plex_display_order INTEGER,         -- Channel order in Plex lineup
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EPG program data (cached)
CREATE TABLE programs (
    id INTEGER PRIMARY KEY,
    xmltv_channel_id INTEGER REFERENCES xmltv_channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    category TEXT,
    episode_info TEXT
);
CREATE INDEX idx_programs_channel_time ON programs(xmltv_channel_id, start_time);

-- Application settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Event log
CREATE TABLE event_log (
    id INTEGER PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level TEXT CHECK(level IN ('info', 'warn', 'error')) NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT, -- JSON for additional context
    is_read BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_event_log_timestamp ON event_log(timestamp DESC);
```

### Data Flow

**Channel Hierarchy:** XMLTV channels are the PRIMARY source for Plex lineup (names, IDs, icons, EPG). Xtream streams are matched TO XMLTV channels as video sources.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Xtream     │     │    XMLTV     │     │    User      │
│   Provider   │     │   Sources    │     │   Actions    │
│  (streams)   │     │  (PRIMARY)   │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────┐
│                    Rust Core Service                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ Fetch      │  │ Parse &    │  │ Match Xtream TO    │  │
│  │ Streams    │  │ Cache EPG  │  │ XMLTV + User Prefs │  │
│  └─────┬──────┘  └─────┬──────┘  └─────────┬──────────┘  │
│        │               │                   │             │
│        └───────────────┼───────────────────┘             │
│                        ▼                                 │
│              ┌─────────────────┐                         │
│              │  SQLite (Diesel)│                         │
│              └─────────────────┘                         │
│                        │                                 │
│                        ▼                                 │
│              ┌─────────────────┐                         │
│              │ M3U/EPG Gen     │ (uses XMLTV channel     │
│              │ for Plex        │  info for enabled       │
│              └─────────────────┘  channels only)         │
└──────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. Xtream Client (`src-tauri/src/xtream/`)

```
xtream/
├── mod.rs           # Module exports
├── client.rs        # API client implementation
├── types.rs         # API response types
├── auth.rs          # Authentication handling
└── streams.rs       # Stream URL generation
```

**Key Types:**
```rust
pub struct XtreamClient {
    http: reqwest::Client,
    config: XtreamConfig,
}

pub struct XtreamConfig {
    server_url: String,
    username: String,
    password: String,
}

pub struct XtreamChannel {
    stream_id: i32,
    name: String,
    stream_icon: Option<String>,
    category_id: i32,
    epg_channel_id: Option<String>,
}

impl XtreamClient {
    pub async fn authenticate(&self) -> Result<AccountInfo>;
    pub async fn get_live_streams(&self) -> Result<Vec<XtreamChannel>>;
    pub async fn get_stream_url(&self, stream_id: i32, quality: Quality) -> String;
}
```

### 2. XMLTV Parser (`src-tauri/src/xmltv/`)

```
xmltv/
├── mod.rs           # Module exports
├── parser.rs        # Streaming XML parser
├── types.rs         # XMLTV data structures
└── fetcher.rs       # Download and decompress
```

**Key Types:**
```rust
pub struct XmltvChannel {
    id: String,
    display_name: String,
    icon: Option<String>,
}

pub struct Program {
    channel_id: String,
    title: String,
    description: Option<String>,
    start: DateTime<Utc>,
    stop: DateTime<Utc>,
    category: Option<String>,
}

pub async fn parse_xmltv(source: &str) -> Result<(Vec<XmltvChannel>, Vec<Program>)>;
```

### 3. Channel Matcher (`src-tauri/src/matcher/`)

```
matcher/
├── mod.rs           # Module exports
├── fuzzy.rs         # Fuzzy matching algorithm
├── scorer.rs        # Match confidence scoring
└── auto_rematch.rs  # Change detection and rematch
```

**Matching Algorithm:**
XMLTV channels are the primary channel list for Plex. Xtream streams are matched TO XMLTV channels.

1. For each XMLTV channel, find candidate Xtream streams
2. Normalize channel names (lowercase, remove HD/SD/FHD suffixes, strip punctuation)
3. Calculate Jaro-Winkler similarity
4. Boost score for exact EPG ID matches
5. Apply confidence threshold (default: 0.85)
6. Return ranked matches with XMLTV as primary key

```rust
pub struct MatchResult {
    xmltv_channel_id: i32,           // Primary - defines Plex channel
    xtream_channel_id: Option<i32>,  // Matched stream source (nullable)
    confidence: f64,
    match_type: MatchType, // Exact, Fuzzy, EpgId, None
}

pub fn match_channels(
    xmltv: &[XmltvChannel],   // Primary channel list
    xtream: &[XtreamChannel], // Stream sources to match
    threshold: f64,
) -> Vec<MatchResult>;
```

### 4. Stream Proxy (`src-tauri/src/proxy/`)

```
proxy/
├── mod.rs           # Module exports
├── handler.rs       # Stream request handling
├── failover.rs      # Quality failover logic
└── metrics.rs       # Stream health tracking
```

**Failover Strategy:**
1. Attempt highest available quality
2. On failure (timeout 5s, connection error, HTTP error), try next quality tier
3. Track failures per quality tier
4. Once failed over, remain on backup source for session duration
5. Log all failover events
6. **Mid-stream monitoring:** Health check loop tracks bytes/sec every 1s
7. **Stall detection:** If 0 bytes for >3s, trigger failover (reuse steps 2-4)
8. **Graceful handoff:** FFmpeg buffer (2-5s) hides switch from Plex

```rust
pub struct StreamProxy {
    xtream_client: Arc<XtreamClient>,
    active_streams: DashMap<String, StreamSession>,
}

pub struct StreamSession {
    channel_id: i32,
    current_quality: Quality,
    started_at: Instant,
    failover_count: u32,
    // Mid-stream health monitoring (added 2026-01-21)
    last_byte_time: Instant,
    bytes_per_second: f64,
    stall_detected: bool,
}

impl StreamProxy {
    pub async fn handle_stream(&self, channel_id: i32) -> impl Stream<Item = Bytes>;
}
```

### 5. HTTP Server (`src-tauri/src/server/`)

```
server/
├── mod.rs           # Module exports, Axum router
├── m3u.rs           # M3U playlist generation
├── epg.rs           # XMLTV EPG endpoint
├── stream.rs        # Stream proxy endpoint
└── hdhr.rs          # HDHomeRun discovery/status
```

**Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/playlist.m3u` | GET | M3U playlist for Plex |
| `/epg.xml` | GET | XMLTV EPG data |
| `/stream/{channel_id}` | GET | Proxied stream with failover |
| `/discover.json` | GET | HDHomeRun device discovery |
| `/lineup.json` | GET | HDHomeRun channel lineup |
| `/lineup_status.json` | GET | HDHomeRun lineup status |

### 6. Tauri Commands (`src-tauri/src/commands/`)

```
commands/
├── mod.rs           # Command registration
├── accounts.rs      # Xtream account management
├── channels.rs      # Channel operations
├── epg.rs           # EPG queries
├── settings.rs      # App settings
└── logs.rs          # Event log access
```

**Example Commands:**
```rust
#[tauri::command]
async fn add_account(config: XtreamConfig) -> Result<Account, String>;

#[tauri::command]
async fn get_channels() -> Result<Vec<ChannelWithMapping>, String>;

#[tauri::command]
async fn update_channel_order(channel_ids: Vec<i32>) -> Result<(), String>;

#[tauri::command]
async fn search_epg(query: String) -> Result<Vec<Program>, String>;
```

---

## Frontend Architecture

### Directory Structure

```
src/
├── main.tsx                 # Entry point
├── App.tsx                  # Root component, routing
├── components/
│   ├── ui/                  # Shared UI components (Radix-based)
│   ├── layout/              # Shell, sidebar, system tray menu
│   ├── channels/            # Channel list, drag-drop, enable/disable
│   ├── epg/                 # EPG viewer, search, program details
│   ├── accounts/            # Xtream account management
│   ├── settings/            # App settings forms
│   └── logs/                # Event log viewer
├── hooks/
│   ├── useChannels.ts       # Channel data + mutations
│   ├── useEpg.ts            # EPG queries
│   ├── useAccounts.ts       # Account management
│   └── useTauri.ts          # Tauri command wrappers
├── stores/
│   └── appStore.ts          # Zustand global state
├── lib/
│   ├── tauri.ts             # Typed Tauri invoke helpers
│   └── utils.ts             # Utility functions
└── styles/
    └── globals.css          # Tailwind imports
```

### Key Views

| View | Route | Purpose |
|------|-------|---------|
| **Dashboard** | `/` | Status overview, quick actions |
| **Channels** | `/channels` | Channel list, drag-drop ordering, enable/disable |
| **EPG Viewer** | `/epg` | Browse/search program guide |
| **Accounts** | `/accounts` | Xtream account management |
| **Settings** | `/settings` | App configuration |
| **Logs** | `/logs` | Event log viewer |

### State Management

```typescript
// stores/appStore.ts
interface AppState {
  // UI State
  sidebarOpen: boolean;
  activeView: string;

  // Data (cached from Tauri)
  channels: Channel[];
  unreadLogCount: number;
  serverStatus: 'running' | 'stopped' | 'error';

  // Actions
  toggleSidebar: () => void;
  setChannels: (channels: Channel[]) => void;
  refreshChannels: () => Promise<void>;
}
```

---

## API Contracts

### Tauri IPC Types

```typescript
// Shared types between Rust and TypeScript

interface Account {
  id: number;
  name: string;
  serverUrl: string;
  username: string;
  maxConnections: number;
  isActive: boolean;
}

interface Channel {
  id: number;
  accountId: number;
  streamId: number;
  name: string;
  icon?: string;
  category: string;
  qualities: string[];
  mapping?: ChannelMapping;
}

interface ChannelMapping {
  id: number;
  xmltvChannelId: number;        // Primary - required, defines Plex channel
  xmltvChannelName: string;
  xtreamChannelId?: number;      // Matched stream source (optional)
  xtreamChannelName?: string;
  matchConfidence?: number;
  isManual: boolean;
  isEnabled: boolean;            // Defaults false - user explicitly enables for Plex
  displayOrder: number;
}

interface Program {
  id: number;
  channelId: number;
  title: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string;
  category?: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  isRead: boolean;
}
```

---

## Security Considerations

### Credential Storage

- Xtream passwords encrypted using OS keychain (via `keyring` crate)
- Fallback: AES-256-GCM encryption with machine-derived key
- Never log credentials

### Network Security

- HTTP server binds to `127.0.0.1` only (localhost)
- No authentication on endpoints (local trust model)
- Future: optional token-based auth for LAN access

### Update Security

- Updates signed with Ed25519 keys
- Tauri's built-in updater with signature verification
- Update server over HTTPS only

---

## Performance Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| **Memory** | <200MB | Rust efficiency, streaming parsers, SQLite |
| **CPU Idle** | <5% | Tokio async, event-driven |
| **CPU Streaming** | <15% | Zero-copy proxying where possible |
| **Stream Start** | <3s | Pre-authenticated sessions, connection pooling |
| **Failover** | <2s | Parallel quality probe, instant switch |
| **GUI Response** | <100ms | Virtual lists, optimistic updates |
| **Channel Scan** | <60s/1000 | Concurrent API calls, batch DB inserts |
| **EPG Load** | <30s | Streaming parser, batch inserts |

---

## Error Handling Strategy

### Rust Core

```rust
// Custom error type with thiserror
#[derive(Debug, thiserror::Error)]
pub enum IptvError {
    #[error("Xtream API error: {0}")]
    XtreamApi(String),

    #[error("XMLTV parse error: {0}")]
    XmltvParse(String),

    #[error("Database error: {0}")]
    Database(#[from] diesel::result::Error),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Stream error: {0}")]
    Stream(String),
}

// Convert to user-friendly messages for frontend
impl IptvError {
    pub fn user_message(&self) -> String {
        match self {
            Self::XtreamApi(_) => "Failed to connect to your IPTV provider".into(),
            Self::XmltvParse(_) => "Failed to parse EPG data".into(),
            Self::Database(_) => "Database error occurred".into(),
            Self::Network(_) => "Network connection failed".into(),
            Self::Stream(_) => "Stream playback error".into(),
        }
    }
}
```

### Frontend

- TanStack Query handles retries and error states
- Toast notifications for user-actionable errors
- Errors logged to event_log table
- Silent recovery preferred (log + retry) over user interruption

---

## Project Structure

```
iptv/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   ├── lib.rs               # Library root
│   │   ├── commands/            # Tauri commands
│   │   ├── db/                  # Database models, migrations
│   │   ├── xtream/              # Xtream API client
│   │   ├── xmltv/               # XMLTV parser
│   │   ├── matcher/             # Channel matching
│   │   ├── proxy/               # Stream proxy + failover
│   │   ├── server/              # HTTP server (Axum)
│   │   └── scheduler/           # Background tasks
│   └── migrations/              # Diesel migrations
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   ├── lib/
│   └── styles/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## Build & Distribution

### Platforms

| Platform | Package Format | Notes |
|----------|---------------|-------|
| **Windows** | MSI + NSIS | Auto-update via Tauri |
| **macOS** | DMG + .app | Universal binary (Intel + Apple Silicon) |
| **Linux** | AppImage, deb, rpm | AppImage for broad compatibility |

### CI/CD Pipeline

```yaml
# .github/workflows/release.yml
- Build on: windows-latest, macos-latest, ubuntu-latest
- Run tests (Rust + TypeScript)
- Build Tauri app
- Sign binaries (Windows: signtool, macOS: codesign)
- Create GitHub release with artifacts
- Trigger update server
```

---

## Development Phases

### Phase 1: Foundation
- Project scaffolding (Tauri + React)
- Database schema + migrations
- Basic Xtream client (auth, channel fetch)
- Basic XMLTV parser
- Simple M3U generation

### Phase 2: Core Features
- Fuzzy channel matching
- Channel management UI
- Stream proxy with failover
- HDHomeRun emulation
- System tray integration

### Phase 3: Polish
- EPG viewer with search
- Event logging + viewer
- Auto-update mechanism
- Settings UI
- Cross-platform testing

### Phase 4: Release
- Installer packaging
- Documentation
- Beta testing
- v1.0 release

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Xtream API changes** | High | Abstract API layer, version detection |
| **XMLTV format variations** | Medium | Lenient parser, fallbacks for missing fields |
| **Tauri 2.0 maturity** | Medium | Pin stable version, avoid bleeding edge features |
| **Platform-specific issues** | Medium | CI testing on all platforms, beta testers |
| **Memory with large EPG** | Low | Streaming parser, purge old data |

---

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **App Framework** | Tauri 2.0 | 10x lighter than Electron, native performance, Rust backend |
| **Backend Language** | Rust | Performance, safety, excellent async ecosystem |
| **Frontend Framework** | React | Mature ecosystem, familiar, good Tauri integration |
| **Database** | SQLite + Diesel | Zero-config, file-based, compile-time query safety |
| **HTTP Server** | Axum | Modern, ergonomic, Tokio-native |
| **State Management** | Zustand | Simple, lightweight, sufficient for this scope |
| **Styling** | Tailwind | Fast development, consistent design |
| **Fuzzy Matching** | Jaro-Winkler | Good for channel name variations, proven algorithm |

---

## Appendix: Plex HDHomeRun Protocol

Plex discovers tuners via SSDP or manual IP entry. Required endpoints:

```
GET /discover.json
{
  "FriendlyName": "iptv",
  "ModelNumber": "HDHR5-4K",
  "FirmwareName": "hdhomerun5_atsc",
  "FirmwareVersion": "20200101",
  "DeviceID": "12345678",
  "DeviceAuth": "abc123",
  "BaseURL": "http://192.168.1.100:5004",
  "LineupURL": "http://192.168.1.100:5004/lineup.json",
  "TunerCount": 2
}

GET /lineup_status.json
{
  "ScanInProgress": 0,
  "ScanPossible": 0,
  "Source": "Cable",
  "SourceList": ["Cable"]
}

GET /lineup.json
[
  {
    "GuideNumber": "1",
    "GuideName": "ESPN",
    "URL": "http://192.168.1.100:5004/stream/1"
  }
]
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-18 | Javier | Initial Architecture creation |
| 1.1 | 2026-01-19 | Bob (SM) | Course correction: Updated channel_mappings schema, MatchResult struct, data flow to reflect XMLTV channels as primary for Plex lineup |
| 1.2 | 2026-01-21 | Bob (SM) | Course correction: Added mid-stream health monitoring to failover strategy; extended StreamSession struct |
