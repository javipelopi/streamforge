---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - prd.md (v1.1 - updated with XMLTV-first channel hierarchy)
  - architecture.md (v1.1 - updated with corrected schema)
workflowType: 'create-epics-and-stories'
completedDate: '2026-01-19'
courseCorrection: 'XMLTV-first channel hierarchy (Sprint Change Proposal 2026-01-19)'
---

# iptv - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for iptv, decomposing the requirements from the PRD and Architecture requirements into implementable stories.

**CRITICAL DESIGN PRINCIPLE:** XMLTV channels are the PRIMARY channel list for Plex. Xtream streams are matched TO XMLTV channels as video sources. This affects Epic 3 (Channel Matching) and Epic 4/5 (Plex Integration, EPG Viewer).

## Requirements Inventory

### Functional Requirements

**Xtream Codes Integration**
- FR1: User can add Xtream Codes account credentials (server URL, username, password)
- FR2: System can connect to Xtream Codes API and authenticate
- FR3: System can retrieve full channel list from Xtream provider
- FR4: System can retrieve available quality tiers for each channel
- FR5: System can retrieve VOD and Series categories (for future use)
- FR6: System can detect and respect tuner count limits from subscription
- FR7: User can test connection and see account status/expiry

**XMLTV/EPG Management**
- FR8: User can add multiple XMLTV source URLs
- FR9: System can load XMLTV data from .xml and .xml.gz formats
- FR10: System can parse XMLTV and extract channel names, IDs, logos, and program data
- FR11: User can configure scheduled EPG refresh time (daily)
- FR12: System can refresh EPG data automatically at scheduled time
- FR13: System can merge EPG data from multiple XMLTV sources

**Channel Matching (XMLTV-First)**
- FR14: System can perform fuzzy matching to associate Xtream streams with XMLTV channels. XMLTV channels are the primary channel list that defines what appears in Plex (channel names, numbers, icons, and EPG data)
- FR15: System can display match confidence scores for each channel pairing
- FR16: System can auto-match channels above confidence threshold
- FR17: User can manually override channel matches via search dropdown
- FR18: System can detect when Xtream channel list has changed
- FR19: System can automatically re-match channels when provider updates list
- FR20: User can trigger manual re-scan of channels

**Channel Management (XMLTV-First)**
- FR21: User can view all XMLTV channels with their matched Xtream stream status. The Channels view shows XMLTV channels as the primary list, with indicators showing which Xtream streams are matched to each
- FR22: User can enable or disable individual channels
- FR23: User can reorder channels via drag-and-drop
- FR24: User can bulk-enable or bulk-disable channels
- FR25: System can remember channel order and enabled state across restarts
- FR26: Unmatched channels default to disabled
- FR26a: User can view all channels from all sources (XMLTV and Xtream) in the Channels tab, with icons indicating source type and match relationships. The XMLTV channel list defines the Plex lineup; Xtream streams are the video sources matched to those channels

**Stream Handling**
- FR27: System can proxy stream requests from Plex to Xtream provider
- FR28: System can select highest available quality tier for each stream
- FR29: System can detect stream failures (connection drops, errors)
- FR30: System can automatically failover to next quality tier on failure
- FR31: System can retry original quality tier after failover recovery period
- FR32: System can handle multiple concurrent streams up to tuner limit
- FR33: Plex remains unaware of quality switches and failovers

**Plex Integration**
- FR34: System can serve M3U playlist endpoint
- FR35: System can serve XMLTV/EPG endpoint
- FR36: System can emulate HDHomeRun tuner for Plex discovery
- FR37: User can view M3U and EPG URLs for Plex configuration
- FR38: System can report correct tuner count to Plex

**EPG Viewer**
- FR39: User can browse EPG data within the application
- FR40: User can search EPG by program title, channel name, or description
- FR41: User can view program details (title, description, time, channel)
- FR42: User can navigate EPG by time (now, tonight, tomorrow, week view)

**Configuration & Settings**
- FR43: User can configure all settings via GUI (no config files required)
- FR44: User can configure local server port
- FR45: User can configure auto-start on system boot
- FR46: User can configure EPG refresh schedule
- FR47: User can export/import configuration for backup

**Logging & Diagnostics**
- FR48: System can log events (connections, failures, failovers, matches)
- FR49: User can view event log in GUI
- FR50: System can display notification badge for unread events
- FR51: User can clear event log
- FR52: System can log with configurable verbosity levels

**Updates**
- FR53: System can check for application updates
- FR54: User can download and install updates from within app
- FR55: System can preserve all settings across updates

### NonFunctional Requirements

**Performance**
- NFR1: Stream start time < 3 seconds from Plex play to video
- NFR2: Failover time < 2 seconds to switch quality tiers
- NFR3: Channel scan < 60 seconds for 1000 channels
- NFR4: EPG load < 30 seconds for 7-day guide
- NFR5: GUI responsiveness < 100ms for user interactions
- NFR6: Memory usage < 200MB RAM during normal operation
- NFR7: CPU usage < 5% when idle, < 15% when streaming

**Reliability**
- NFR8: Continuous operation for weeks without restart
- NFR9: Auto-restart on crash, preserve state
- NFR10: No data loss on unexpected shutdown
- NFR11: > 99% of stream failures recovered via failover

**Compatibility**
- NFR12: Support 3 latest major Plex versions minimum
- NFR13: Support standard Xtream Codes API v1
- NFR14: Support XMLTV 0.5+ specification
- NFR15: IPv4 required, IPv6 optional

**Usability**
- NFR16: Setup time < 10 minutes for complete setup
- NFR17: Usable without documentation
- NFR18: Clear, actionable error messages
- NFR19: Standard OS accessibility support

**Security**
- NFR20: Credential storage encrypted (OS keychain where available)
- NFR21: Local-only endpoints (no external exposure by default)
- NFR22: Signed update packages

### Additional Requirements

