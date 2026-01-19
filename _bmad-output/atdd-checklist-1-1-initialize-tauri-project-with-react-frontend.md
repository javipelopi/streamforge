# ATDD Checklist - Epic 1, Story 1.1: Initialize Tauri Project with React Frontend

**Date:** 2026-01-19
**Author:** Javier
**Primary Test Level:** E2E (Integration/Verification Tests)

---

## Story Summary

Initialize a greenfield Tauri 2.0 project with React 18 + TypeScript frontend, Vite build system, and Tailwind CSS styling. This establishes the foundation for building a cross-platform IPTV Plex integration desktop application.

**As a** developer
**I want** a properly scaffolded Tauri 2.0 project with React frontend
**So that** I have a solid foundation for building the cross-platform application

---

## Acceptance Criteria

1. **Given** a new development environment **When** I run the project initialization commands **Then** a Tauri 2.0 project is created with:
   - Rust backend in `src-tauri/`
   - React 18 + TypeScript frontend in `src/`
   - Vite build configuration
   - Tailwind CSS configured
   - Basic Tauri IPC commands working
   **And** the app builds and runs on the current platform
   **And** the dev server supports hot module replacement

---

## Failing Tests Created (RED Phase)

### E2E Tests (18 tests)

**File:** `tests/e2e/tauri-initialization.spec.ts` (383 lines)

These are verification tests that validate the project structure and configuration. All tests will FAIL initially because the Tauri project does not exist yet.

- ✅ **Test:** should have complete Tauri 2.0 project structure
  - **Status:** RED - Directories do not exist yet
  - **Verifies:** Project directories are created correctly

- ✅ **Test:** should have Rust backend with correct structure
  - **Status:** RED - Rust files do not exist yet
  - **Verifies:** Tauri backend files are present

- ✅ **Test:** should have correct Cargo.toml dependencies
  - **Status:** RED - Cargo.toml does not exist yet
  - **Verifies:** Required Rust dependencies (tauri, tokio, serde, thiserror) are configured

- ✅ **Test:** should have React 18 frontend with TypeScript
  - **Status:** RED - Frontend files do not exist yet
  - **Verifies:** React + TypeScript structure is present

- ✅ **Test:** should have package.json with correct dependencies
  - **Status:** RED - package.json does not exist yet
  - **Verifies:** React 18, @tauri-apps/api, TypeScript, and Vite are installed

- ✅ **Test:** should have TypeScript configuration
  - **Status:** RED - tsconfig.json does not exist yet
  - **Verifies:** TypeScript is properly configured

- ✅ **Test:** should have Vite configuration with React plugin
  - **Status:** RED - vite.config.ts does not exist yet
  - **Verifies:** Vite is configured with React plugin and Tauri environment variables

- ✅ **Test:** should have Tailwind CSS configured with Vite plugin
  - **Status:** RED - Tailwind dependencies not installed yet
  - **Verifies:** Tailwind CSS is installed with @tailwindcss/vite plugin

- ✅ **Test:** should have Tailwind imported in index.css
  - **Status:** RED - index.css does not exist yet
  - **Verifies:** Tailwind v4 syntax (`@import "tailwindcss"`) is used

- ✅ **Test:** should NOT have App.css file (Tailwind handles styling)
  - **Status:** RED - Will pass once App.css is removed
  - **Verifies:** App.css is removed per architecture requirements

- ✅ **Test:** should have greet command implemented in Rust
  - **Status:** RED - commands/mod.rs does not exist yet
  - **Verifies:** Tauri IPC command is implemented in Rust

- ✅ **Test:** should have greet command registered in main.rs
  - **Status:** RED - main.rs does not exist yet
  - **Verifies:** Command is registered in Tauri's invoke_handler

- ✅ **Test:** should have TypeScript helper for greet command
  - **Status:** RED - lib/tauri.ts does not exist yet
  - **Verifies:** Typed wrapper for IPC command exists in frontend

- ✅ **Test:** should call greet command from React component
  - **Status:** RED - App.tsx does not exist yet
  - **Verifies:** Frontend-backend IPC communication is demonstrated

- ✅ **Test:** should have pnpm as package manager
  - **Status:** RED - pnpm-lock.yaml does not exist yet
  - **Verifies:** pnpm is used (not npm or yarn)

- ✅ **Test:** should have tauri.conf.json with correct identifier
  - **Status:** RED - tauri.conf.json does not exist yet
  - **Verifies:** App identifier is set to `com.iptv.app`

