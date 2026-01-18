---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
completedDate: 2026-01-18
inputDocuments:
  - prd.md
  - architecture.md
---

# iptv - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for iptv, decomposing the requirements from the PRD and Architecture requirements into implementable stories.

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

**Channel Matching**
- FR14: System can perform fuzzy matching between Xtream channels and XMLTV channels
- FR15: System can display match confidence scores for each channel pairing
- FR16: System can auto-match channels above confidence threshold
- FR17: User can manually override channel matches via search dropdown
- FR18: System can detect when Xtream channel list has changed
- FR19: System can automatically re-match channels when provider updates list
- FR20: User can trigger manual re-scan of channels

**Channel Management**
- FR21: User can view all channels with their match status
- FR22: User can enable or disable individual channels
- FR23: User can reorder channels via drag-and-drop
- FR24: User can bulk-enable or bulk-disable channels
- FR25: System can remember channel order and enabled state across restarts
- FR26: Unmatched channels default to disabled

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
- Diesel migrations for schema management

**From Architecture - Core Module Structure:**
- Xtream Client module (client, types, auth, streams)
- XMLTV Parser module (parser, types, fetcher)
- Channel Matcher module (fuzzy, scorer, auto_rematch)
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
| FR14-FR20 | Epic 3 | Channel matching and auto-rematch |
| FR21-FR26 | Epic 3 | Channel management UI |
| FR27-FR33 | Epic 4 | Stream proxy and failover |
| FR34-FR38 | Epic 4 | Plex integration and HDHomeRun |
| FR39-FR42 | Epic 5 | EPG viewer and search |
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

### Epic 3: Channel Discovery & Matching
User can see all channels matched to EPG data and organize their lineup.

**Scope:**
- Fuzzy matching algorithm (Jaro-Winkler + normalization)
- Match confidence score display
- Auto-match above threshold (default 0.85)
- Manual match override via search dropdown
- Provider change detection
- Automatic re-matching on provider updates
- Manual re-scan trigger
- Channel list view with match status
- Enable/disable individual channels
- Drag-and-drop channel reordering
- Bulk enable/disable
- Persistent channel order and enabled state
- Unmatched channels default to disabled

**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26
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
- M3U playlist endpoint (/playlist.m3u)
- XMLTV EPG endpoint (/epg.xml)
- HDHomeRun emulation (/discover.json, /lineup.json, /lineup_status.json)
- Display M3U/EPG URLs in GUI for Plex configuration
- Report correct tuner count to Plex

**FRs covered:** FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR38
**NFRs addressed:** NFR1 (stream start), NFR2 (failover time), NFR11 (failover success), NFR12 (Plex versions), NFR21 (local-only)

---

### Epic 5: EPG Viewer & Discovery
User can browse and search the program guide within the application.

**Scope:**
- EPG grid/list browser
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

## Epic 3: Channel Discovery & Matching

User can see all channels matched to EPG data and organize their lineup.

### Story 3.1: Implement Fuzzy Channel Matching Algorithm

As a user,
I want channels automatically matched to EPG data,
So that I don't have to manually match hundreds of channels.

**Acceptance Criteria:**

**Given** Xtream channels and XMLTV channels exist
**When** matching is triggered (after scan or manually)
**Then** the fuzzy matching algorithm runs:
1. Normalize channel names (lowercase, remove HD/SD/FHD suffixes, strip punctuation)
2. Calculate Jaro-Winkler similarity score
3. Boost score for exact EPG ID matches
4. Apply confidence threshold (default: 0.85)

**Given** a match is found above threshold
**When** matching completes
**Then** a `channel_mappings` record is created with:
- xtream_channel_id → xmltv_channel_id
- match_confidence score
- is_manual = false
- is_enabled = true (if matched) or false (if unmatched, FR26)

**Given** no match is found above threshold
**When** matching completes
**Then** the channel is marked as unmatched
**And** is_enabled defaults to false