**From Architecture - Technology Stack:**
- Tauri 2.0 framework with Rust backend and React frontend
- SQLite database with Diesel ORM for local persistence
- Tokio async runtime for concurrent stream handling
- Axum HTTP server for M3U/EPG/stream endpoints
- React 18 + TypeScript + Tailwind CSS for GUI
- Zustand for state management
- TanStack Query for data fetching
- Radix UI for accessible components
- dnd-kit for drag-and-drop channel ordering
- TanStack Virtual for performant list rendering

**From Architecture - Database Setup:**
- SQLite schema with tables: accounts, xmltv_sources, xtream_channels, xmltv_channels, channel_mappings, programs, settings, event_log
- channel_mappings uses xmltv_channel_id as PRIMARY KEY (XMLTV-first design)
- Diesel migrations for schema management

**From Architecture - Core Module Structure:**
- Xtream Client module (client, types, auth, streams)
- XMLTV Parser module (parser, types, fetcher)
- Channel Matcher module (fuzzy, scorer, auto_rematch) - matches Xtream streams TO XMLTV channels
- Stream Proxy module (handler, failover, metrics)
- HTTP Server module (m3u, epg, stream, hdhr endpoints)
- Tauri Commands module (accounts, channels, epg, settings, logs)

**From Architecture - Plex HDHomeRun Protocol:**
- Implement /discover.json endpoint
- Implement /lineup.json endpoint
- Implement /lineup_status.json endpoint
- Emulate HDHR5-4K device model

**From Architecture - Security Implementation:**
- Use keyring crate for OS keychain credential storage
- Fallback to AES-256-GCM encryption with machine-derived key
- HTTP server binds to 127.0.0.1 only
- Ed25519 signed updates via Tauri updater

**From Architecture - Build & Distribution:**
- Windows: MSI + NSIS packages
- macOS: DMG with universal binary (Intel + Apple Silicon)
- Linux: AppImage, deb, rpm packages
- GitHub Actions CI/CD pipeline

**From Architecture - Project Structure:**
- Monorepo: Cargo workspace + pnpm
- src-tauri/ for Rust backend
- src/ for React frontend
- Diesel migrations in src-tauri/migrations/

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1-FR7 | Epic 2 | Xtream Codes account management |
| FR8-FR13 | Epic 2 | XMLTV/EPG source management |
| FR14-FR20 | Epic 3 | Channel matching (Xtream→XMLTV) and auto-rematch |
| FR21-FR26a | Epic 3 | XMLTV channel management UI |
| FR27-FR33 | Epic 4 | Stream proxy and failover |
| FR34-FR38 | Epic 4 | Plex integration and HDHomeRun |
| FR39-FR42 | Epic 5 | EPG viewer (enabled XMLTV channels) |
| FR43-FR47 | Epic 6 | Settings and configuration |
| FR48-FR52 | Epic 6 | Logging and diagnostics |
| FR53-FR55 | Epic 6 | Auto-update mechanism |

## Epic List

### Epic 1: Application Foundation
Application installs and runs on all platforms with a functional GUI shell and background service.

**Scope:**
- Tauri 2.0 project scaffolding with Rust backend and React frontend
- SQLite database schema + Diesel migrations
- React GUI shell with routing (Dashboard, Channels, EPG, Accounts, Settings, Logs views)
- System tray integration with status indicator
- Axum HTTP server foundation (starts on app launch)
- Auto-start on boot capability

**FRs covered:** Foundation (Architecture) - enables all subsequent epics
**NFRs addressed:** NFR5 (GUI responsiveness), NFR6 (memory), NFR7 (CPU), NFR8 (uptime), NFR9 (crash recovery)

---

### Epic 2: Account & Source Configuration
User can connect their Xtream Codes account and add XMLTV EPG sources.

**Scope:**
- Xtream Codes credential input and secure storage (keychain/encrypted)
- Connection testing with account status/expiry display
- Channel list retrieval from Xtream API
- Quality tier detection per channel
- Tuner count limit detection
- XMLTV source URL management (add/edit/remove)
- XMLTV parsing (.xml and .xml.gz formats)
- EPG refresh scheduling
- Multi-source EPG merging

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13
**NFRs addressed:** NFR3 (scan speed), NFR4 (EPG load), NFR13 (Xtream API), NFR14 (XMLTV spec), NFR20 (credential encryption)

---

### Epic 3: Channel Discovery & Matching (XMLTV-First)
User can see all XMLTV channels with matched Xtream streams and organize their Plex lineup.

**Scope:**
- Fuzzy matching algorithm to match Xtream streams TO XMLTV channels
- Match confidence score display
- Auto-match above threshold (default 0.85)
- Manual match override via search dropdown (search Xtream streams for selected XMLTV channel)
- Provider change detection and automatic re-matching
- Manual re-scan trigger
- **XMLTV channel list view** with match status (primary view)
- Source type icons distinguishing XMLTV vs Xtream origins
- Enable/disable individual XMLTV channels for Plex
- Drag-and-drop XMLTV channel reordering
- Bulk enable/disable operations
- Persistent channel order and enabled state
- Unmatched XMLTV channels default to disabled

**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR26a
**NFRs addressed:** NFR3 (scan speed), NFR5 (GUI responsiveness), NFR16 (setup time), NFR17 (usability)

---

### Epic 4: Plex Integration & Streaming
User can add tuner to Plex and watch live TV with automatic quality failover.

**Scope:**
- Stream proxy from Plex requests to Xtream provider
- Highest quality tier selection per stream
- Stream failure detection (timeout, connection errors, HTTP errors)
- Automatic failover to next quality tier
- Quality upgrade retry after recovery period (60s)
- Concurrent stream handling up to tuner limit
- Transparent failover (Plex unaware)
- **M3U playlist endpoint using XMLTV channel info** (names, IDs, icons)
- **XMLTV EPG endpoint for enabled XMLTV channels only**
- HDHomeRun emulation (/discover.json, /lineup.json, /lineup_status.json)
- Display M3U/EPG URLs in GUI for Plex configuration
- Report correct tuner count to Plex

