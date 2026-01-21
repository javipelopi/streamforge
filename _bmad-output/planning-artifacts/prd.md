---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
inputDocuments:
  - product-brief-iptv-2026-01-18.md
workflowType: 'prd'
documentCounts:
  briefCount: 1
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 0
projectType: greenfield
classification:
  projectType: desktop_app
  domain: media_entertainment
  complexity: low
  projectContext: greenfield
completedDate: 2026-01-18
---

# Product Requirements Document - iptv

**Author:** Javier
**Date:** 2026-01-18

## Executive Summary

**iptv** is a cross-platform desktop application that bridges Xtream Codes IPTV services to Plex Media Server. It serves as a modern, actively-maintained replacement for the defunct XTeVe project, with native Xtream Codes API integration instead of M3U-only support.

**Core Value Proposition:** Configure once, forget forever. Channels auto-match using fuzzy search, auto-rematch when providers update, and streams failover transparently. Plex never knows anything went wrong.

**Key Differentiators:**
- Native Xtream Codes API (not M3U scraping) - access quality tiers, timeshift, metadata
- Intelligent fuzzy matching with automatic re-matching on provider updates
- Quality-based failover - stream interruptions handled transparently
- Full GUI - no config files, no terminal
- Cross-platform from day one (Windows, Linux, macOS)

**Target Platforms:** Windows, Linux, macOS (MVP), with future mobile/TV expansion.

---

## Success Criteria

### User Success

| Criteria | Target | Measurement |
|----------|--------|-------------|
| **Setup Completion** | <10 minutes from install to Plex showing live TV | Time from first launch to working Plex tuner |
| **Channel Match Accuracy** | >95% channels auto-matched correctly | No manual intervention on initial scan |
| **Invisible Operation** | Weeks without opening GUI | App runs silently in background |
| **Failure Tolerance** | Non-intrusive error handling | Failures logged, surfaced on next GUI open (no popups/alerts) |

**"Aha!" Moment:** First time a stream fails mid-watch and the user doesn't notice because failover handled it.

### Technical Success

| Criteria | Target |
|----------|--------|
| **Failover Success Rate** | >99% of stream failures recovered transparently (including mid-stream) |
| **Uptime** | Indefinite continuous operation without restart |
| **Platform Parity** | Windows, Linux, macOS all meet same quality bar |
| **Plex Compatibility** | 3 latest Plex versions minimum, broader where feasible |
| **Manual Interventions** | 0 per month after initial setup |

### Business Success

**N/A** - Personal utility tool. No commercial metrics.

Success = "I never think about it because it just works."

### Measurable Outcomes

- Initial setup completes without errors
- Fuzzy matching requires ≤5% manual corrections
- Stream interruptions invisible to viewer
- Provider channel updates handled automatically
- No app restarts required for normal operation

---

## Product Scope

### MVP - Minimum Viable Product

**Must have for v1.0:**
- Xtream Codes API connection (single account)
- XMLTV/EPG loading (XML + gzipped formats)
- Fuzzy channel matching with auto-rematch
- Quality-based stream selection + transparent failover
- M3U + EPG endpoints for Plex (HDHomeRun emulation)
- Channel enable/disable + drag-drop ordering
- Full GUI (no config files required)
- Built-in EPG viewer with search
- Windows, Linux, macOS support

### Growth Features (Post-MVP)

**v1.1 - Polish:**
- Multiple Xtream accounts aggregation
- Endpoint authentication option
- Improved matching algorithms
- Performance optimizations

### Vision (Future)

**v2.0+:**
- Android / Android TV / Apple TV apps
- Direct video playback (standalone mode)
- Remote management from mobile
- Cloud config backup/sync
- Community channel mapping presets

---

## User Journeys

### Journey 1: First-Time Setup

**Opening Scene:**
Saturday afternoon. Javier has been using XTeVe for a year, but it broke again last week when his Xtream provider reshuffled channel IDs. He's spent hours manually re-matching channels. Again. He searches "XTeVe alternative 2026" and finds iptv.