- ✅ **Test:** should compile Rust backend without errors
  - **Status:** RED - Rust code does not exist yet
  - **Verifies:** `cargo check` passes without errors

- ✅ **Test:** should build frontend without TypeScript errors
  - **Status:** RED - Frontend code does not exist yet
  - **Verifies:** `pnpm exec tsc --noEmit` passes without errors

---

## Data Factories Created

**Note:** This story does not require data factories as it's focused on project scaffolding and verification. No test data generation is needed for structural tests.

---

## Fixtures Created

**Note:** This story does not require custom fixtures as all tests are synchronous file system checks and compilation verifications using Node.js built-in modules (`fs`, `child_process`).

---

## Mock Requirements

**Note:** No external services need mocking for this story. All tests verify local file system state and run local build commands.

---

## Required data-testid Attributes

**Note:** This story establishes the project foundation. Future stories will add UI components with `data-testid` attributes. This story only verifies that the basic `greet` command is called from the React component, which doesn't require test IDs yet.

---

## Implementation Checklist

### Test Group 1: Initialize Tauri 2.0 Project

**File:** `tests/e2e/tauri-initialization.spec.ts` (lines 1-75)

**Tasks to make these tests pass:**

- [ ] Run `npm create tauri-app@latest` with project name "iptv"
- [ ] Select TypeScript as the language
- [ ] Select React as the UI template
- [ ] Select pnpm as the package manager
- [ ] Verify identifier is set to `com.iptv.app` in `tauri.conf.json`
- [ ] Verify all core directories exist: `src-tauri/`, `src-tauri/src/`, `src/`, `src/lib/`
- [ ] Run tests: `pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts -g "structure|backend"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Test Group 2: Configure Tailwind CSS

**File:** `tests/e2e/tauri-initialization.spec.ts` (lines 150-191)

**Tasks to make these tests pass:**

- [ ] Install Tailwind CSS: `pnpm add -D tailwindcss @tailwindcss/vite`
- [ ] Update `vite.config.ts` to import and use `@tailwindcss/vite` plugin
- [ ] Update `src/index.css` with `@import "tailwindcss";` (v4 syntax)
- [ ] Remove `src/App.css` file (Tailwind handles all styling)
- [ ] Remove any imports of `App.css` from `App.tsx`
- [ ] Run tests: `pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts -g "Tailwind"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 0.25 hours

---

### Test Group 3: Set Up Rust Dependencies

**File:** `tests/e2e/tauri-initialization.spec.ts` (lines 76-93)

**Tasks to make these tests pass:**

- [ ] Open `src-tauri/Cargo.toml`
- [ ] Verify Tauri 2.x dependencies are present (should be auto-configured)
- [ ] Add `tokio = { version = "1", features = ["full"] }`
- [ ] Add `serde = { version = "1", features = ["derive"] }`
- [ ] Add `serde_json = "1"`
- [ ] Add `thiserror = "1"`
- [ ] Set `edition = "2021"` in `[package]` section
- [ ] Run `cargo check` in `src-tauri/` directory to verify
- [ ] Run test: `pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts -g "Cargo.toml"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test Group 4: Create Tauri IPC Command Structure

**File:** `tests/e2e/tauri-initialization.spec.ts` (lines 193-236)

**Tasks to make these tests pass:**

- [ ] Create `src-tauri/src/commands/mod.rs` file
- [ ] Implement `greet` command with `#[tauri::command]` attribute:
  ```rust
  #[tauri::command]
  pub fn greet(name: &str) -> String {
      format!("Hello, {}! Welcome to iptv.", name)
  }
  ```
- [ ] Open `src-tauri/src/main.rs`
- [ ] Add `mod commands;` at the top
- [ ] Register command using `.invoke_handler(tauri::generate_handler![commands::greet])`
- [ ] Create `src/lib/tauri.ts` file with TypeScript helper:
  ```typescript
  import { invoke } from '@tauri-apps/api/core';

  export async function greet(name: string): Promise<string> {
    return invoke('greet', { name });
  }
  ```
- [ ] Run tests: `pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts -g "greet command"`
- [ ] ✅ Tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Test Group 5: Verify Frontend-Backend Communication

**File:** `tests/e2e/tauri-initialization.spec.ts` (lines 238-250)

**Tasks to make these tests pass:**