**FRs covered:** FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR38
**NFRs addressed:** NFR1 (stream start), NFR2 (failover time), NFR11 (failover success), NFR12 (Plex versions), NFR21 (local-only)

---

### Epic 5: EPG Viewer & Discovery
User can browse and search the program guide for enabled channels (Plex preview).

**Scope:**
- EPG grid/list browser showing **enabled XMLTV channels only** (Plex preview mode)
- Time navigation (now, tonight, tomorrow, week view)
- Search by program title
- Search by channel name
- Search by description
- Program details view (title, description, time, channel, category)
- Virtual list rendering for performance

**FRs covered:** FR39, FR40, FR41, FR42
**NFRs addressed:** NFR4 (EPG load), NFR5 (GUI responsiveness)

---

### Epic 6: Settings, Logging & Updates
User can configure the app, view event logs, and keep the app updated.

**Scope:**
- Full settings GUI (no config files needed)
- Local server port configuration
- Auto-start on boot toggle
- EPG refresh schedule configuration
- Configuration export/import for backup
- Event logging (connections, failures, failovers, matches)
- Event log viewer in GUI
- Notification badge for unread events
- Clear event log
- Configurable log verbosity levels
- Check for updates
- Download and install updates from within app
- Preserve settings across updates
- Signed update packages (Ed25519)

**FRs covered:** FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR54, FR55
**NFRs addressed:** NFR10 (data integrity), NFR16 (setup time), NFR17 (usability), NFR18 (error messages), NFR22 (signed updates)

---

## Epic 1: Application Foundation

Application installs and runs on all platforms with a functional GUI shell and background service.

### Story 1.1: Initialize Tauri Project with React Frontend

As a developer,
I want a properly scaffolded Tauri 2.0 project with React frontend,
So that I have a solid foundation for building the cross-platform application.

**Acceptance Criteria:**

**Given** a new development environment
**When** I run the project initialization commands
**Then** a Tauri 2.0 project is created with:
- Rust backend in `src-tauri/`
- React 18 + TypeScript frontend in `src/`
- Vite build configuration
- Tailwind CSS configured
- Basic Tauri IPC commands working
**And** the app builds and runs on the current platform
**And** the dev server supports hot module replacement

---

### Story 1.2: Set Up SQLite Database with Diesel ORM

As a developer,
I want a SQLite database with Diesel ORM configured,
So that the application can persist data locally with compile-time query safety.

**Acceptance Criteria:**

**Given** the Tauri project from Story 1.1
**When** I set up Diesel with SQLite
**Then** the following is configured:
- Diesel CLI installed and configured
- SQLite database file location in app data directory
- `diesel.toml` configuration
- Initial migration creating `settings` table for app configuration
**And** migrations can be run automatically on app startup
**And** the database file persists across app restarts

---

### Story 1.3: Create React GUI Shell with Routing

As a user,
I want a clean application interface with navigation,
So that I can access different sections of the application.

**Acceptance Criteria:**

**Given** the application is launched
**When** the main window opens
**Then** I see a GUI shell with:
- Sidebar navigation with menu items: Dashboard, Channels, EPG, Accounts, Settings, Logs
- Main content area
- App header with title and status indicator
**And** clicking navigation items routes to the corresponding view (placeholder content)
**And** Zustand store is configured for global state
**And** TanStack Query is configured for data fetching
**And** Radix UI primitives are available for components

---

### Story 1.4: Implement System Tray Integration

As a user,
I want the app to minimize to system tray,
So that it can run in the background without cluttering my taskbar.

**Acceptance Criteria:**

**Given** the application is running
**When** I click the window close button
**Then** the app minimizes to system tray instead of quitting
**And** a tray icon appears with the app logo

**Given** the app is in the system tray
**When** I click the tray icon
**Then** the main window is shown and focused

**Given** the app is in the system tray
**When** I right-click the tray icon
**Then** a context menu appears with options:
- Show Window
- Quit
**And** selecting "Quit" exits the application completely

---

### Story 1.5: Create Axum HTTP Server Foundation

As a developer,
I want an embedded Axum HTTP server,
So that the app can serve endpoints for Plex integration.

**Acceptance Criteria:**

**Given** the application starts
**When** initialization completes
**Then** an Axum HTTP server is running on `127.0.0.1:{configured_port}`
**And** the default port is 5004
**And** a health check endpoint at `/health` returns 200 OK
**And** the server only binds to localhost (not accessible externally)
**And** the server runs on the Tokio async runtime
**And** the server port is stored in the settings table

---

### Story 1.6: Add Auto-Start on Boot Capability

As a user,
I want the app to start automatically when I log in,
So that I don't have to manually launch it each time.

**Acceptance Criteria:**

**Given** auto-start is enabled in settings
**When** the operating system starts/user logs in
**Then** the application launches automatically
**And** the app starts minimized to system tray

**Given** auto-start is disabled
**When** the operating system starts
**Then** the application does not launch automatically

**Given** the Settings view
**When** I toggle the "Start on boot" option
**Then** the system autostart entry is created or removed accordingly
**And** this works on Windows (registry), macOS (launchd), and Linux (autostart desktop file)

---

## Epic 2: Account & Source Configuration

User can connect their Xtream Codes account and add XMLTV EPG sources.

### Story 2.1: Add Xtream Account with Secure Credential Storage

As a user,
I want to add my Xtream Codes account credentials securely,
So that the app can connect to my IPTV provider.

**Acceptance Criteria:**

**Given** the Accounts view
**When** I click "Add Account"
**Then** a form appears with fields:
- Account name (display name)
- Server URL
- Username
- Password

**Given** I fill in valid credentials and submit
**When** the form is submitted
**Then** the password is encrypted using OS keychain (or AES-256-GCM fallback)
**And** the account is saved to the `accounts` table
**And** the account appears in the accounts list
**And** the password is never logged or displayed in plaintext

**Given** I submit invalid/empty required fields
**When** validation runs
**Then** appropriate error messages are shown
**And** the form is not submitted