---

### Story 3.2: Display Channel List with Match Status and Confidence

As a user,
I want to see all my channels with their match status,
So that I know which channels are properly configured.

**Acceptance Criteria:**

**Given** the Channels view
**When** it loads
**Then** I see a virtualized list of all channels (TanStack Virtual for performance)
**And** each row shows:
- Channel name and logo
- Matched EPG channel name (or "Unmatched")
- Match confidence percentage (FR15)
- Enabled/disabled status
- Category

**Given** the channel list
**When** I look at the status indicators
**Then** matched channels show green indicator
**And** unmatched channels show yellow/warning indicator
**And** confidence below 90% shows amber indicator

**Given** a large channel list (1000+ channels)
**When** scrolling through the list
**Then** the UI remains responsive (<100ms, NFR5)

---

### Story 3.3: Manual Match Override via Search Dropdown

As a user,
I want to manually match or correct channel matches,
So that I can fix incorrect automatic matches.

**Acceptance Criteria:**

**Given** a channel row in the Channels view
**When** I click on the matched EPG channel field
**Then** a searchable dropdown appears with all XMLTV channels

**Given** the search dropdown is open
**When** I type in the search field
**Then** XMLTV channels are filtered by name in real-time
**And** results show channel name and ID

**Given** I select an XMLTV channel from dropdown
**When** the selection is confirmed
**Then** the channel_mapping is updated with:
- New xmltv_channel_id
- is_manual = true
- match_confidence = 1.0 (manual match)
**And** the channel row updates immediately

**Given** I want to unmatch a channel
**When** I select "No match" option
**Then** xmltv_channel_id is set to null
**And** the channel shows as unmatched

---

### Story 3.4: Auto-Rematch on Provider Changes

As a user,
I want the app to detect provider changes and re-match automatically,
So that I don't lose my channel mappings when my provider updates their list.

**Acceptance Criteria:**

**Given** a new channel scan is performed
**When** comparing to existing channels
**Then** the system detects:
- New channels (not previously seen)
- Removed channels (no longer in provider list)
- Changed channels (same stream_id, different name)

**Given** provider changes are detected
**When** auto-rematch runs
**Then** new channels are matched using fuzzy algorithm
**And** removed channels have their mappings preserved (for potential return)
**And** changed channels are re-matched if confidence drops below threshold
**And** manual matches are preserved (never auto-changed)

**Given** a re-match event occurs
**When** the process completes
**Then** an event is logged with change summary
**And** a notification badge appears in the UI

---

### Story 3.5: Channel Enable/Disable Functionality

As a user,
I want to enable or disable individual channels,
So that only the channels I want appear in Plex.

**Acceptance Criteria:**

**Given** a channel row in the Channels view
**When** I click the enable/disable toggle
**Then** the channel's is_enabled status is updated immediately
**And** the change is persisted to database

**Given** a channel is disabled
**When** the M3U playlist is generated
**Then** the disabled channel is excluded

**Given** I restart the app
**When** the Channels view loads
**Then** all enable/disable states are preserved (FR25)

---

### Story 3.6: Drag-and-Drop Channel Reordering

As a user,
I want to reorder my channels by dragging them,
So that I can organize my channel list to my preference.

**Acceptance Criteria:**

**Given** the Channels view
**When** I drag a channel row
**Then** visual feedback shows the dragging state
**And** drop zones are highlighted

**Given** I drop a channel in a new position
**When** the drop completes
**Then** the channel order is updated
**And** display_order values are recalculated
**And** the M3U playlist reflects the new order

**Given** I reorder channels
**When** I restart the app
**Then** the custom order is preserved (FR25)

**Implementation notes:** Use dnd-kit library for accessible drag-and-drop.

---

### Story 3.7: Bulk Channel Operations

As a user,
I want to enable/disable multiple channels at once,
So that I can quickly configure categories of channels.

