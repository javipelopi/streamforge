# IPTV Test Suite

This directory contains the test suite for the IPTV Plex integration application.

## Test Structure

```
tests/
├── e2e/                    # End-to-end tests
│   └── tauri-initialization.spec.ts  # Story 1-1 verification tests
├── api/                    # API/integration tests (future)
├── component/              # Component tests (future)
└── support/
    ├── fixtures/           # Test fixtures (future)
    ├── factories/          # Data factories (future)
    └── helpers/            # Utility functions (future)
```

## Running Tests

### Prerequisites

```bash
# Install dependencies (if not already installed)
pnpm install

# Install Playwright browsers
pnpm exec playwright install
```

### Execute Tests

```bash
# Run all tests
pnpm exec playwright test

# Run specific test file
pnpm exec playwright test tests/e2e/tauri-initialization.spec.ts

# Run with specific reporter
pnpm exec playwright test --reporter=list
pnpm exec playwright test --reporter=html

# Run in debug mode
pnpm exec playwright test --debug

# Run specific test by name
pnpm exec playwright test -g "should have complete Tauri 2.0 project structure"
```

## Test Framework

- **Playwright Test** - E2E testing framework
- **@types/node** - TypeScript types for Node.js APIs

## Current Test Coverage

### Story 1-1: Initialize Tauri Project with React Frontend

**File:** `tests/e2e/tauri-initialization.spec.ts`

**Status:** RED Phase (17 failing, 2 passing)

These tests verify the Tauri project structure and configuration. They will turn green as the implementation progresses.

**Test Categories:**
- Project structure verification (6 tests)
- Dependency configuration (5 tests)
- IPC command implementation (4 tests)
- Build configuration (4 tests)

## Test Principles

All tests follow these principles from the TEA knowledge base:

1. **Deterministic** - No hard waits, no conditionals, no random data
2. **Isolated** - Each test is independent and can run in parallel
3. **Explicit** - Assertions are clear and visible in test bodies
4. **Atomic** - One check per test (or one logical verification)
5. **Fast** - Tests execute quickly (file system checks, no browser launches)

## CI/CD Integration (Future)

Tests will be integrated into CI/CD pipeline in future stories:
- Run on every PR
- Block merges if tests fail
- Generate test reports
- Track test coverage

## Contributing

When adding new tests:

1. Follow the ATDD workflow (tests first, then implementation)
2. Use Given-When-Then structure in comments
3. Keep tests atomic (one verification per test)
4. Use descriptive test names
5. Refer to knowledge base fragments in `_bmad/bmm/testarch/knowledge/`

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [TEA Knowledge Base](_bmad/bmm/testarch/knowledge/)
- [ATDD Workflow](_bmad/bmm/workflows/testarch/atdd/)
- [Story Files](_bmad-output/implementation-artifacts/)