---

### Story 2.2: Test Xtream Connection and Display Account Status

As a user,
I want to test my Xtream connection and see account status,
So that I know my credentials are correct and when my subscription expires.

**Acceptance Criteria:**

**Given** an account exists
**When** I click "Test Connection"
**Then** the app attempts to authenticate with the Xtream API
**And** a loading indicator is shown during the test

**Given** authentication succeeds
**When** the API responds
**Then** I see:
- Connection status: "Connected"
- Account expiry date
- Maximum connections (tuner count)
- Active connections count
**And** this information is stored in the account record

**Given** authentication fails
**When** the API responds with an error
**Then** I see a clear error message explaining the failure
**And** suggestions for common issues (wrong URL, credentials, server down)

---

### Story 2.3: Retrieve and Store Channel List from Xtream

As a user,
I want to fetch my channel list from Xtream,
So that I can see what channels are available from my provider.

**Acceptance Criteria:**

**Given** a connected Xtream account
**When** I click "Scan Channels" or on first successful connection
**Then** the app calls the Xtream `get_live_streams` API
**And** a progress indicator shows scanning status

**Given** the API returns channel data
**When** processing completes
**Then** all channels are stored in `xtream_channels` table with:
- stream_id
- name
- stream_icon (logo URL)
- category_id and category_name
- epg_channel_id (if provided)
**And** available quality tiers are detected and stored (HD, SD, 4K)
**And** VOD and Series categories are stored for future use (FR5)
**And** the tuner count limit is stored from account info (FR6)
**And** scan completes within 60 seconds for 1000 channels (NFR3)

---

### Story 2.4: Add XMLTV Source Management

As a user,
I want to add and manage XMLTV EPG sources,
So that I can get program guide data for my channels.

**Acceptance Criteria:**

**Given** the Accounts view (EPG Sources section)
**When** I click "Add EPG Source"
**Then** a form appears with fields:
- Source name
- URL
- Format (auto-detect or manual: xml, xml.gz)

**Given** I submit a valid XMLTV URL
**When** the source is saved
**Then** it appears in the EPG sources list
**And** is stored in `xmltv_sources` table

**Given** multiple EPG sources exist
**When** I view the sources list
**Then** I can edit or delete each source
**And** I can enable/disable individual sources

---

### Story 2.5: Parse and Store XMLTV EPG Data

As a user,
I want the app to parse my XMLTV data,
So that channel names and program information are available.

**Acceptance Criteria:**

**Given** an active XMLTV source
**When** I click "Refresh EPG" or automatic refresh triggers
**Then** the app downloads the XMLTV file
**And** handles both .xml and .xml.gz formats (using flate2)

**Given** XMLTV data is downloaded
**When** parsing completes
**Then** channels are stored in `xmltv_channels` with:
- channel_id
- display_name
- icon URL
**And** programs are stored in `programs` with:
- title, description
- start_time, end_time
- category, episode_info
**And** parsing uses streaming XML parser (quick-xml) for memory efficiency
**And** EPG load completes within 30 seconds for 7-day guide (NFR4)

**Given** multiple XMLTV sources are active
**When** all sources are parsed
**Then** channel and program data is merged (FR13)
**And** duplicate channels are handled gracefully

---

### Story 2.6: Implement Scheduled EPG Refresh

As a user,
I want EPG data to refresh automatically on a schedule,
So that my program guide stays up to date without manual intervention.

**Acceptance Criteria:**

**Given** the Settings view
**When** I configure EPG refresh schedule
**Then** I can set the daily refresh time (default: 4:00 AM)
**And** the schedule is stored in settings

**Given** a refresh schedule is configured
**When** the scheduled time arrives
**Then** all active XMLTV sources are automatically refreshed
**And** the refresh runs in the background without UI interruption
**And** `last_refresh` timestamp is updated for each source

**Given** the app was not running at scheduled time
**When** the app starts
**Then** it checks if a refresh was missed and triggers one if needed

---

## Epic 3: Channel Discovery & Matching (XMLTV-First)

User can see all XMLTV channels with matched Xtream streams and organize their Plex lineup.

### Story 3.1: Implement Fuzzy Channel Matching Algorithm

As a user,
I want Xtream streams automatically matched to my XMLTV channels,
So that I don't have to manually match hundreds of channels.

**Acceptance Criteria:**

**Given** XMLTV channels and Xtream channels exist in the database
**When** matching is triggered (after scan or manually)
**Then** the fuzzy matching algorithm runs:
1. For each XMLTV channel, find ALL candidate Xtream streams above threshold
2. Normalize channel names (lowercase, remove HD/SD/FHD suffixes, strip punctuation)
3. Calculate Jaro-Winkler similarity score
4. Boost score for exact EPG ID matches
5. Apply confidence threshold (default: 0.85)
**And** `channel_mappings` records are created:
- **One XMLTV channel → Multiple Xtream streams** (one-to-many)
- Each mapping includes: `xmltv_channel_id`, `xtream_channel_id`, `match_confidence`, `is_primary`
- The highest-confidence match is marked `is_primary = true`
- Additional matches stored for failover purposes

**Given** multiple Xtream streams match a single XMLTV channel (e.g., "ESPN HD", "ESPN SD", "ESPN 4K" all match "ESPN")
**When** matching completes
**Then** all matching streams are stored in `channel_mappings`
**And** the best match (highest confidence) is marked as primary
**And** other matches are available as failover sources

**Given** no Xtream stream matches above threshold
**When** matching completes for an XMLTV channel
**Then** the XMLTV channel exists with no mapped streams
**And** `is_enabled` = false in `xmltv_channel_settings`
**And** the channel shows as "No stream matched"

**Given** the matching algorithm runs
**When** processing 1000+ channels
**Then** matching completes within 60 seconds (NFR3)

---

### Story 3.2: Display XMLTV Channel List with Match Status

As a user,
I want to see all my XMLTV channels with their matched Xtream streams,
So that I know which channels are properly configured for Plex.

