/**
 * Build Verification Fixture for Story 5.9
 *
 * Provides utilities for running build commands and verifying compilation status.
 * Used in build-verification.spec.ts to test build system integrity after cleanup.
 *
 * Pattern: Pure function → Fixture wrapper (from fixture-architecture.md)
 */

import { test as base } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// Pure function: Build runner helper
export interface BuildResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
  duration: number;
}

export async function runBuildCommand(
  command: string,
  cwd: string,
  timeout: number = 120000
): Promise<BuildResult> {
  const startTime = Date.now();
  let exitCode = 0;
  let stdout = '';
  let stderr = '';

  try {
    const result = await execAsync(command, {
      cwd,
      timeout,
      env: { ...process.env },
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error: any) {
    exitCode = error.code || 1;
    stdout = error.stdout || '';
    stderr = error.stderr || '';
  }

  const duration = Date.now() - startTime;

  return {
    exitCode,
    stdout,
    stderr,
    success: exitCode === 0,
    duration,
  };
}

// Pure function: TypeScript compilation check
export async function checkTypeScriptCompilation(projectRoot: string): Promise<BuildResult> {
  return runBuildCommand('npx tsc --noEmit', projectRoot, 60000);
}

// Pure function: Production build check
export async function runProductionBuild(projectRoot: string): Promise<BuildResult> {
  return runBuildCommand('pnpm build', projectRoot, 120000);
}

// Pure function: Lint check
export async function runLintCheck(projectRoot: string): Promise<BuildResult> {
  return runBuildCommand('pnpm lint', projectRoot, 60000);
}

// Pure function: Test suite check (unit tests only)
export async function runTestSuite(projectRoot: string): Promise<BuildResult> {
  return runBuildCommand('pnpm test:unit --run', projectRoot, 60000);
}

// Fixture wrapper
type BuildVerificationFixtures = {
  buildRunner: {
    runBuild: () => Promise<BuildResult>;
    checkTypeScript: () => Promise<BuildResult>;
    runLint: () => Promise<BuildResult>;
    runTests: () => Promise<BuildResult>;
  };
};

export const test = base.extend<BuildVerificationFixtures>({
  buildRunner: async ({}, use) => {
    const projectRoot = path.resolve(__dirname, '../../..');

    // Provide build runner utilities
    await use({
      runBuild: () => runProductionBuild(projectRoot),
      checkTypeScript: () => checkTypeScriptCompilation(projectRoot),
      runLint: () => runLintCheck(projectRoot),
      runTests: () => runTestSuite(projectRoot),
    });

    // No cleanup needed (read-only operations)
  },
});

export { expect } from '@playwright/test';
