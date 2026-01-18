/**
 * E2E Test: Tauri Project Initialization
 * Story: 1-1 - Initialize Tauri Project with React Frontend
 *
 * RED Phase - These tests MUST FAIL initially
 * Test creation date: 2026-01-19
 */

import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

test.describe('Story 1.1: Tauri Project Initialization', () => {
  /**
   * AC1: Tauri 2.0 project structure is created correctly
   */
  test('should have complete Tauri 2.0 project structure', async () => {
    // GIVEN: Project root directory exists
    expect(existsSync(PROJECT_ROOT)).toBe(true);

    // WHEN: Checking directory structure
    const requiredDirs = [
      'src-tauri',
      'src-tauri/src',
      'src-tauri/src/commands',
      'src-tauri/icons',
      'src',
      'src/lib',
    ];

    // THEN: All required directories exist
    for (const dir of requiredDirs) {
      const dirPath = join(PROJECT_ROOT, dir);
      expect(existsSync(dirPath)).toBe(true);
    }
  });

  test('should have Rust backend with correct structure', async () => {
    // GIVEN: Tauri backend directory exists
    const tauriDir = join(PROJECT_ROOT, 'src-tauri');

    // WHEN: Checking Rust files
    const requiredFiles = [
      'Cargo.toml',
      'tauri.conf.json',
      'src/main.rs',
      'src/lib.rs',
      'src/commands/mod.rs',
    ];

    // THEN: All required Rust files exist
    for (const file of requiredFiles) {
      const filePath = join(tauriDir, file);
      expect(existsSync(filePath)).toBe(true);
    }
  });

  test('should have correct Cargo.toml dependencies', async () => {
    // GIVEN: Cargo.toml exists
    const cargoTomlPath = join(PROJECT_ROOT, 'src-tauri/Cargo.toml');
    const cargoToml = readFileSync(cargoTomlPath, 'utf-8');

    // WHEN: Parsing dependencies
    // THEN: Required Rust dependencies are present
    expect(cargoToml).toContain('tauri');
    expect(cargoToml).toContain('tokio');
    expect(cargoToml).toContain('serde');
    expect(cargoToml).toContain('serde_json');
    expect(cargoToml).toContain('thiserror');
    expect(cargoToml).toContain('edition = "2021"');
  });

  /**
   * AC1: React 18 + TypeScript frontend is configured
   */
  test('should have React 18 frontend with TypeScript', async () => {
    // GIVEN: Frontend directory exists
    const srcDir = join(PROJECT_ROOT, 'src');

    // WHEN: Checking React files
    const requiredFiles = [
      'main.tsx',
      'App.tsx',
      'index.css',
      'lib/tauri.ts',
    ];

    // THEN: All required frontend files exist
    for (const file of requiredFiles) {
      const filePath = join(srcDir, file);
      expect(existsSync(filePath)).toBe(true);
    }
  });

  test('should have package.json with correct dependencies', async () => {
    // GIVEN: package.json exists
    const packageJsonPath = join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    // WHEN: Checking dependencies
    // THEN: Required packages are present
    expect(packageJson.dependencies).toHaveProperty('react');
    expect(packageJson.dependencies.react).toMatch(/^18\./);
    expect(packageJson.dependencies).toHaveProperty('@tauri-apps/api');
    expect(packageJson.devDependencies).toHaveProperty('typescript');
    expect(packageJson.devDependencies).toHaveProperty('vite');
  });

  test('should have TypeScript configuration', async () => {
    // GIVEN: TypeScript config exists
    const tsconfigPath = join(PROJECT_ROOT, 'tsconfig.json');

    // WHEN: Checking configuration file
    // THEN: tsconfig.json exists and is valid JSON
    expect(existsSync(tsconfigPath)).toBe(true);
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
    expect(tsconfig).toHaveProperty('compilerOptions');
  });

  /**
   * AC1: Vite build configuration is present
   */
  test('should have Vite configuration with React plugin', async () => {
    // GIVEN: Vite config exists
    const viteConfigPath = join(PROJECT_ROOT, 'vite.config.ts');
    const viteConfig = readFileSync(viteConfigPath, 'utf-8');

    // WHEN: Checking configuration
    // THEN: Vite is configured with React plugin
    expect(viteConfig).toContain('@vitejs/plugin-react');
    expect(viteConfig).toContain('defineConfig');
    expect(viteConfig).toContain('TAURI_');
  });

  /**
   * AC1: Tailwind CSS is configured
   */
  test('should have Tailwind CSS configured with Vite plugin', async () => {
    // GIVEN: Package.json and configs exist
    const packageJsonPath = join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const viteConfigPath = join(PROJECT_ROOT, 'vite.config.ts');
    const viteConfig = readFileSync(viteConfigPath, 'utf-8');

    // WHEN: Checking Tailwind setup
    // THEN: Tailwind dependencies and plugin are present
    expect(packageJson.devDependencies).toHaveProperty('tailwindcss');
    expect(packageJson.devDependencies).toHaveProperty('@tailwindcss/vite');
    expect(viteConfig).toContain('tailwindcss');
    expect(viteConfig).toContain('@tailwindcss/vite');
  });

  test('should have Tailwind imported in index.css', async () => {
    // GIVEN: index.css exists
    const indexCssPath = join(PROJECT_ROOT, 'src/index.css');
    const indexCss = readFileSync(indexCssPath, 'utf-8');

    // WHEN: Checking CSS imports
    // THEN: Tailwind is imported using v4 syntax
    expect(indexCss).toContain('@import "tailwindcss"');
  });

  test('should NOT have App.css file (Tailwind handles styling)', async () => {
    // GIVEN: Source directory exists
    const appCssPath = join(PROJECT_ROOT, 'src/App.css');

    // WHEN: Checking for App.css
    // THEN: App.css should not exist (removed per story requirements)
    expect(existsSync(appCssPath)).toBe(false);
  });

  /**
   * AC1: Basic Tauri IPC commands are working
   */
  test('should have greet command implemented in Rust', async () => {
    // GIVEN: Commands module exists
    const commandsModPath = join(PROJECT_ROOT, 'src-tauri/src/commands/mod.rs');
    const commandsMod = readFileSync(commandsModPath, 'utf-8');

    // WHEN: Checking command implementation
    // THEN: greet command is defined
    expect(commandsMod).toContain('#[tauri::command]');
    expect(commandsMod).toContain('pub fn greet');
    expect(commandsMod).toContain('-> String');
  });

  test('should have greet command registered in main.rs', async () => {
    // GIVEN: main.rs exists
    const mainRsPath = join(PROJECT_ROOT, 'src-tauri/src/main.rs');
    const mainRs = readFileSync(mainRsPath, 'utf-8');

    // WHEN: Checking command registration
    // THEN: greet command is registered with invoke_handler
    expect(mainRs).toContain('invoke_handler');
    expect(mainRs).toContain('greet');
  });

  test('should have TypeScript helper for greet command', async () => {
    // GIVEN: Tauri helper file exists
    const tauriTsPath = join(PROJECT_ROOT, 'src/lib/tauri.ts');
    const tauriTs = readFileSync(tauriTsPath, 'utf-8');

    // WHEN: Checking TypeScript wrapper
    // THEN: greet function is exported with proper typing
    expect(tauriTs).toContain('export');
    expect(tauriTs).toContain('greet');
    expect(tauriTs).toContain('invoke');
    expect(tauriTs).toContain('@tauri-apps/api/core');
    expect(tauriTs).toContain('Promise<string>');
  });

  /**
   * AC1: Frontend-backend communication verification
   */
  test('should call greet command from React component', async () => {
    // GIVEN: App.tsx exists
    const appTsxPath = join(PROJECT_ROOT, 'src/App.tsx');
    const appTsx = readFileSync(appTsxPath, 'utf-8');

    // WHEN: Checking component usage
    // THEN: greet command is called from React
    expect(appTsx).toContain('greet');
    expect(appTsx).toContain('from');
    expect(appTsx).toContain('./lib/tauri');
  });

  /**
   * AC1: Build verification
   */
  test('should have pnpm as package manager', async () => {
    // GIVEN: Project root exists
    const pnpmLockPath = join(PROJECT_ROOT, 'pnpm-lock.yaml');

    // WHEN: Checking for pnpm lock file
    // THEN: pnpm-lock.yaml exists (not npm or yarn)
    expect(existsSync(pnpmLockPath)).toBe(true);

    // AND: npm lock files should NOT exist
    expect(existsSync(join(PROJECT_ROOT, 'package-lock.json'))).toBe(false);
    expect(existsSync(join(PROJECT_ROOT, 'yarn.lock'))).toBe(false);
  });

  test('should have tauri.conf.json with correct identifier', async () => {
    // GIVEN: Tauri config exists
    const tauriConfPath = join(PROJECT_ROOT, 'src-tauri/tauri.conf.json');
    const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf-8'));

    // WHEN: Checking app identifier
    // THEN: Identifier is set to com.iptv.app
    expect(tauriConf.identifier).toBe('com.iptv.app');
  });

  /**
   * AC1: Project builds successfully
   * Note: This is a compilation test, not a runtime test
   */
  test('should compile Rust backend without errors', async () => {
    // GIVEN: Tauri project exists
    const tauriDir = join(PROJECT_ROOT, 'src-tauri');
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const cargoPath = join(homeDir, '.cargo', 'bin', 'cargo');

    // WHEN: Running cargo check
    // THEN: Cargo check passes without errors
    expect(() => {
      execSync(`${cargoPath} check`, {
        cwd: tauriDir,
        stdio: 'pipe',
        timeout: 120000, // 120 second timeout
        env: { ...process.env, PATH: `${join(homeDir, '.cargo', 'bin')}:${process.env.PATH}` }
      });
    }).not.toThrow();
  });

  test('should build frontend without TypeScript errors', async () => {
    // GIVEN: Frontend exists
    // WHEN: Running TypeScript check
    // THEN: tsc compiles without errors
    expect(() => {
      execSync('pnpm exec tsc --noEmit', {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
        timeout: 30000 // 30 second timeout
      });
    }).not.toThrow();
  });

  /**
   * AC1: Dev server configuration
   */
  test('should have dev scripts configured in package.json', async () => {
    // GIVEN: package.json exists
    const packageJsonPath = join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    // WHEN: Checking scripts
    // THEN: Required dev and build scripts exist
    expect(packageJson.scripts).toHaveProperty('dev');
    expect(packageJson.scripts).toHaveProperty('build');
    expect(packageJson.scripts.dev).toContain('tauri dev');
    expect(packageJson.scripts.build).toContain('tauri build');
  });
});