**Acceptance Criteria:**

**Given** the Channels view
**When** I select multiple channels using checkboxes
**Then** a bulk action toolbar appears

**Given** multiple channels are selected
**When** I click "Enable Selected"
**Then** all selected channels are enabled
**And** changes are persisted

**Given** multiple channels are selected
**When** I click "Disable Selected"
**Then** all selected channels are disabled

**Given** the Channels view
**When** I click "Select All" / "Select None"
**Then** all channels are selected/deselected accordingly

**Given** the Channels view has category filters
**When** I filter by category and select all
**Then** only filtered channels are selected for bulk operations

---

## Epic 4: Plex Integration & Streaming

User can add tuner to Plex and watch live TV with automatic quality failover.

### Story 4.1: Serve M3U Playlist Endpoint

As a Plex server,
I want an M3U playlist endpoint,
So that I can discover available channels.

**Acceptance Criteria:**

**Given** the HTTP server is running
**When** a GET request is made to `/playlist.m3u`
**Then** a valid M3U playlist is returned with Content-Type `audio/x-mpegurl`

**Given** enabled channels exist
**When** the playlist is generated
**Then** each enabled channel entry includes:
- `#EXTINF` with channel number, name, and tvg attributes (tvg-id, tvg-name, tvg-logo)
- Stream URL pointing to the proxy endpoint: `http://localhost:{port}/stream/{channel_id}`
**And** channels are ordered by display_order

**Given** no enabled channels exist
**When** the playlist is requested
**Then** an empty but valid M3U file is returned

---

### Story 4.2: Serve XMLTV EPG Endpoint

As a Plex server,
I want an XMLTV EPG endpoint,
So that I can display program guide information.

**Acceptance Criteria:**

**Given** the HTTP server is running
**When** a GET request is made to `/epg.xml`
**Then** a valid XMLTV file is returned with Content-Type `application/xml`

**Given** EPG data exists for matched channels
**When** the EPG is generated
**Then** only enabled channels are included
**And** channel IDs match those used in the M3U playlist
**And** program data includes title, description, start/stop times, categories

**Given** the EPG file is large
**When** serving the response
**Then** the response is streamed (not buffered entirely in memory)

---

### Story 4.3: Implement HDHomeRun Emulation

As a Plex server,
I want HDHomeRun discovery endpoints,
So that Plex can automatically detect and add this tuner.

**Acceptance Criteria:**

**Given** the HTTP server is running
**When** a GET request is made to `/discover.json`
**Then** HDHomeRun device info is returned:
```json
{
  "FriendlyName": "iptv",
  "ModelNumber": "HDHR5-4K",
  "FirmwareName": "hdhomerun5_atsc",
  "FirmwareVersion": "20200101",
  "DeviceID": "{generated_id}",
  "BaseURL": "http://{local_ip}:{port}",
  "LineupURL": "http://{local_ip}:{port}/lineup.json",
  "TunerCount": {tuner_count_from_xtream}
}
```

**Given** the HTTP server is running
**When** a GET request is made to `/lineup.json`
**Then** the channel lineup is returned with GuideNumber, GuideName, and URL for each enabled channel

**Given** the HTTP server is running
**When** a GET request is made to `/lineup_status.json`
**Then** lineup status is returned indicating scan is not in progress

**Given** the tuner count from Xtream account
**When** TunerCount is reported
**Then** it matches the subscription's max_connections (FR38)

---

### Story 4.4: Stream Proxy with Quality Selection

As a user watching through Plex,
I want streams proxied through the app with best quality selected,
So that I get the best viewing experience.

**Acceptance Criteria:**

**Given** Plex requests a stream via `/stream/{channel_id}`
**When** the proxy handles the request
**Then** it connects to the Xtream provider for that channel
**And** selects the highest available quality tier (4K > HD > SD)
**And** streams data back to Plex with minimal latency

