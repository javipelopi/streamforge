---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
date: 2026-01-18
author: Javier
projectName: iptv
---

# Product Brief: iptv

## Executive Summary

**iptv** is a cross-platform application that bridges Xtream Codes IPTV services to Plex Media Server, serving as a modern, actively-maintained replacement for the defunct XTeVe project. Unlike XTeVe which only supports M3U playlists, iptv connects directly to the Xtream Codes API to leverage superior features: quality-based stream selection, automatic failover, multiple provider accounts, and timeshift/rewind capabilities.

The application provides intelligent channel matching using fuzzy search against XMLTV program guides, transparently handling the frequent channel list updates from Xtream providers without user intervention. It includes a built-in EPG viewer with search functionality, drag-and-drop channel management, and serves both M3U and EPG endpoints that Plex consumes as a standard HDHomeRun tuner.

**Target Platforms:** Windows, Linux, macOS, Android, Android TV, Apple TV

**Future Vision:** Direct channel playback within the application, evolving from a Plex bridge to a standalone IPTV experience.

---

## Core Vision

### Problem Statement

IPTV enthusiasts using Xtream Codes services have no reliable way to integrate their subscriptions with Plex Media Server. The existing solution (XTeVe) is unmaintained and only supports basic M3U playlists, missing the richer capabilities of the Xtream Codes API. Users are forced to choose between a degraded M3U experience or abandoning Plex integration entirely.

### Problem Impact

- **Manual channel matching breaks constantly** - Xtream providers frequently update channel names/IDs, requiring tedious re-configuration
- **No quality failover** - When a stream fails, users must manually switch; no automatic fallback to alternative quality tiers
- **Single provider limitation** - Cannot aggregate multiple Xtream accounts into a unified channel list
- **Lost features** - Timeshift/rewind, quality selection, and provider metadata are inaccessible via M3U export
- **No preview capability** - Users can't browse their EPG or search channels without going through Plex
- **Platform lock-in** - XTeVe is Windows-focused; no good options for Linux servers, mobile, or TV devices

### Why Existing Solutions Fall Short

**XTeVe:**
- Unmaintained (last update years ago)
- M3U-only - cannot use Xtream Codes API directly
- No intelligent channel matching or auto-rematch
- No quality-based stream selection or failover
- Single source only
- Limited platform support

**Direct Xtream Apps:**
- Don't integrate with Plex ecosystem
- Separate viewing experience from main media library
- Often poor quality or ad-laden

### Proposed Solution

A cross-platform application that:
1. Connects directly to Xtream Codes API (supporting multiple accounts)
2. Intelligently matches channels to XMLTV sources using fuzzy search
3. Automatically re-matches when providers update channel lists
4. Provides quality-prioritized streams with transparent failover
5. Serves M3U + EPG to Plex as HDHomeRun-compatible tuner
6. Includes built-in EPG viewer with search for channel discovery
7. Offers drag-and-drop channel management with enable/disable controls
8. Runs on Windows, Linux, macOS, Android, Android TV, and Apple TV
9. Architected for future direct video playback capability

### Key Differentiators

| Differentiator | Benefit |
|----------------|---------|
| **Native Xtream Codes API** | Access quality tiers, timeshift, metadata unavailable via M3U |
| **Transparent Fuzzy Matching** | Channels auto-rematch when providers update - zero maintenance |
| **Quality-Based Failover** | Stream interruptions handled automatically, Plex unaware |
| **Multi-Provider Aggregation** | Combine multiple Xtream accounts into unified experience |
| **Built-in EPG Viewer** | Preview and search your guide without leaving the app |
| **True Cross-Platform** | Same experience on desktop, mobile, and TV devices |
| **Future-Ready Architecture** | Designed for eventual standalone playback capability |
| **Active Development** | Modern, maintained alternative to abandoned XTeVe |

### Platform Strategy

