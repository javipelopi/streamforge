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

### Definition of Done (Quality Gates)

These are the commands that must pass before work is merged:

- **build_command**: `cd src-tauri && cargo build`
- **test_command**: `cd src-tauri && cargo test -- --skip server::stream::tests`
- **typecheck_command**: `pnpm exec tsc --noEmit`
- **lint_command**: `pnpm lint`
- **setup_command**: `pnpm install --frozen-lockfile`

When dispatching formulas (refinery patrol, polecat work, etc.), pass these as `--var` overrides.
The `server::stream::tests` are skipped because they hang in CI due to a tokio runtime deadlock.