**Acceptance Criteria:**

**Given** the Channels view
**When** it loads
**Then** I see a virtualized list of all XMLTV channels (TanStack Virtual for performance)
**And** each row shows:
- XMLTV channel name and logo (primary display)
- Source icon indicating this is an XMLTV channel
- Matched Xtream stream(s) with count badge (e.g., "3 streams")
- Primary stream name and confidence percentage
- Enabled/disabled status toggle
**And** I can expand a row to see all matched Xtream streams for that XMLTV channel

**Given** an XMLTV channel has multiple matched Xtream streams
**When** I expand the channel row
**Then** I see all matched streams with:
- Stream name and quality tier (HD/SD/4K)
- Match confidence percentage
- Primary/backup indicator
- Option to change which stream is primary

**Given** an XMLTV channel has no matched streams
**When** viewing the channel list
**Then** the channel shows "No stream matched" with warning indicator
**And** is disabled by default

**Given** a large channel list (1000+ XMLTV channels)
**When** scrolling through the list
**Then** the UI remains responsive (<100ms, NFR5)

---

### Story 3.3: Manual Match Override via Search Dropdown

As a user,
I want to manually match Xtream streams to an XMLTV channel,
So that I can fix incorrect automatic matches or add additional streams.

**Acceptance Criteria:**

**Given** an XMLTV channel row in the Channels view
**When** I click "Add/Edit Streams" button
**Then** a searchable dropdown appears with all Xtream streams

**Given** the search dropdown is open
**When** I type in the search field
**Then** Xtream streams are filtered by name in real-time
**And** results show stream name, quality tier, and category
**And** already-matched streams show a checkmark

**Given** I select an Xtream stream from dropdown
**When** the selection is confirmed
**Then** a channel_mapping is created/updated with:
- `is_manual` = true
- `match_confidence` = 1.0 (manual match)
**And** I can set it as primary or backup

**Given** I want to remove a matched stream
**When** I click the remove button on a stream
**Then** the channel_mapping is deleted
**And** if it was primary, the next highest confidence match becomes primary

---

### Story 3.4: Auto-Rematch on Provider Changes

As a user,
I want the app to detect provider changes and re-match automatically,
So that I don't lose my channel mappings when my provider updates their list.

**Acceptance Criteria:**

**Given** a new Xtream channel scan is performed
**When** comparing to existing channels
**Then** the system detects:
- New Xtream streams (not previously seen)
- Removed Xtream streams (no longer in provider list)
- Changed Xtream streams (same stream_id, different name)

**Given** new Xtream streams are detected
**When** auto-rematch runs
**Then** new streams are matched to XMLTV channels using fuzzy algorithm
**And** they are added as additional stream options (not replacing existing)

**Given** an Xtream stream is removed by provider
**When** auto-rematch runs
**Then** the mapping is marked as unavailable
**And** if it was primary, the next backup stream becomes primary
**And** an event is logged

**Given** manual matches exist
**When** auto-rematch runs
**Then** manual matches are NEVER auto-changed or removed

**Given** a re-match event occurs
**When** the process completes
**Then** an event is logged with change summary
**And** a notification badge appears in the UI

---

### Story 3.5: Channel Enable/Disable for Plex

As a user,
I want to enable or disable XMLTV channels for my Plex lineup,
So that only the channels I want appear in Plex.

**Acceptance Criteria:**

**Given** an XMLTV channel row in the Channels view
**When** I click the enable/disable toggle
**Then** the `xmltv_channel_settings.is_enabled` status is updated immediately
**And** the change is persisted to database

**Given** an XMLTV channel is disabled
**When** the M3U playlist is generated for Plex
**Then** the disabled channel is excluded

**Given** an XMLTV channel has no matched Xtream streams
**When** I try to enable it
**Then** I see a warning: "No stream source available"
**And** the channel cannot be enabled until a stream is matched

**Given** I restart the app
**When** the Channels view loads
**Then** all enable/disable states are preserved (FR25)

---

### Story 3.6: Drag-and-Drop Channel Reordering

As a user,
I want to reorder my XMLTV channels by dragging them,
So that I can organize my Plex channel lineup to my preference.

**Acceptance Criteria:**

**Given** the Channels view
**When** I drag an XMLTV channel row
**Then** visual feedback shows the dragging state
**And** drop zones are highlighted

**Given** I drop a channel in a new position
**When** the drop completes
**Then** the `xmltv_channel_settings.plex_display_order` values are recalculated
**And** the M3U playlist reflects the new order

**Given** I reorder channels
**When** I restart the app
**Then** the custom order is preserved (FR25)

**Implementation notes:** Use dnd-kit library for accessible drag-and-drop.

---

### Story 3.7: Bulk Channel Operations

As a user,
I want to enable/disable multiple XMLTV channels at once,
So that I can quickly configure categories of channels.

**Acceptance Criteria:**

**Given** the Channels view
**When** I select multiple XMLTV channels using checkboxes
**Then** a bulk action toolbar appears

**Given** multiple channels are selected
**When** I click "Enable Selected"
**Then** all selected channels with matched streams are enabled
**And** channels without streams show a warning count

**Given** multiple channels are selected
**When** I click "Disable Selected"
**Then** all selected channels are disabled

**Given** the Channels view
**When** I click "Select All Matched"
**Then** only XMLTV channels with at least one Xtream stream are selected

**Given** the Channels view has category filters
**When** I filter by XMLTV category and select all
**Then** only filtered channels are selected for bulk operations

---

### Story 3.8: Manage Orphan Xtream Channels

As a user,
I want to see Xtream channels that don't match any XMLTV channel,
So that I can decide whether to add them to my Plex lineup with placeholder EPG.

**Acceptance Criteria:**

**Given** the Channels view
**When** I scroll to the "Unmatched Xtream Streams" section
**Then** I see all Xtream channels not matched to any XMLTV channel
**And** each shows: stream name, quality tier, category

