# Story 1.1: Initialize Tauri Project with React Frontend

Status: ready-for-dev

## Story

As a developer,
I want a properly scaffolded Tauri 2.0 project with React frontend,
So that I have a solid foundation for building the cross-platform application.

## Acceptance Criteria

1. **Given** a new development environment
   **When** I run the project initialization commands
   **Then** a Tauri 2.0 project is created with:
   - Rust backend in `src-tauri/`
   - React 18 + TypeScript frontend in `src/`
   - Vite build configuration
   - Tailwind CSS configured
   - Basic Tauri IPC commands working
   **And** the app builds and runs on the current platform
   **And** the dev server supports hot module replacement

## Tasks / Subtasks

- [ ] Task 1: Initialize Tauri 2.0 project with React + TypeScript template (AC: #1)
  - [ ] 1.1 Run `npm create tauri-app@latest` with project name "iptv"
  - [ ] 1.2 Select TypeScript as the language
  - [ ] 1.3 Select React as the UI template
  - [ ] 1.4 Select pnpm as the package manager (per architecture decision)
  - [ ] 1.5 Verify identifier is set to `com.iptv.app`

- [ ] Task 2: Configure Tailwind CSS with Vite plugin (AC: #1)
  - [ ] 2.1 Install Tailwind CSS and Vite plugin: `pnpm add -D tailwindcss @tailwindcss/vite`
  - [ ] 2.2 Update `vite.config.ts` to include Tailwind plugin
  - [ ] 2.3 Update `src/index.css` with `@import "tailwindcss";`
  - [ ] 2.4 Remove unnecessary `App.css` file (Tailwind handles all styling)

- [ ] Task 3: Set up Cargo workspace and Rust dependencies (AC: #1)
  - [ ] 3.1 Verify `src-tauri/Cargo.toml` has correct Tauri 2.x dependencies
  - [ ] 3.2 Add essential Rust dependencies for the project foundation:
    - `tokio` with full features (async runtime)
    - `serde` and `serde_json` (serialization)
    - `thiserror` (error handling)
  - [ ] 3.3 Configure edition = "2021" and resolver = "2"

- [ ] Task 4: Create basic Tauri IPC command structure (AC: #1)
  - [ ] 4.1 Create `src-tauri/src/commands/mod.rs` module
  - [ ] 4.2 Implement a simple `greet` command to verify IPC works
  - [ ] 4.3 Register command in `main.rs` using `invoke_handler`
  - [ ] 4.4 Create TypeScript helper in `src/lib/tauri.ts` for typed invoke

- [ ] Task 5: Verify frontend-backend communication (AC: #1)
  - [ ] 5.1 Call the `greet` command from React component
  - [ ] 5.2 Display result in UI to confirm IPC bridge works
  - [ ] 5.3 Verify hot module replacement works by making UI change

- [ ] Task 6: Build and run verification (AC: #1)
  - [ ] 6.1 Run `pnpm tauri dev` and verify app launches
  - [ ] 6.2 Run `pnpm tauri build` and verify binary is created
  - [ ] 6.3 Verify the app window shows React content
  - [ ] 6.4 Test on current platform (macOS)

## Dev Notes

### Architecture Compliance

This story establishes the foundation specified in the Architecture document:
- **Framework**: Tauri 2.0 (currently at v2.9.5 stable)
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with Vite plugin
- **Package Manager**: pnpm (per monorepo decision)
- **Rust Edition**: 2021

### Critical Technical Requirements

**Tauri 2.0 Specific:**
- Use `@tauri-apps/api` v2.x for frontend bindings
- IPC commands use `#[tauri::command]` attribute macro
- Commands are registered via `.invoke_handler(tauri::generate_handler![...])`
- Tauri 2.0 uses event-driven architecture for async operations

**Vite + Tailwind CSS (2026 Best Practice):**
- Use the dedicated `@tailwindcss/vite` plugin (NOT PostCSS approach)
- Import Tailwind in CSS with `@import "tailwindcss";`
- No `tailwind.config.js` needed for basic setup (v4 uses CSS-first config)

**Project Structure Must Match:**
```
iptv/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   ├── lib.rs               # Library root
│   │   └── commands/            # Tauri commands
│   │       └── mod.rs
│   └── icons/                   # App icons
├── src/
│   ├── main.tsx                 # React entry
│   ├── App.tsx                  # Root component
│   ├── index.css                # Tailwind imports
│   └── lib/
│       └── tauri.ts             # Typed IPC helpers
├── package.json
├── tsconfig.json
├── vite.config.ts
└── pnpm-lock.yaml
```

### Rust Dependencies (Cargo.toml)

```toml
[package]
name = "iptv"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = [] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  clearScreen: false,
  server: {
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome105', 'safari15'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
```

### Tauri IPC Example

**Rust side (`src-tauri/src/commands/mod.rs`):**
```rust
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to iptv.", name)
}
```

**TypeScript side (`src/lib/tauri.ts`):**
```typescript
import { invoke } from '@tauri-apps/api/core';

export async function greet(name: string): Promise<string> {
  return invoke('greet', { name });
}
```

### Project Structure Notes

- This is a greenfield project - no existing code to integrate
- Structure aligns with Architecture document Section "Project Structure"
- Future stories will add: `db/`, `xtream/`, `xmltv/`, `matcher/`, `proxy/`, `server/`, `scheduler/` modules
- Frontend will add: `components/`, `hooks/`, `stores/` directories in later stories

### Testing Notes

- Basic build verification only for this story
- Unit testing frameworks (Vitest, cargo test) will be configured in subsequent stories
- E2E testing (Playwright) will be added in a later story

### References

- [Source: architecture.md#Technology Stack] - Tauri 2.0, React 18, TypeScript, Tailwind, Vite
- [Source: architecture.md#Project Structure] - Directory layout
- [Source: architecture.md#Decision Log] - Framework choices and rationale
- [Source: epics.md#Story 1.1] - Original acceptance criteria
- [Source: prd.md#Desktop Application Requirements] - Platform support requirements

### Latest Technical Information (2026)

**Tauri 2.0:**
- Current stable: v2.9.5
- Supports desktop (Windows, macOS, Linux) and mobile (iOS, Android)
- Uses native OS web renderer (~600KB app size minimum)
- Official scaffolding: `npm create tauri-app@latest`
- [Tauri 2.0 Release](https://v2.tauri.app/blog/tauri-20/)

**Tailwind CSS (v4):**
- Use `@tailwindcss/vite` plugin (NOT PostCSS method)
- CSS-first configuration: `@import "tailwindcss";`
- No separate config file needed for basic setup
- [Tailwind Vite Guide](https://tailwindcss.com/docs/guides/vite)

**Diesel ORM (for future stories):**
- Current version: 2.2.x
- Install CLI: `cargo install diesel_cli --no-default-features --features sqlite`
- Use `sqlite-bundled` feature for static linking
- [Diesel Getting Started](https://diesel.rs/guides/getting-started)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