| Platform | Primary Use Case |
|----------|------------------|
| **Windows/Linux/macOS** | Server mode (serving Plex) + GUI management |
| **Android/Android TV** | Mobile management + future direct playback |
| **Apple TV** | Future direct playback on big screen |

### Technology Considerations

Cross-platform requirement suggests frameworks like:
- **Flutter** - Single codebase for all platforms including TV
- **React Native + Electron** - Web tech across mobile and desktop
- **Tauri + mobile companion** - Rust core with platform-native UIs

Architecture should separate:
- **Core logic** (API, matching, stream handling) - shared across all platforms
- **Server component** (M3U/EPG serving) - runs on desktop/server platforms
- **UI layer** - platform-appropriate interfaces (desktop GUI, mobile, TV/remote navigation)

---

## Target Users

### Primary Users

#### Persona: "The Plex IPTV Enthusiast"

**Profile:**
- Runs a personal Plex Media Server (Windows or Docker)
- Subscribes to one or more Xtream Codes IPTV providers
- Technical enough to set up Plex, Docker, and networking
- Prefers polished GUI tools over command-line configuration
- Values reliability and "set it and forget it" solutions

**Name & Context:** Javier - A media enthusiast who has invested in building a comprehensive Plex setup for movies, TV shows, and music. Wants to add live TV to complete the experience without leaving the Plex ecosystem.

**Current Situation:**
- Has tried XTeVe but found it limiting (M3U only, unmaintained)
- Frustrated by manual channel matching that breaks when provider updates
- Wants the superior features of Xtream Codes API but no good Plex bridge exists
- Currently either uses a degraded M3U workflow or watches IPTV outside Plex

**Pain Points:**
- Constant re-configuration when Xtream provider changes channel names
- No automatic failover when streams fail mid-viewing
- Can't leverage Xtream quality tiers or timeshift features
- Separate apps for IPTV vs. everything else in Plex

**Success Vision:**
- Configure once, forget about it
- Channels auto-match and stay matched
- Stream failures handled transparently
- Full Xtream features accessible through Plex
- Beautiful GUI for the rare times configuration is needed

**Technical Comfort:**
- Comfortable with: Installing software, basic networking, Plex configuration
- Prefers to avoid: Config files, command-line tools, manual debugging
- Expectation: Modern, intuitive GUI that "just works"

### Secondary Users

**N/A for initial scope** - This is a personal tool. Future consideration: if released publicly, community users with varying technical levels and multi-provider setups.

### User Journey

| Stage | Experience |
|-------|------------|
| **Discovery** | Searches for "Xtream Codes Plex integration" or "XTeVe alternative 2026" |
| **Installation** | Downloads executable, runs installer, launches GUI |
| **Setup** | Enters Xtream credentials, adds XMLTV URL, clicks "Scan & Match" |
| **Configuration** | Reviews auto-matched channels, adjusts order via drag-drop, enables/disables as needed |
| **Plex Integration** | Adds the M3U/EPG URLs to Plex as HDHomeRun tuner |
| **Daily Use** | Watches live TV in Plex; app runs silently in background |
| **Maintenance** | Occasional check of EPG viewer; app handles provider changes automatically |
| **"Aha!" Moment** | First time a stream fails and automatically switches to backup quality without interruption |

---

## Success Metrics

### Core Success Criteria

This is a personal utility tool. Success is measured by **absence of friction**, not engagement metrics.

| Success Indicator | Target |
|-------------------|--------|
| **Automatic Channel Matching** | Fuzzy match succeeds without manual intervention on initial setup |
| **Transparent Failover** | Stream failures recover automatically; user unaware of switch |
| **Zero Maintenance** | No manual re-configuration needed when Xtream provider updates channels |
| **Set and Forget** | After initial setup, tool runs silently in background indefinitely |

### User Success Metrics