**Given** a stream is requested
**When** the connection is established
**Then** stream starts within 3 seconds (NFR1)
**And** the stream is tracked in active_streams

**Given** multiple concurrent stream requests
**When** streams are within tuner limit
**Then** all streams are served successfully
**And** streams beyond tuner limit return appropriate error

---

### Story 4.5: Automatic Stream Failover

As a user watching through Plex,
I want automatic failover if a stream fails,
So that my viewing isn't interrupted by provider issues.

**Acceptance Criteria:**

**Given** an active stream
**When** a failure is detected (timeout 5s, connection error, HTTP error)
**Then** the proxy automatically switches to the next quality tier
**And** failover completes within 2 seconds (NFR2)
**And** Plex is unaware of the switch (FR33)

**Given** failover to a lower quality succeeds
**When** 60 seconds pass without errors
**Then** the proxy attempts to upgrade back to original quality
**And** if upgrade fails, it stays on current quality

**Given** all quality tiers fail
**When** no working stream is available
**Then** an error is returned to Plex
**And** the failure is logged with details

**Given** stream failovers occur
**When** reviewing the logs
**Then** all failover events are recorded with:
- Channel, timestamp
- Original quality, failover quality
- Failure reason

**And** >99% of recoverable failures are handled transparently (NFR11)

---

### Story 4.6: Display Plex Configuration URLs

As a user,
I want to see the URLs needed to add this tuner to Plex,
So that I can complete setup without guessing.

**Acceptance Criteria:**

**Given** the Dashboard or Settings view
**When** I look at the "Plex Setup" section
**Then** I see:
- Device URL: `http://{local_ip}:{port}`
- M3U URL: `http://{local_ip}:{port}/playlist.m3u`
- EPG URL: `http://{local_ip}:{port}/epg.xml`

**Given** the URLs are displayed
**When** I click a "Copy" button next to each URL
**Then** the URL is copied to clipboard
**And** a confirmation toast is shown

**Given** the port is changed in settings
**When** I view the URLs
**Then** they reflect the current configured port

---

## Epic 5: EPG Viewer & Discovery

User can browse and search the program guide within the application.

### Story 5.1: EPG Grid Browser with Time Navigation

As a user,
I want to browse the program guide,
So that I can see what's on now and plan my viewing.

**Acceptance Criteria:**

**Given** the EPG view
**When** it loads
**Then** I see a grid showing:
- Channels as rows
- Time slots as columns
- Program blocks with title and duration

**Given** the EPG grid
**When** I use time navigation controls
**Then** I can jump to:
- Now (current time)
- Tonight (prime time)
- Tomorrow
- Specific date within available EPG range

**Given** many channels exist
**When** scrolling the EPG grid
**Then** the channel column remains sticky/visible
**And** virtual rendering keeps performance smooth (NFR5)

---

### Story 5.2: EPG Search Functionality

As a user,
I want to search the program guide,
So that I can find specific shows or content.

**Acceptance Criteria:**

**Given** the EPG view
**When** I enter text in the search field
**Then** programs are filtered in real-time by:
- Program title (FR40)
- Channel name (FR40)
- Description text (FR40)

**Given** search results exist
**When** I view the results
**Then** each result shows:
- Program title
- Channel name
- Air time
- Brief description snippet

**Given** I click a search result
**When** the selection is made
**Then** the EPG grid scrolls to that program's time and channel

---

### Story 5.3: Program Details View

As a user,
I want to see detailed information about a program,
So that I can decide whether to watch it.

**Acceptance Criteria:**

**Given** the EPG grid or search results
**When** I click on a program
**Then** a details panel/modal appears showing:
- Full title
- Complete description
- Channel name and logo
- Start time and end time
- Duration
- Category/genre
- Episode info (if available)

**Given** the program details panel
**When** I click outside or press close
**Then** the panel closes and I return to the EPG view

---