- [ ] Open `src/App.tsx`
- [ ] Import the `greet` function: `import { greet } from './lib/tauri';`
- [ ] Call `greet` command in a React component (e.g., button click handler or useEffect)
- [ ] Display result in UI to verify IPC bridge works
- [ ] Test hot module replacement by making a UI change and verifying it appears without restart
- [ ] Run test: `pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts -g "call greet"`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test Group 6: Build and Run Verification

**File:** `tests/e2e/tauri-initialization.spec.ts` (lines 252-328)

**Tasks to make these tests pass:**

- [ ] Verify `pnpm-lock.yaml` exists (pnpm is used, not npm/yarn)
- [ ] Verify no `package-lock.json` or `yarn.lock` files exist
- [ ] Open `tauri.conf.json` and set `identifier` to `"com.iptv.app"`
- [ ] Run `cargo check` in `src-tauri/` to verify Rust compiles
- [ ] Run `pnpm exec tsc --noEmit` to verify TypeScript compiles
- [ ] Verify `package.json` has `dev` and `build` scripts
- [ ] Run `pnpm tauri dev` and verify app launches (manual verification)
- [ ] Run `pnpm tauri build` and verify binary is created (manual verification on macOS)
- [ ] Run all tests: `pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts`
- [ ] ✅ All 18 tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Install Playwright first (if not already installed)
pnpm add -D @playwright/test

# Initialize Playwright
pnpm exec playwright install

# Run all failing tests for this story
pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts

# Run specific test group
pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts -g "structure"
pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts -g "Tailwind"
pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts -g "greet command"

# Run tests in headed mode (see browser - not applicable for these file system tests)
# These tests don't launch browsers, they check file system state

# Debug specific test with Playwright inspector
pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts -g "Cargo.toml" --debug

# Run tests with verbose output
pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts --reporter=list
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All 18 tests written and failing
- ✅ Tests cover all acceptance criteria
- ✅ No fixtures or factories needed (structural tests)
- ✅ No mock requirements (local file system checks)
- ✅ Implementation checklist created with clear tasks

**Verification:**

- All tests will fail with "file does not exist" or "directory does not exist" errors
- This is expected - the Tauri project hasn't been initialized yet
- Tests are deterministic and atomic (one check per test)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with Task Group 1** - Initialize Tauri project
   - Run `npm create tauri-app@latest` with correct options
   - Verify basic structure is created
   - Run corresponding tests to see them turn green

2. **Work through Task Groups 2-6 sequentially**
   - Each group is independent and can be completed in order
   - Configure Tailwind CSS
   - Add Rust dependencies
   - Implement IPC commands
   - Connect frontend to backend
   - Verify build process

3. **Run tests after each task group**
   - See immediate feedback as tests turn green
   - Fix any issues before moving to next group

**Key Principles:**

- Follow the checklist in order (dependencies between groups)
- Run tests frequently (after each task group)
- All commands are provided in the checklist (no guessing)
- Copy-paste code examples from story dev notes if needed

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Mark story as IN PROGRESS in sprint-status.yaml

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

Since this is project scaffolding, refactoring opportunities are minimal:

1. **Review generated code quality**
   - Ensure Rust code follows idiomatic patterns
   - Check TypeScript types are correctly defined
   - Verify no unused imports or dead code

2. **Verify configuration consistency**
   - Ensure all config files use consistent formatting
   - Check that identifiers match across files

3. **Ensure tests still pass** after any cleanup

**Completion:**

- All 18 tests pass
- Project structure matches architecture document
- Code is clean and ready for next story
- Ready for commit and story approval

---

## Next Steps

1. **Install Playwright** (test framework): `pnpm add -D @playwright/test && pnpm exec playwright install`
2. **Run failing tests** to confirm RED phase: `pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts`
3. **Expect all tests to fail** - this is correct! The Tauri project doesn't exist yet
4. **Begin implementation** using Task Group 1 (Initialize Tauri project)
5. **Work through checklist** groups 1-6 in order
6. **Run tests after each group** to see progress
7. **When all tests pass**, commit changes and mark story as done in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** - Deterministic test patterns (no hard waits, explicit checks, atomic tests)
- **test-levels-framework.md** - E2E test level selection for integration/verification scenarios
- **data-factories.md** - Not applicable (no test data needed for structural tests)
- **fixture-architecture.md** - Not applicable (using Node.js built-in modules for file checks)
- **network-first.md** - Not applicable (no network calls in these tests)