**Rising Action:**
He downloads the installer, runs it. A clean GUI opens - no config files, no terminal. He enters his Xtream credentials, adds his XMLTV URL, and clicks "Scan & Match." The app churns for 30 seconds, then shows a channel list with green checkmarks next to 97% of channels.

He drags ESPN to the top, disables the shopping channels, and clicks "Save." The app shows him the M3U and EPG URLs to add to Plex.

**Climax:**
He adds the tuner to Plex, refreshes the guide, and there it is - his full channel lineup with proper logos and EPG data. He clicks a channel. It plays instantly.

**Resolution:**
Total time: 8 minutes. No config files touched. No terminal opened. He closes the iptv GUI and forgets about it.

**Requirements Revealed:** Installer, credential input, XMLTV configuration, auto-scan, fuzzy matching UI, channel management (drag/drop, enable/disable), M3U/EPG URL display, system tray operation.

### Journey 2: Daily Use

**Opening Scene:**
Three weeks later. Javier sits down to watch the game. He opens Plex, navigates to Live TV, finds ESPN in his guide.

**Rising Action:**
He clicks play. The stream starts in 2 seconds. He watches the first half, gets a snack, comes back for the second half. At halftime, his Xtream provider's primary server hiccups.

**Climax:**
The stream stutters for 0.5 seconds, then continues. Javier doesn't notice - he's checking his phone. Behind the scenes, iptv detected the failure, switched to the SD backup stream, then switched back to HD when the primary recovered.

**Resolution:**
Game ends. Javier turns off the TV. He has no idea iptv exists. That's success.

**Requirements Revealed:** Fast stream startup, transparent failover, quality tier management, Plex remains unaware of switches, silent background operation.

### Journey 3: Something's Wrong

**Opening Scene:**
Two months in. Javier tries to watch a channel and gets a Plex error. First time this has happened.

**Rising Action:**
He opens the iptv GUI for the first time since setup. A small badge shows "3 events" on the status icon. He clicks it and sees a log: his Xtream provider changed their channel list structure, and 12 channels failed to auto-rematch.

The app shows a "Re-scan Channels" button. He clicks it.

**Climax:**
The app re-scans, fuzzy-matches 10 of 12 channels automatically. The remaining 2 are genuinely new channels from the provider. Javier manually matches them in 30 seconds using the search dropdown.

**Resolution:**
He clicks Save, goes back to Plex, and the channel works. Total interruption: 3 minutes.

**Requirements Revealed:** Event logging, GUI notification badge, log viewer, re-scan functionality, manual match override, search-based channel picker.

### Journey 4: Maintenance

**Opening Scene:**
Six months later. Javier sees a notification that a new version of iptv is available.

**Rising Action:**
He opens the GUI, clicks "Check for Updates." The app downloads and installs the update, preserving all his settings. It restarts automatically.

He browses the EPG viewer out of curiosity - searches for "UFC" to see if there are any fights this weekend.

**Climax:**
He finds a fight on a channel he'd disabled. He enables it. While he's there, he drags some new channels into logical groups.

**Resolution:**
5 minutes of optional tweaking. He closes the GUI, satisfied.

**Requirements Revealed:** Auto-update mechanism, settings preservation across updates, EPG viewer with search, channel discovery, bulk channel management.

### Journey Requirements Summary

| Journey | Key Capabilities |
|---------|------------------|
| **First-Time Setup** | Installer, credential management, XMLTV config, auto-scan, fuzzy matching, channel management UI, Plex URL generation, system tray |
| **Daily Use** | Fast streams, transparent failover, quality management, silent operation |
| **Troubleshooting** | Event logging, notification badges, log viewer, re-scan, manual match override |
| **Maintenance** | Auto-update, settings preservation, EPG search, channel organization |

---

## Desktop Application Requirements

### Platform Support

| Platform | Requirements |
|----------|--------------|
| **Windows** | Windows 10+, x64 |
| **Linux** | Ubuntu 20.04+, Debian 11+, Fedora 35+ (or equivalent) |
| **macOS** | macOS 11 Big Sur+, Intel and Apple Silicon |

### Application Architecture

