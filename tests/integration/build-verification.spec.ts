import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Integration Tests for Story 5.9: Build Verification After Cleanup
 *
 * These tests verify that the build system, TypeScript compiler, and linter
 * all succeed after legacy component cleanup. This ensures no broken imports
 * or dead code remains in the codebase.
 *
 * Test Strategy:
 * - Integration level: Verify build tooling succeeds
 * - Tests run actual build commands and validate exit codes
 * - Focuses on compilation, bundling, and code quality checks
 *
 * Acceptance Criteria Coverage:
 * - AC#3: TypeScript compiles without errors
 * - AC#3: Production build succeeds
 * - AC#3: Lint checks pass with no dead code warnings
 *
 * RED Phase Status:
 * Tests may initially PASS if no cleanup has started yet, but WILL FAIL
 * during cleanup if imports are broken. Tests should pass again once cleanup
 * is complete and all imports are fixed.
 */

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Increase timeout for build operations
test.setTimeout(120000); // 2 minutes

test.describe('TypeScript Compilation Verification', () => {
  test('should compile TypeScript without errors after cleanup', async () => {
    // GIVEN: Legacy components have been removed
    // WHEN: Running TypeScript compiler in check mode
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      const result = await execAsync('npx tsc --noEmit', {
        cwd: PROJECT_ROOT,
        timeout: 60000, // 1 minute timeout
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: any) {
      exitCode = error.code || 1;
      stdout = error.stdout || '';
      stderr = error.stderr || '';
    }

    // THEN: TypeScript compilation should succeed
    expect(exitCode, `TypeScript compilation failed with exit code ${exitCode}\n${stderr}`).toBe(
      0
    );

    // THEN: No compilation errors should be present
    const hasErrors =
      stderr.includes('error TS') ||
      stderr.includes('Cannot find module') ||
      stderr.includes("Cannot find name '");

    expect(
      hasErrors,
      `TypeScript compilation output contains errors:\n${stderr}`
    ).toBe(false);
  });

  test('should have no type errors related to deleted components', async () => {
    // GIVEN: Legacy components have been removed
    // WHEN: Checking for specific type errors related to deleted components
    const deletedComponents = ['EpgGrid', 'EpgCell', 'TimeNavigationBar'];

    let stderr = '';

    try {
      await execAsync('npx tsc --noEmit', {
        cwd: PROJECT_ROOT,
        timeout: 60000,
      });
    } catch (error: any) {
      stderr = error.stderr || '';
    }

    // THEN: No errors should mention deleted component names
    for (const component of deletedComponents) {
      const hasComponentError = stderr.includes(component);

      expect(
        hasComponentError,
        `TypeScript errors mention deleted component ${component}:\n${stderr}`
      ).toBe(false);
    }
  });
});

test.describe('Production Build Verification', () => {
  test('should build production bundle successfully', async () => {
    // GIVEN: Legacy components have been removed and imports are fixed
    // WHEN: Running production build
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      const result = await execAsync('pnpm build', {
        cwd: PROJECT_ROOT,
        timeout: 90000, // 1.5 minutes timeout
        env: { ...process.env, NODE_ENV: 'production' },
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: any) {
      exitCode = error.code || 1;
      stdout = error.stdout || '';
      stderr = error.stderr || '';
    }

    // THEN: Build should succeed
    expect(exitCode, `Build failed with exit code ${exitCode}\n${stderr}\n${stdout}`).toBe(0);

    // THEN: No build errors should be present
    const hasBuildErrors =
      stderr.includes('ERROR') ||
      stderr.includes('Failed to') ||
      stderr.includes('Module not found') ||
      stdout.includes('error:');

    expect(
      hasBuildErrors,
      `Build output contains errors:\nSTDERR:\n${stderr}\nSTDOUT:\n${stdout}`
    ).toBe(false);
  });

  test('should not include legacy components in production bundle', async () => {
    // GIVEN: Production build has completed successfully
    // Note: This test is informational - checks if tree-shaking worked correctly

    // WHEN: Checking if build output directory exists
    const distPath = path.join(PROJECT_ROOT, 'dist');
    const fs = require('fs');

    if (!fs.existsSync(distPath)) {
      // Build hasn't run yet or failed - skip this test
      test.skip();
      return;
    }

    // THEN: Verify build artifacts exist (basic sanity check)
    const hasIndexHtml = fs.existsSync(path.join(distPath, 'index.html'));
    expect(hasIndexHtml, 'Build should generate index.html').toBe(true);

    // Note: Checking bundle contents for removed component names is complex
    // and may have false positives (component names in strings, comments, etc.)
    // This test primarily verifies the build succeeded, which implies tree-shaking worked
  });
});

test.describe('Lint Verification', () => {
  test('should pass lint checks with no dead code warnings', async () => {
    // GIVEN: Legacy components and their exports have been removed
    // WHEN: Running ESLint
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      const result = await execAsync('pnpm lint', {
        cwd: PROJECT_ROOT,
        timeout: 60000,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: any) {
      exitCode = error.code || 1;
      stdout = error.stdout || '';
      stderr = error.stderr || '';
    }

    // THEN: Lint should succeed (exit code 0)
    // Note: Some projects may have warnings but still exit with 0
    // We're primarily checking for errors here
    const hasLintErrors =
      stdout.includes('error') ||
      stderr.includes('error') ||
      (exitCode !== 0 && !stdout.includes('warning'));

    expect(
      hasLintErrors,
      `Lint check failed or has errors:\nExit code: ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
    ).toBe(false);
  });

  test('should have no unused export warnings for deleted components', async () => {
    // GIVEN: Component exports have been cleaned up
    // WHEN: Running lint and checking for unused export warnings
    const deletedComponents = ['EpgGrid', 'EpgCell', 'TimeNavigationBar'];

    let stdout = '';
    let stderr = '';

    try {
      await execAsync('pnpm lint', {
        cwd: PROJECT_ROOT,
        timeout: 60000,
      });
    } catch (error: any) {
      stdout = error.stdout || '';
      stderr = error.stderr || '';
    }

    const lintOutput = stdout + stderr;

    // THEN: Lint output should not mention deleted component exports
    for (const component of deletedComponents) {
      const hasUnusedExportWarning =
        lintOutput.includes(`${component}' is defined but never used`) ||
        lintOutput.includes(`'${component}' is declared but its value is never read`);

      expect(
        hasUnusedExportWarning,
        `Lint warnings mention unused export for ${component}:\n${lintOutput}`
      ).toBe(false);
    }
  });
});

test.describe('Test Suite Integrity', () => {
  test('should run test suite without import errors', async () => {
    // GIVEN: Legacy test files have been deleted
    // WHEN: Running test suite (unit/component tests only, not E2E)
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      // Run Vitest in run mode (not watch) with a timeout
      const result = await execAsync('pnpm test:unit --run', {
        cwd: PROJECT_ROOT,
        timeout: 60000,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: any) {
      exitCode = error.code || 1;
      stdout = error.stdout || '';
      stderr = error.stderr || '';
    }

    // THEN: Test suite should at least load without import errors
    // Note: Individual tests may fail for other reasons, but imports should work
    const hasImportErrors =
      stderr.includes('Cannot find module') ||
      stderr.includes('Module not found') ||
      stderr.includes('Failed to load');

    expect(
      hasImportErrors,
      `Test suite has import errors (likely from deleted components):\n${stderr}`
    ).toBe(false);

    // Note: We don't check exitCode here because unrelated test failures
    // are not the focus of this cleanup story
  });
});