This story uses **verification tests** (E2E level) because we're testing the integration of multiple tools (Tauri CLI, Vite, TypeScript, Rust compiler) and verifying they work together correctly. These are not pure unit tests (no isolated functions) and not UI tests (no browser automation).

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts`

**Expected Results:**

```
Running 18 tests using 1 worker

  ✗ Story 1.1: Tauri Project Initialization › should have complete Tauri 2.0 project structure (Xms)
    Error: ENOENT: no such file or directory, access '/Users/javiersanchez/Development/iptv/src-tauri'

  ✗ Story 1.1: Tauri Project Initialization › should have Rust backend with correct structure (Xms)
    Error: ENOENT: no such file or directory, access '/Users/javiersanchez/Development/iptv/src-tauri/Cargo.toml'

  ✗ Story 1.1: Tauri Project Initialization › should have correct Cargo.toml dependencies (Xms)
    Error: ENOENT: no such file or directory, open '/Users/javiersanchez/Development/iptv/src-tauri/Cargo.toml'

  [... 15 more failures ...]

  18 failed
    Story 1.1: Tauri Project Initialization › should have complete Tauri 2.0 project structure
    Story 1.1: Tauri Project Initialization › should have Rust backend with correct structure
    Story 1.1: Tauri Project Initialization › should have correct Cargo.toml dependencies
    Story 1.1: Tauri Project Initialization › should have React 18 frontend with TypeScript
    Story 1.1: Tauri Project Initialization › should have package.json with correct dependencies
    Story 1.1: Tauri Project Initialization › should have TypeScript configuration
    Story 1.1: Tauri Project Initialization › should have Vite configuration with React plugin
    Story 1.1: Tauri Project Initialization › should have Tailwind CSS configured with Vite plugin
    Story 1.1: Tauri Project Initialization › should have Tailwind imported in index.css
    Story 1.1: Tauri Project Initialization › should NOT have App.css file
    Story 1.1: Tauri Project Initialization › should have greet command implemented in Rust
    Story 1.1: Tauri Project Initialization › should have greet command registered in main.rs
    Story 1.1: Tauri Project Initialization › should have TypeScript helper for greet command
    Story 1.1: Tauri Project Initialization › should call greet command from React component
    Story 1.1: Tauri Project Initialization › should have pnpm as package manager
    Story 1.1: Tauri Project Initialization › should have tauri.conf.json with correct identifier
    Story 1.1: Tauri Project Initialization › should compile Rust backend without errors
    Story 1.1: Tauri Project Initialization › should build frontend without TypeScript errors
```

**Summary:**

- Total tests: 18
- Passing: 0 (expected)
- Failing: 18 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

All tests will fail with file/directory not found errors because the Tauri project structure does not exist yet. This is the correct RED phase state. Tests will turn green as you implement each task group.

---

## Notes

### Special Considerations for This Story

- **Greenfield project**: No existing code to integrate or refactor
- **Scaffolding focus**: Tests verify project structure, not runtime behavior
- **Manual verification needed**: While tests verify files exist and compile, you should manually run `pnpm tauri dev` to see the app window and verify IPC communication works end-to-end
- **Platform-specific**: Build verification will run on macOS first (per story requirements)

### Why E2E Test Level?

This story uses E2E-level tests (not unit tests) because we're verifying the **integration** of multiple tools:
- Tauri CLI scaffolding
- Rust compiler (cargo)
- TypeScript compiler (tsc)
- Vite bundler
- Tailwind CSS plugin
- IPC bridge between Rust and JavaScript

These are integration/verification tests that ensure all pieces work together correctly.

### Future Testing

- **Unit tests** (Vitest for TypeScript, cargo test for Rust) will be added in subsequent stories
- **Component tests** (Playwright Component Testing) will be added when UI components are built
- **True E2E tests** (browser automation) will be added when user-facing features are implemented

---

## Contact

**Questions or Issues?**

- Review the story file: `_bmad-output/implementation-artifacts/1-1-initialize-tauri-project-with-react-frontend.md`
- Check architecture decisions: `_bmad-output/planning-artifacts/architecture.md`
- Consult Tauri 2.0 documentation: https://v2.tauri.app/
- Ask in team standup or tag @TEA in Slack

---

**Generated by BMad TEA Agent** - 2026-01-19