## Epic 6: Settings, Logging & Updates

User can configure the app, view event logs, and keep the app updated.

### Story 6.1: Settings GUI for Server and Startup Options

As a user,
I want to configure application settings through the GUI,
So that I don't need to edit config files.

**Acceptance Criteria:**

**Given** the Settings view
**When** it loads
**Then** I see configuration options for:
- Local server port (FR44)
- Auto-start on boot toggle (FR45)
- EPG refresh schedule time (FR46)
- Log verbosity level (FR52)

**Given** I change a setting
**When** I click "Save" or changes auto-save
**Then** the setting is persisted to the database
**And** changes take effect (some may require restart notification)

**Given** I enter an invalid value (e.g., invalid port)
**When** validation runs
**Then** an error message explains the issue
**And** the invalid value is not saved

---

### Story 6.2: Configuration Export/Import

As a user,
I want to export and import my configuration,
So that I can backup settings or transfer to another machine.

**Acceptance Criteria:**

**Given** the Settings view
**When** I click "Export Configuration"
**Then** a save dialog opens
**And** I can save a JSON file containing:
- All settings
- Account info (excluding passwords)
- XMLTV sources
- Channel mappings and order

**Given** I have an exported config file
**When** I click "Import Configuration"
**Then** a file picker opens
**And** selecting a valid file imports the settings
**And** I'm prompted to re-enter passwords for security

**Given** an invalid or corrupted config file
**When** import is attempted
**Then** a clear error message is shown
**And** existing settings are not modified

---

### Story 6.3: Event Logging System

As a developer/user,
I want comprehensive event logging,
So that I can troubleshoot issues.

**Acceptance Criteria:**

**Given** the application is running
**When** significant events occur
**Then** they are logged to the `event_log` table with:
- Timestamp
- Level (info, warn, error)
- Category (connection, failover, match, etc.)
- Message
- Details (JSON for additional context)

**Given** configurable log verbosity
**When** set to "error" level
**Then** only errors are logged

**Given** configurable log verbosity
**When** set to "info" level
**Then** info, warnings, and errors are logged

**Given** events include:
- Xtream connection attempts and results
- Stream starts, failures, and failovers
- Channel matching operations
- EPG refresh operations
- Configuration changes

---

### Story 6.4: Event Log Viewer with Notification Badge

As a user,
I want to view event logs in the app,
So that I can understand what's happening and troubleshoot.

**Acceptance Criteria:**

**Given** the Logs view
**When** it loads
**Then** I see a chronological list of events with:
- Timestamp
- Level indicator (color-coded)
- Category
- Message

**Given** unread events exist
**When** I look at the navigation
**Then** a badge shows the count of unread events (FR50)

**Given** I view the Logs
**When** events are displayed
**Then** they are marked as read
**And** the badge count updates

**Given** the Logs view
**When** I click "Clear Log"
**Then** all events are deleted after confirmation
**And** the log view is empty

**Given** many log entries exist
**When** viewing the log
**Then** filtering by level and category is available
**And** the list is virtualized for performance

---

### Story 6.5: Auto-Update Mechanism

As a user,
I want the app to check for and install updates,
So that I always have the latest features and fixes.

**Acceptance Criteria:**

**Given** the app starts or Settings view
**When** I click "Check for Updates" or auto-check runs
**Then** the app queries the update server
**And** shows current version and available version (if any)

**Given** an update is available
**When** I click "Download & Install"
**Then** the update is downloaded with progress indicator
**And** the update signature is verified (Ed25519, NFR22)
**And** after download completes, I'm prompted to restart

**Given** an update is installed
**When** the app restarts
**Then** all settings and data are preserved (FR55)
**And** the new version is running

**Given** the update check or download fails
**When** an error occurs
**Then** a clear error message is shown
**And** the app continues running normally

**Given** no update is available
**When** the check completes
**Then** a message confirms I'm on the latest version