**"It's Working" Indicators:**
- Initial channel matching requires no manual corrections (or minimal tweaks)
- Plex sees the tuner and displays live TV without issues
- EPG data loads and displays correctly in Plex guide
- Watching TV "just works" - no buffering, no errors, no intervention

**"It's Really Working" Indicators:**
- Provider updates channel list → app auto-rematches → user never notices
- Stream fails mid-watch → failover kicks in → viewing continues uninterrupted
- Weeks pass without opening the app's GUI

### Failure Indicators

The tool has failed if:
- Manual channel matching is required frequently
- Stream failures interrupt viewing and require user action
- Configuration breaks when provider updates channels
- App requires regular restarts or maintenance
- User reverts to old workflow (M3U/XTeVe or separate IPTV app)

### Business Objectives

**N/A** - Personal tool with no commercial objectives.

### Key Performance Indicators

| KPI | Measurement | Target |
|-----|-------------|--------|
| **Match Accuracy** | % of XMLTV channels auto-matched correctly | > 95% |
| **Failover Success Rate** | % of stream failures recovered transparently | > 99% |
| **Uptime** | Hours of continuous operation without restart | Indefinite |
| **Manual Interventions** | Configuration changes required per month | 0 |

---

## MVP Scope

### Core Features

**Xtream Codes Integration:**
- Connect to Xtream Codes API (multiple accounts supported)
- Retrieve channel lists, quality tiers, and metadata
- Respect tuner count from subscription
- Timeshift/rewind passthrough (if supported by provider)

**XMLTV/EPG Management:**
- Support multiple XMLTV sources in parallel
- Support XML and gzipped formats (.xml, .xml.gz)
- Scheduled refresh at configurable daily time
- Use channel names and logos from XMLTV

**Intelligent Channel Matching:**
- Fuzzy search matching between Xtream channels and XMLTV
- Quality-prioritized channel list (multiple matches ranked by stream quality)
- Automatic re-matching when provider updates channel lists
- Generate fake 2-hour EPG for unmatched Xtream channels (disabled by default)

**Stream Handling:**
- Quality-based stream selection
- Transparent failover (retry same quality first, then fall to next tier)
- Plex remains unaware of stream switching

**Plex Integration:**
- Serve M3U playlist endpoint
- Serve EPG/XMLTV endpoint
- HDHomeRun tuner emulation
- Match tuner count to Xtream subscription

**Channel Management:**
- Enable/disable toggle per channel
- Drag-and-drop channel ordering
- Unmatched channels default to disabled

**User Interface:**
- Full GUI for all configuration (no config files required)
- Built-in EPG viewer with search functionality
- Channel list management view

**Platform Support:**
- Windows
- Linux
- macOS

### Out of Scope for MVP

| Feature | Rationale | Target Version |
|---------|-----------|----------------|
| **Mobile Apps** (Android, Android TV, Apple TV) | Desktop-first; mobile adds significant complexity | v2.0 |
| **Direct Video Playback** | Focus on Plex bridge first; playback requires video player integration | v2.0 |
| **Authentication for Endpoints** | Local network only for now; security can be added later | v1.1 |
| **Cloud Sync** | Personal tool; no need for cross-device sync initially | Future |

### MVP Success Criteria

The MVP is successful when:
- Initial setup completes in under 10 minutes
- Channel matching works automatically with >95% accuracy
- Plex displays live TV guide and plays channels without issues
- Stream failover works transparently during viewing
- App runs for weeks without manual intervention
- Timeshift works (if provider supports it)

### Future Vision

**v1.1 - Polish & Refinement:**
- Endpoint authentication option
- Improved matching algorithms based on real-world usage
- Performance optimizations

**v2.0 - Mobile & Playback:**
- Android / Android TV apps
- Apple TV app
- Direct video playback within the application
- Remote management from mobile devices

**v3.0 - Ecosystem:**
- Cloud configuration backup/sync
- Community channel mapping presets
- Plugin system for additional providers