**Given** an orphan Xtream channel
**When** I click "Promote to Plex"
**Then** a dialog appears with fields:
- Display name (pre-filled from Xtream name)
- Channel icon URL (pre-filled from Xtream if available)
**And** I can confirm to create a synthetic channel entry

**Given** I promote an orphan Xtream channel
**When** the promotion completes
**Then** a synthetic `xmltv_channels` entry is created with `is_synthetic = true`
**And** a `channel_mappings` entry links it to the Xtream stream
**And** placeholder EPG is generated (2-hour looping blocks)
**And** the channel moves to the main XMLTV channel list

**Given** a synthetic channel exists
**When** EPG refresh runs
**Then** placeholder EPG is regenerated for the next 7 days
**And** each block shows: "{Channel Name} - Live Programming"

**Given** a synthetic channel
**When** I view it in the Channels list
**Then** it shows a "Synthetic" badge to distinguish from real XMLTV channels
**And** I can edit its display name and icon

---

### Story 3.9: Implement Target Lineup View

*Added via Sprint Change Proposal 2026-01-20 - Navigation Restructure (Option C)*

As a user,
I want a dedicated Target Lineup menu item showing my Plex channel lineup,
So that I can manage what channels appear in Plex efficiently.

**Context:** The original Channels tab loaded ALL data from ALL sources with complex SQL queries, causing performance issues. This story creates a focused "Target Lineup" view showing only enabled channels.

**Acceptance Criteria:**

**Given** the sidebar navigation
**When** I look at the menu
**Then** I see "Target Lineup" as a new menu item after Dashboard
**And** the old "Channels" menu item is removed

**Given** the sidebar navigation
**When** I click "Target Lineup"
**Then** I see a new view showing only channels where `is_enabled = true`
**And** the list loads quickly (<500ms for 500 enabled channels)

**Given** the Target Lineup view
**When** I view the channel list
**Then** I can drag-drop to reorder channels
**And** I can toggle enable/disable (disabling removes from lineup)
**And** channels without streams show a warning icon with tooltip "No stream source"

**Given** an enabled channel has no stream source
**When** viewing in Target Lineup
**Then** a warning badge "No stream" appears
**And** hovering shows tooltip "This channel has no video source"

**Given** the Target Lineup is empty
**When** viewing the page
**Then** I see an empty state: "No channels in lineup. Add channels from Sources."
**And** a button links to the Sources view

**Given** I disable a channel from Target Lineup
**When** the toggle is clicked
**Then** the channel is removed from the list (optimistic UI)
**And** a toast shows "Channel removed from lineup"
**And** an "Undo" action is available for 5 seconds

---

### Story 3.10: Implement Sources View with XMLTV Tab

*Added via Sprint Change Proposal 2026-01-20 - Navigation Restructure (Option C)*

As a user,
I want to browse channels from my XMLTV EPG sources,
So that I can find channels to add to my Target Lineup.

**Context:** This creates the new "Sources" menu item with tabbed interface. The XMLTV tab is the default, showing EPG sources as expandable sections.

**Acceptance Criteria:**

**Given** the sidebar navigation
**When** I click "Sources"
**Then** I see a new view with tabs: [XMLTV] [Xtream]
**And** XMLTV tab is selected by default

**Given** the XMLTV tab is active
**When** the view loads
**Then** I see my XMLTV sources as expandable accordion sections
**And** each section header shows: source name, channel count

**Given** I expand an XMLTV source section
**When** the channels load (lazy-loaded per source)
**Then** I see all channels from that source
**And** each channel shows:
- Display name and icon
- "In Lineup" badge (green) if `is_enabled = true`
- Match count badge (e.g., "3 streams matched")
- "No streams" warning if matchCount = 0

**Given** I click a channel in XMLTV tab
**When** the action menu opens
**Then** I can "Add to Lineup" (enable) or "Remove from Lineup" (disable)
**And** I can view/edit matched Xtream streams

---

### Story 3.11: Implement Sources View Xtream Tab

*Added via Sprint Change Proposal 2026-01-20 - Navigation Restructure (Option C)*

As a user,
I want to browse streams from my Xtream accounts,
So that I can link streams to XMLTV channels or promote orphans to my lineup.

**Context:** This adds the Xtream tab to the Sources view created in 3-10. Shows Xtream accounts as expandable sections with stream status indicators.

**Acceptance Criteria:**

**Given** the Sources view
**When** I click the "Xtream" tab
**Then** I see my Xtream accounts as expandable accordion sections
**And** each section header shows: account name, stream count, orphan count

**Given** I expand an Xtream account section
**When** the streams load (lazy-loaded per account)
**Then** I see all streams from that account
**And** each stream shows:
- Stream name, icon, quality badges (HD/SD/4K)
- "Linked" badge (blue) if mapped to an XMLTV channel
- "Orphan" badge (amber) if not mapped to any channel
- "Promoted" badge (green) if has synthetic channel in lineup

**Given** I click a linked stream
**When** the action menu opens
**Then** I can see which XMLTV channel(s) it's linked to
**And** I can unlink or change the link

**Given** I click an orphan stream
**When** the action menu opens
**Then** I can "Promote to Lineup" (create synthetic channel + enable)
**And** I can "Link to XMLTV Channel" (manual match to existing XMLTV channel)

---

## Epic 4: Plex Integration & Streaming

User can add tuner to Plex and watch live TV with automatic quality failover.

### Story 4.1: Serve M3U Playlist Endpoint

As a user,
I want an M3U playlist URL I can add to Plex,
So that Plex can see my channel lineup.

**Acceptance Criteria:**

**Given** the HTTP server is running
**When** Plex (or any client) requests `GET /playlist.m3u`
**Then** an M3U playlist is generated containing:
- Only **enabled** XMLTV channels (from `xmltv_channel_settings.is_enabled = true`)
- Channel names from XMLTV (not Xtream)
- Channel logos from XMLTV (with Xtream fallback)
- Channel numbers from `plex_display_order`
- Stream URLs pointing to `/stream/{xmltv_channel_id}`

