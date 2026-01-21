# StreamForge

<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" alt="StreamForge Logo" width="128" height="128">
</p>

A cross-platform desktop application that bridges Xtream Codes IPTV services to Plex Media Server via HDHomeRun emulation.

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Xtream Codes   │────▶│   StreamForge   │────▶│   Plex Server   │
│  IPTV Provider  │     │  (HDHomeRun     │     │   (Live TV)     │
│                 │     │   Emulation)    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
   Xtream API            Local HTTP Server        DVR Recording
   - Channels            - /discover.json         Channel Guide
   - EPG Data            - /lineup.json           Live Streaming
   - Streams             - /lineup_status.json
```

StreamForge acts as a bridge between your Xtream Codes IPTV provider and Plex Media Server. It emulates an HDHomeRun network tuner, allowing Plex to discover and use your IPTV channels as if they were coming from a physical TV tuner.

## Features

- **Direct Xtream Codes API Integration** - Connect directly to your IPTV provider's API for superior stream management
- **HDHomeRun Emulation** - Appears as a tuner device to Plex for seamless Live TV integration
- **Automatic Channel Matching** - Intelligently matches IPTV streams to EPG channels
- **Quality-Based Stream Selection** - Automatically select HD, FHD, or 4K streams based on availability
- **Multiple Provider Support** - Manage multiple Xtream Codes accounts
- **System Tray Integration** - Runs quietly in the background

## Tech Stack

- **Backend**: Rust + Tauri 2.0 + Axum + Diesel/SQLite
- **Frontend**: React 18 + TypeScript + Tailwind + Zustand
- **Testing**: Playwright

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [pnpm](https://pnpm.io/)
- [FFmpeg](https://ffmpeg.org/) - Required for stream processing

#### Installing FFmpeg

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Windows (Chocolatey):**
```bash
choco install ffmpeg
```

**Windows (Scoop):**
```bash
scoop install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install ffmpeg
```

**Linux (Fedora):**
```bash
sudo dnf install ffmpeg
```

Verify installation with `ffmpeg -version`.

### Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build
```

### Testing

```bash
# Run all Playwright tests (E2E + component tests)
pnpm test

# Run integration tests only
pnpm test:integration

# Run Rust backend tests
pnpm test:rust
```

## Configuration

### Xtream Codes Setup

1. Launch StreamForge
2. Navigate to **Sources** → **Xtream** tab
3. Enter your provider credentials:
   - **Server URL**: Your provider's server address (e.g., `http://provider.example.com`)
   - **Username**: Your Xtream Codes username
   - **Password**: Your Xtream Codes password
4. Click **Connect** to validate and import channels

### Plex Integration

1. Ensure StreamForge is running and the HDHomeRun server is active
2. In Plex, go to **Settings** → **Live TV & DVR**
3. Click **Set Up Plex DVR** - Plex should auto-discover StreamForge as an HDHomeRun device
4. Complete the Plex DVR setup wizard

### Data Storage

StreamForge stores its data in the platform-specific application data directory:
- **macOS**: `~/Library/Application Support/com.streamforge.app/`
- **Windows**: `%APPDATA%\com.streamforge.app\`
- **Linux**: `~/.local/share/com.streamforge.app/`

## License

Proprietary - All rights reserved. See [LICENSE](LICENSE) for details.