**Core Components:**
- **Background Service:** Runs continuously, serves M3U/EPG endpoints, handles stream proxying and failover
- **GUI Application:** Configuration, channel management, EPG viewer, logs
- **System Tray Integration:** Minimal footprint when running, quick access to status and GUI

**Startup Behavior:**
- Launches on system boot (configurable)
- Starts minimized to system tray
- Background service starts automatically

### Local Server

**Endpoints Served:**
- `http://localhost:{port}/playlist.m3u` - M3U playlist for Plex
- `http://localhost:{port}/epg.xml` - XMLTV EPG data for Plex
- `http://localhost:{port}/stream/{channel_id}` - Proxied stream with failover

**HDHomeRun Emulation:**
- Appears as HDHomeRun tuner to Plex
- Reports tuner count matching Xtream subscription
- Supports Plex's tuner discovery protocol

### Data Storage

**Local Storage:**
- Configuration (credentials, XMLTV URLs, port settings)
- Channel mappings and ordering
- User preferences (enabled/disabled channels)
- Cached EPG data
- Event logs

**No Cloud Dependencies:** All data stored locally. No account required. No telemetry.

---

## Functional Requirements

### Xtream Codes Integration

- FR1: User can add Xtream Codes account credentials (server URL, username, password)
- FR2: System can connect to Xtream Codes API and authenticate
- FR3: System can retrieve full channel list from Xtream provider
- FR4: System can retrieve available quality tiers for each channel
- FR5: System can retrieve VOD and Series categories (for future use)
- FR6: System can detect and respect tuner count limits from subscription
- FR7: User can test connection and see account status/expiry

### XMLTV/EPG Management

- FR8: User can add multiple XMLTV source URLs
- FR9: System can load XMLTV data from .xml and .xml.gz formats
- FR10: System can parse XMLTV and extract channel names, IDs, logos, and program data
- FR11: User can configure scheduled EPG refresh time (daily)
- FR12: System can refresh EPG data automatically at scheduled time
- FR13: System can merge EPG data from multiple XMLTV sources

### Channel Matching

- FR14: System can perform fuzzy matching to associate Xtream streams with XMLTV channels. XMLTV channels are the primary channel list that defines what appears in Plex (channel names, numbers, icons, and EPG data)
- FR15: System can display match confidence scores for each channel pairing
- FR16: System can auto-match channels above confidence threshold
- FR17: User can manually override channel matches via search dropdown
- FR18: System can detect when Xtream channel list has changed
- FR19: System can automatically re-match channels when provider updates list
- FR20: User can trigger manual re-scan of channels

### Channel Management

- FR21: User can view all XMLTV channels with their matched Xtream stream status. The Channels view shows XMLTV channels as the primary list, with indicators showing which Xtream streams are matched to each
- FR22: User can enable or disable individual channels
- FR23: User can reorder channels via drag-and-drop
- FR24: User can bulk-enable or bulk-disable channels
- FR25: System can remember channel order and enabled state across restarts
- FR26: Unmatched channels default to disabled
- FR26a: User can view all channels from all sources (XMLTV and Xtream) in the Channels tab, with icons indicating source type and match relationships. The XMLTV channel list defines the Plex lineup; Xtream streams are the video sources matched to those channels

### Stream Handling

- FR27: System can proxy stream requests from Plex to Xtream provider
- FR28: System can select highest available quality tier for each stream
- FR29: System can detect stream failures at connection time AND during active streaming (connection drops, errors, stalls, zero throughput)
- FR30: System can automatically failover to next quality tier on failure, both at connection and mid-stream
- FR31: Once failed over, system remains on backup source for the duration of the stream session (next stream request will attempt primary fresh)
- FR32: System can handle multiple concurrent streams up to tuner limit
- FR33: Plex remains unaware of quality switches and failovers

### Plex Integration

- FR34: System can serve M3U playlist endpoint
- FR35: System can serve XMLTV/EPG endpoint
- FR36: System can emulate HDHomeRun tuner for Plex discovery
- FR37: User can view M3U and EPG URLs for Plex configuration
- FR38: System can report correct tuner count to Plex

### EPG Viewer