**Given** the M3U is generated
**When** a channel has multiple matched Xtream streams
**Then** the stream URL uses the primary stream
**And** failover streams are used transparently by the proxy

**Given** a synthetic channel (promoted orphan)
**When** included in M3U
**Then** it uses the synthetic channel's display name and icon

---

### Story 4.2: Serve XMLTV EPG Endpoint

As a user,
I want an EPG/XMLTV URL I can add to Plex,
So that Plex shows program guide data.

**Acceptance Criteria:**

**Given** the HTTP server is running
**When** Plex requests `GET /epg.xml`
**Then** XMLTV-format EPG is generated containing:
- Only **enabled** XMLTV channels
- Channel IDs matching those in M3U playlist
- Program data for enabled channels only
- 7-day program guide data

**Given** a synthetic channel exists
**When** EPG is generated
**Then** synthetic channels include placeholder programs:
- 2-hour blocks: "{Channel Name} - Live Programming"
- Regenerated for next 7 days

**Given** EPG is requested frequently
**When** generating the response
**Then** the EPG is cached and only regenerated when:
- Channel settings change (enable/disable)
- EPG data is refreshed
- Synthetic channels are added/modified

---

### Story 4.3: Implement HDHomeRun Emulation

As a user,
I want Plex to auto-discover my tuner,
So that I don't have to manually enter URLs.

**Acceptance Criteria:**

**Given** the HTTP server is running
**When** Plex requests `GET /discover.json`
**Then** a valid HDHomeRun discovery response is returned with:
- FriendlyName: "StreamForge"
- ModelNumber: "HDHR5-4K"
- TunerCount from Xtream account
- BaseURL and LineupURL with local IP and port

**Given** the HTTP server is running
**When** Plex requests `GET /lineup.json`
**Then** a channel lineup is returned with enabled XMLTV channels
**And** GuideName uses XMLTV channel display_name
**And** GuideNumber uses plex_display_order
**And** URL points to stream endpoint

**Given** the HTTP server is running
**When** Plex requests `GET /lineup_status.json`
**Then** a valid status response is returned indicating no scan in progress

---

### Story 4.4: Stream Proxy with Quality Selection

As a user,
I want streams to automatically use the best available quality,
So that I get the best viewing experience.

**Acceptance Criteria:**

**Given** Plex requests `GET /stream/{xmltv_channel_id}`
**When** the stream proxy handles the request
**Then** it looks up the primary Xtream stream for the XMLTV channel
**And** selects the highest available quality tier (4K > HD > SD)
**And** proxies the stream from Xtream to Plex

**Given** an active stream
**When** the proxy is running
**Then** stream data is passed through with minimal buffering
**And** stream start time is < 3 seconds (NFR1)
**And** CPU usage during streaming is < 15% (NFR7)

**Given** the tuner limit is reached
**When** a new stream is requested
**Then** an appropriate error is returned to Plex
**And** an event is logged

---

### Story 4.5: Automatic Stream Failover

As a user,
I want streams to automatically recover from failures,
So that my viewing isn't interrupted by provider issues.

**Acceptance Criteria:**

**Given** an active stream from primary Xtream source
**When** a failure is detected (timeout 5s, connection error, HTTP error)
**Then** the proxy immediately fails over to the next backup stream
**And** failover completes in < 2 seconds (NFR2)
**And** Plex is unaware of the switch (FR33)

**Given** multiple backup streams exist for an XMLTV channel
**When** failover occurs
**Then** streams are tried in priority order (by `stream_priority`)
**And** each failure is logged

**Given** a stream has failed over to a lower quality
**When** 60 seconds have passed (recovery period)
**Then** the proxy attempts to upgrade back to higher quality
**And** if successful, continues on higher quality
**And** if failed, stays on current quality

**Given** all streams for a channel fail
**When** no more backups available
**Then** the stream ends with error
**And** an event is logged with details

**Given** stream failover events occur
**When** the event is logged
**Then** the log includes: channel, from_stream, to_stream, reason, timestamp

---

### Story 4.6: Display Plex Configuration URLs

As a user,
I want to see the URLs I need to configure Plex,
So that I can easily set up my tuner.

**Acceptance Criteria:**

**Given** the Dashboard or Settings view
**When** I look at the Plex Integration section
**Then** I see:
- M3U Playlist URL: `http://{local_ip}:{port}/playlist.m3u`
- EPG/XMLTV URL: `http://{local_ip}:{port}/epg.xml`
- HDHomeRun URL: `http://{local_ip}:{port}` (for manual tuner setup)
- Tuner count: {count} (from Xtream account)

**Given** any URL is displayed
**When** I click a "Copy" button next to it
**Then** the URL is copied to clipboard
**And** a toast notification confirms the copy

**Given** the HTTP server is not running
**When** I view the Plex Integration section
**Then** I see a warning that the server needs to be started
**And** URLs show as unavailable

---

## Epic 5: EPG Viewer & Discovery

User can browse and search the program guide for enabled channels (Plex preview).

### Story 5.1: EPG Grid Browser with Time Navigation

As a user,
I want to browse the EPG in a grid view,
So that I can see what's on across all my enabled channels.

**Acceptance Criteria:**

**Given** the EPG view
**When** it loads
**Then** I see a grid showing:
- Rows: Enabled XMLTV channels only (Plex preview mode)
- Columns: Time slots (30-minute increments)
- Cells: Program titles with duration bars

**Given** the EPG grid
**When** I use time navigation controls
**Then** I can jump to:
- Now (current time centered)
- Tonight (prime time 7-10 PM)
- Tomorrow
- +/- 1 day navigation
- Date picker for up to 7 days ahead

**Given** the EPG grid with many channels
**When** scrolling vertically and horizontally
**Then** the UI remains responsive (<100ms, NFR5)
**And** TanStack Virtual is used for efficient rendering

**Given** a program cell in the grid
**When** I click on it
**Then** the program details panel opens (Story 5.3)

---

### Story 5.2: EPG Search Functionality

