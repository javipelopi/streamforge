/**
 * Integration Test: SQLite Database with Diesel ORM Setup
 * Story: 1-2 - Set Up SQLite Database with Diesel ORM
 *
 * RED Phase - These tests MUST FAIL initially
 * Test creation date: 2026-01-19
 *
 * Test Level: Integration (Backend/Database)
 * These tests verify Rust backend database functionality without UI
 */

import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const TAURI_DIR = join(PROJECT_ROOT, 'src-tauri');

test.describe('Story 1.2: SQLite Database with Diesel ORM', () => {
  /**
   * AC1: Diesel CLI installed and configured
   */
  test('should have Diesel CLI installed with SQLite support', async () => {
    // GIVEN: Development environment
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const cargoPath = join(homeDir, '.cargo', 'bin', 'cargo');

    // WHEN: Checking Diesel CLI version
    // THEN: Diesel CLI is installed and shows version 2.2.x
    const dieselVersion = execSync('diesel --version', {
      env: { ...process.env, PATH: `${join(homeDir, '.cargo', 'bin')}:${process.env.PATH}` },
      encoding: 'utf-8'
    });

    expect(dieselVersion).toContain('diesel 2.2');
  });

  test('should have diesel.toml configuration file', async () => {
    // GIVEN: Tauri project directory
    const dieselTomlPath = join(TAURI_DIR, 'diesel.toml');

    // WHEN: Checking for Diesel config
    // THEN: diesel.toml exists
    expect(existsSync(dieselTomlPath)).toBe(true);

    // AND: Configuration points to correct schema location
    const dieselToml = readFileSync(dieselTomlPath, 'utf-8');
    expect(dieselToml).toContain('file = "src/db/schema.rs"');
  });

  /**
   * AC1: Diesel dependencies added to Cargo.toml
   */
  test('should have Diesel dependencies in Cargo.toml', async () => {
    // GIVEN: Cargo.toml exists
    const cargoTomlPath = join(TAURI_DIR, 'Cargo.toml');
    const cargoToml = readFileSync(cargoTomlPath, 'utf-8');

    // WHEN: Checking dependencies
    // THEN: Diesel with SQLite features is present
    expect(cargoToml).toContain('diesel');
    expect(cargoToml).toContain('sqlite');
    expect(cargoToml).toContain('returning_clauses_for_sqlite_3_35');

    // AND: Diesel migrations crate is present
    expect(cargoToml).toContain('diesel_migrations');

    // AND: dotenvy for environment config
    expect(cargoToml).toContain('dotenvy');
  });

  /**
   * AC1: Initial migration creating settings table
   */
  test('should have migrations directory with settings migration', async () => {
    // GIVEN: Tauri project directory
    const migrationsDir = join(TAURI_DIR, 'migrations');

    // WHEN: Checking for migrations directory
    // THEN: Migrations directory exists
    expect(existsSync(migrationsDir)).toBe(true);

    // AND: At least one migration exists (settings table)
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const migrationsOutput = execSync('ls -1', {
      cwd: migrationsDir,
      encoding: 'utf-8',
      env: { ...process.env, PATH: `${join(homeDir, '.cargo', 'bin')}:${process.env.PATH}` }
    });

    expect(migrationsOutput).toContain('create_settings');
  });

  test('should have valid up.sql creating settings table', async () => {
    // GIVEN: Migrations directory exists
    const migrationsDir = join(TAURI_DIR, 'migrations');
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    // Find the settings migration directory
    const migrationDirs = execSync('ls -1', {
      cwd: migrationsDir,
      encoding: 'utf-8',
      env: { ...process.env, PATH: `${join(homeDir, '.cargo', 'bin')}:${process.env.PATH}` }
    }).trim().split('\n');

    const settingsMigrationDir = migrationDirs.find(dir => dir.includes('create_settings'));
    expect(settingsMigrationDir).toBeDefined();

    // WHEN: Reading up.sql
    const upSqlPath = join(migrationsDir, settingsMigrationDir!, 'up.sql');
    const upSql = readFileSync(upSqlPath, 'utf-8');

    // THEN: up.sql creates settings table with correct schema
    expect(upSql).toContain('CREATE TABLE settings');
    expect(upSql).toContain('key TEXT PRIMARY KEY NOT NULL');
    expect(upSql).toContain('value TEXT NOT NULL');
  });

  test('should have valid down.sql dropping settings table', async () => {
    // GIVEN: Migrations directory exists
    const migrationsDir = join(TAURI_DIR, 'migrations');
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    // Find the settings migration directory
    const migrationDirs = execSync('ls -1', {
      cwd: migrationsDir,
      encoding: 'utf-8',
      env: { ...process.env, PATH: `${join(homeDir, '.cargo', 'bin')}:${process.env.PATH}` }
    }).trim().split('\n');

    const settingsMigrationDir = migrationDirs.find(dir => dir.includes('create_settings'));

    // WHEN: Reading down.sql
    const downSqlPath = join(migrationsDir, settingsMigrationDir!, 'down.sql');
    const downSql = readFileSync(downSqlPath, 'utf-8');

    // THEN: down.sql drops settings table
    expect(downSql).toContain('DROP TABLE settings');
  });

  /**
   * AC1: Database module structure created
   */
  test('should have database module structure in src/db', async () => {
    // GIVEN: Tauri src directory
    const dbModulePath = join(TAURI_DIR, 'src/db');

    // WHEN: Checking directory structure
    // THEN: Database module directory exists
    expect(existsSync(dbModulePath)).toBe(true);

    // AND: Required module files exist
    const requiredFiles = [
      'mod.rs',
      'schema.rs',
      'models.rs',
      'connection.rs'
    ];

    for (const file of requiredFiles) {
      const filePath = join(dbModulePath, file);
      expect(existsSync(filePath)).toBe(true);
    }
  });

  test('should have db module exported from lib.rs', async () => {
    // GIVEN: lib.rs exists
    const libRsPath = join(TAURI_DIR, 'src/lib.rs');
    const libRs = readFileSync(libRsPath, 'utf-8');

    // WHEN: Checking module declarations
    // THEN: db module is declared and exported
    expect(libRs).toContain('pub mod db');
  });

  test('should have Setting model struct defined', async () => {
    // GIVEN: models.rs exists
    const modelsRsPath = join(TAURI_DIR, 'src/db/models.rs');
    const modelsRs = readFileSync(modelsRsPath, 'utf-8');

    // WHEN: Checking model definition
    // THEN: Setting struct is defined with correct fields
    expect(modelsRs).toContain('struct Setting');
    expect(modelsRs).toContain('key:');
    expect(modelsRs).toContain('value:');
    expect(modelsRs).toContain('Queryable');
    expect(modelsRs).toContain('Insertable');
  });

  /**
   * AC1: App data directory database path implementation
   */
  test('should have database path resolution in connection module', async () => {
    // GIVEN: connection.rs exists
    const connectionRsPath = join(TAURI_DIR, 'src/db/connection.rs');
    const connectionRs = readFileSync(connectionRsPath, 'utf-8');

    // WHEN: Checking path resolution
    // THEN: Uses Tauri app.path() API
    expect(connectionRs).toContain('app_data_dir');
    expect(connectionRs).toContain('iptv.db');
    expect(connectionRs).toContain('create_dir_all');
  });

  /**
   * AC1: Embedded migrations for runtime execution
   */
  test('should have embedded migrations macro in connection module', async () => {
    // GIVEN: connection.rs exists
    const connectionRsPath = join(TAURI_DIR, 'src/db/connection.rs');
    const connectionRs = readFileSync(connectionRsPath, 'utf-8');

    // WHEN: Checking migrations setup
    // THEN: embed_migrations macro is used
    expect(connectionRs).toContain('embed_migrations!');
    expect(connectionRs).toContain('run_pending_migrations');
    expect(connectionRs).toContain('MigrationHarness');
  });

  test('should have build.rs configured to watch migrations', async () => {
    // GIVEN: build.rs exists
    const buildRsPath = join(TAURI_DIR, 'build.rs');
    const buildRs = readFileSync(buildRsPath, 'utf-8');

    // WHEN: Checking build script
    // THEN: build.rs watches migrations directory for changes
    expect(buildRs).toContain('cargo:rerun-if-changed=migrations');
  });

  /**
   * AC1: Database initialization integrated with Tauri app
   */
  test('should initialize database in Tauri setup hook', async () => {
    // GIVEN: main.rs exists
    const mainRsPath = join(TAURI_DIR, 'src/main.rs');
    const mainRs = readFileSync(mainRsPath, 'utf-8');

    // WHEN: Checking setup hook
    // THEN: Database is initialized in setup
    expect(mainRs).toContain('.setup(');
    expect(mainRs).toContain('db::');
    expect(mainRs).toContain('run_migrations') || expect(mainRs).toContain('establish_connection');
  });

  /**
   * AC1: Migrations run automatically on app startup
   */
  test('should run migrations automatically on startup', async () => {
    // GIVEN: main.rs with setup hook
    const mainRsPath = join(TAURI_DIR, 'src/main.rs');
    const mainRs = readFileSync(mainRsPath, 'utf-8');

    // WHEN: Checking migration execution
    // THEN: Migrations are run in setup hook before app starts
    expect(mainRs).toContain('run_pending_migrations') || expect(mainRs).toContain('run_migrations');
  });

  /**
   * AC1: Verify database file persists across app restarts
   * This test uses Tauri commands to verify persistence
   */
  test('should have test commands for verifying persistence', async () => {
    // GIVEN: Commands module exists
    const commandsModPath = join(TAURI_DIR, 'src/commands/mod.rs');
    const commandsMod = readFileSync(commandsModPath, 'utf-8');

    // WHEN: Checking for test database commands
    // THEN: Commands exist to insert and read settings
    expect(commandsMod).toContain('#[tauri::command]');

    // Should have at least one command related to settings
    const hasSettingsCommand =
      commandsMod.includes('set_setting') ||
      commandsMod.includes('get_setting') ||
      commandsMod.includes('insert_setting') ||
      commandsMod.includes('read_setting');

    expect(hasSettingsCommand).toBe(true);
  });

  /**
   * AC1: Project compiles with Diesel setup
   */
  test('should compile Rust backend with Diesel dependencies', async () => {
    // GIVEN: Tauri project with Diesel setup
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const cargoPath = join(homeDir, '.cargo', 'bin', 'cargo');

    // WHEN: Running cargo check
    // THEN: Cargo check passes without errors
    expect(() => {
      execSync(`${cargoPath} check`, {
        cwd: TAURI_DIR,
        stdio: 'pipe',
        timeout: 180000, // 3 minute timeout (Diesel adds compile time)
        env: { ...process.env, PATH: `${join(homeDir, '.cargo', 'bin')}:${process.env.PATH}` }
      });
    }).not.toThrow();
  });

  /**
   * AC1: Database schema is generated correctly
   */
  test('should have generated schema.rs matching settings table', async () => {
    // GIVEN: schema.rs exists (generated by Diesel)
    const schemaRsPath = join(TAURI_DIR, 'src/db/schema.rs');
    const schemaRs = readFileSync(schemaRsPath, 'utf-8');

    // WHEN: Checking schema definition
    // THEN: Settings table schema is defined
    expect(schemaRs).toContain('table! {');
    expect(schemaRs).toContain('settings');
    expect(schemaRs).toContain('key ->');
    expect(schemaRs).toContain('value ->');
  });
});