- FR39: User can browse EPG data within the application
- FR40: User can search EPG by program title, channel name, or description
- FR41: User can view program details (title, description, time, channel)
- FR42: User can navigate EPG by time (now, tonight, tomorrow, week view)

### Configuration & Settings

- FR43: User can configure all settings via GUI (no config files required)
- FR44: User can configure local server port
- FR45: User can configure auto-start on system boot
- FR46: User can configure EPG refresh schedule
- FR47: User can export/import configuration for backup

### Logging & Diagnostics

- FR48: System can log events (connections, failures, failovers, matches)
- FR49: User can view event log in GUI
- FR50: System can display notification badge for unread events
- FR51: User can clear event log
- FR52: System can log with configurable verbosity levels

### Updates

- FR53: System can check for application updates
- FR54: User can download and install updates from within app
- FR55: System can preserve all settings across updates

---

## Non-Functional Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| **Stream Start Time** | <3 seconds from Plex play to video |
| **Failover Time** | <2 seconds to switch quality tiers |
| **Channel Scan** | <60 seconds for 1000 channels |
| **EPG Load** | <30 seconds for 7-day guide |
| **GUI Responsiveness** | <100ms for user interactions |
| **Memory Usage** | <200MB RAM during normal operation |
| **CPU Usage** | <5% CPU when idle, <15% when streaming |

### Reliability

| Requirement | Target |
|-------------|--------|
| **Uptime** | Continuous operation for weeks without restart |
| **Crash Recovery** | Auto-restart on crash, preserve state |
| **Data Integrity** | No data loss on unexpected shutdown |
| **Failover Success** | >99% of stream failures recovered (including mid-stream) |

### Compatibility

| Requirement | Target |
|-------------|--------|
| **Plex Versions** | 3 latest major versions minimum |
| **Xtream API** | Standard Xtream Codes API v1 |
| **XMLTV Format** | XMLTV 0.5+ specification |
| **Network** | IPv4 required, IPv6 optional |

### Usability

| Requirement | Target |
|-------------|--------|
| **Setup Time** | <10 minutes for complete setup |
| **Learning Curve** | Usable without documentation |
| **Error Messages** | Clear, actionable error messages |
| **Accessibility** | Standard OS accessibility support |

### Security

| Requirement | Implementation |
|-------------|----------------|
| **Credential Storage** | Encrypted local storage (OS keychain where available) |
| **Network** | Local-only endpoints (no external exposure by default) |
| **Updates** | Signed update packages |

---

## Constraints & Assumptions

### Constraints

- **Single User:** Personal tool, no multi-user support needed
- **Local Network:** Endpoints serve localhost only (no remote access in MVP)
- **Xtream API Dependency:** Relies on Xtream Codes API availability and format stability
- **XMLTV Quality:** EPG accuracy depends on XMLTV source quality

### Assumptions

- User has valid Xtream Codes subscription
- User has access to XMLTV EPG source for their region
- User has Plex Media Server running on same network
- User has basic technical comfort (can add tuner to Plex)

### Dependencies

- Xtream Codes provider API availability
- XMLTV source availability
- Plex Media Server HDHomeRun tuner support

---

## Glossary

| Term | Definition |
|------|------------|
| **Xtream Codes** | IPTV panel system used by providers to manage and serve streams |
| **XMLTV** | XML-based format for TV program listings (EPG data) |
| **EPG** | Electronic Program Guide - TV schedule data |
| **M3U** | Playlist format commonly used for IPTV channel lists |
| **HDHomeRun** | Network TV tuner that Plex supports natively |
| **Fuzzy Matching** | Approximate string matching to pair channels with EPG data |
| **Failover** | Automatic switching to backup stream when primary fails |
| **Quality Tier** | Different stream qualities (HD, SD, etc.) for same channel |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-18 | Javier | Initial PRD creation |
| 1.1 | 2026-01-19 | Bob (SM) | Course correction: Updated FR14, FR21, added FR26a to clarify XMLTV channels as primary for Plex lineup |
| 1.2 | 2026-01-21 | Bob (SM) | Course correction: Updated FR29, FR30, FR31 for mid-stream failover; clarified NFR11 |
