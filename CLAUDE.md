# Project Instructions for Claude

## Git Preferences

- **Never squash commits** when merging PRs or branches
- Use regular merge commits to preserve full commit history
- When merging: `git merge --no-ff <branch>` (no fast-forward, no squash)

## Project: streamforge

Tauri 2.0 desktop app that bridges Xtream Codes IPTV to Plex via HDHomeRun emulation.

### Tech Stack
- **Backend**: Rust + Tauri 2.0 + Axum + Diesel/SQLite
- **Frontend**: React 18 + TypeScript + Tailwind + Zustand
- **Testing**: Playwright

### Key Paths
- Rust backend: `src-tauri/`
- React frontend: `src/`
- BMAD artifacts: `_bmad-output/`
- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