As a user,
I want to search the EPG by various criteria,
So that I can find specific programs I'm interested in.

**Acceptance Criteria:**

**Given** the EPG view
**When** I click on the search field
**Then** I can enter search text

**Given** I enter search text
**When** the search executes
**Then** results are filtered by:
- Program title (partial match)
- Program description (partial match)
- Channel name (partial match)
**And** only enabled XMLTV channels are searched

**Given** search results are displayed
**When** I view the results
**Then** each result shows:
- Program title
- Channel name
- Start time and duration
- Relevance indicator

**Given** I click a search result
**When** the selection is made
**Then** the EPG grid scrolls to that program's time slot
**And** the program details panel opens

**Given** the search field
**When** I clear the search
**Then** the EPG returns to normal grid view

---

### Story 5.3: Program Details View

As a user,
I want to see detailed information about a program,
So that I can decide if I want to watch it.

**Acceptance Criteria:**

**Given** a program is selected (from grid or search)
**When** the details panel opens
**Then** I see:
- Program title
- Channel name and logo (XMLTV info)
- Start time and end time
- Duration
- Description (if available)
- Category/genre (if available)
- Episode info (if available, e.g., "S02E05")

**Given** the program details panel
**When** I click outside or press Escape
**Then** the panel closes

**Given** a program on a channel with multiple streams
**When** viewing details
**Then** I see which Xtream stream is currently primary
**And** stream quality tier is displayed

---

## Epic 6: Settings, Logging & Updates

User can configure the app, view event logs, and keep the app updated.

### Story 6.1: Settings GUI for Server and Startup Options

As a user,
I want to configure server and startup settings via GUI,
So that I can customize how the app runs without editing config files.

**Acceptance Criteria:**

**Given** the Settings view
**When** it loads
**Then** I see configuration sections:
- **Server Settings:** Port number (default 5004)
- **Startup Settings:** Auto-start on boot toggle
- **EPG Settings:** Refresh schedule time picker

**Given** I change the server port
**When** I save the setting
**Then** the HTTP server restarts on the new port
**And** Plex configuration URLs update to show new port

**Given** I toggle auto-start on boot
**When** the setting is saved
**Then** the OS autostart entry is created/removed (Windows registry, macOS launchd, Linux desktop file)

**Given** I change EPG refresh time
**When** the setting is saved
**Then** the scheduler is updated with the new time
**And** next refresh time is displayed

---

### Story 6.2: Configuration Export/Import

As a user,
I want to export and import my configuration,
So that I can backup my settings or migrate to a new machine.

**Acceptance Criteria:**

**Given** the Settings view
**When** I click "Export Configuration"
**Then** a file save dialog opens
**And** a JSON file is saved containing:
- All settings
- Account info (excluding passwords)
- XMLTV source URLs
- Channel mappings and settings
- Display order preferences

**Given** I have a configuration export file
**When** I click "Import Configuration" and select the file
**Then** a preview dialog shows what will be imported
**And** I can confirm or cancel

**Given** I confirm the import
**When** the import completes
**Then** all settings are applied
**And** I'm prompted to re-enter account passwords (not exported for security)
**And** a success message is shown

**Given** the import file is invalid or corrupted
**When** import is attempted
**Then** an error message explains the problem
**And** existing configuration is not modified

---

### Story 6.3: Event Logging System

As a developer/user,
I want the app to log important events,
So that I can troubleshoot issues and understand system behavior.

**Acceptance Criteria:**

**Given** the app is running
**When** significant events occur
**Then** they are logged to the `event_log` table with:
- Timestamp
- Level (info, warn, error)
- Category (connection, stream, match, epg, system)
- Message
- Details (JSON for additional context)

**Events to log:**
- Xtream connection success/failure
- Stream start/stop/failover
- EPG refresh start/complete/error
- Channel matching results
- Provider changes detected
- Configuration changes
- Auto-start events

**Given** log verbosity is set to "minimal"
**When** events occur
**Then** only warn and error level events are logged

**Given** log verbosity is set to "verbose"
**When** events occur
**Then** all events including info level are logged

---

### Story 6.4: Event Log Viewer with Notification Badge

As a user,
I want to view event logs in the app,
So that I can see what's happening without checking external files.

**Acceptance Criteria:**

**Given** the Logs view
**When** it loads
**Then** I see a list of recent events (most recent first)
**And** each entry shows: timestamp, level icon, category, message
**And** I can expand an entry to see full details

**Given** events have occurred since last viewed
**When** I look at the navigation sidebar
**Then** a notification badge shows the count of unread events

**Given** I open the Logs view
**When** viewing events
**Then** events are automatically marked as read
**And** the notification badge clears

**Given** the Logs view
**When** I click "Clear Log"
**Then** a confirmation dialog appears
**And** on confirm, all events are deleted from database

**Given** the Logs view
**When** I use filter controls
**Then** I can filter by:
- Level (info, warn, error)
- Category
- Date range

---

### Story 6.5: Auto-Update Mechanism

As a user,
I want the app to check for and install updates,
So that I always have the latest features and fixes.

**Acceptance Criteria:**

**Given** the app starts
**When** it checks for updates (on launch, configurable)
**Then** it queries the update server for new versions
**And** if an update is available, a notification appears

**Given** an update is available
**When** I see the notification
**Then** I can click to see release notes
**And** I can choose to "Download & Install" or "Remind Later"

**Given** I click "Download & Install"
**When** the download completes
**Then** the update package signature is verified (Ed25519, NFR22)
**And** on verification success, the update is installed
**And** the app restarts with the new version

**Given** signature verification fails
**When** the update is rejected
**Then** an error is shown explaining the security issue
**And** the update is not applied
**And** the event is logged

**Given** the Settings view
**When** I look at the Updates section
**Then** I see:
- Current version
- "Check for Updates" button
- Auto-check toggle (on/off)
- Last check timestamp

**Given** an update is installed
**When** the app restarts
**Then** all settings are preserved (FR55)
**And** database migrations run if needed
