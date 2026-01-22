import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Integration Tests for Story 5.9: EPG Legacy Component Cleanup
 *
 * These tests verify that legacy EPG components have been properly removed
 * from the codebase after the TV-style EPG implementation (Stories 5.4-5.8).
 *
 * Test Strategy:
 * - Integration level: Verify file system state and codebase integrity
 * - Given-When-Then format for clarity
 * - Tests verify ABSENCE of components (negative testing)
 * - Focuses on cleanup completeness
 *
 * Acceptance Criteria Coverage:
 * - AC#1: Legacy components deleted from filesystem
 * - AC#1: Legacy test files deleted
 * - AC#1: Placeholder components deleted
 * - AC#3: No imports reference deleted components
 *
 * RED Phase Status:
 * All tests should FAIL initially because legacy files still exist
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

test.describe('Legacy Component Cleanup Verification', () => {
  test('should verify legacy EPG components are deleted from filesystem', async () => {
    // GIVEN: Legacy EPG components should have been removed
    const legacyComponentFiles = [
      'src/components/epg/EpgGrid.tsx',
      'src/components/epg/EpgCell.tsx',
      'src/components/epg/TimeNavigationBar.tsx',
    ];

    // WHEN: Checking if files exist on filesystem
    // THEN: All legacy component files should NOT exist
    for (const filePath of legacyComponentFiles) {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      const fileExists = fs.existsSync(fullPath);

      expect(fileExists, `Legacy file ${filePath} should be deleted but still exists`).toBe(false);
    }
  });

  test('should verify legacy test files are deleted from test directories', async () => {
    // GIVEN: Legacy test files should have been removed
    const legacyTestFiles = [
      'tests/e2e/epg-grid.spec.ts',
      'tests/component/epg-grid.test.tsx',
      'tests/support/fixtures/epg-grid.fixture.ts',
    ];

    // WHEN: Checking if test files exist
    // THEN: All legacy test files should NOT exist
    for (const filePath of legacyTestFiles) {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      const fileExists = fs.existsSync(fullPath);

      expect(fileExists, `Legacy test file ${filePath} should be deleted but still exists`).toBe(
        false
      );
    }
  });

  test('should verify placeholder components are deleted', async () => {
    // GIVEN: Placeholder components should have been removed after real implementations
    const placeholderFiles = [
      'src/components/epg/tv-style/EpgChannelListPlaceholder.tsx',
      'src/components/epg/tv-style/EpgSchedulePanelPlaceholder.tsx',
      'src/components/epg/tv-style/EpgDetailsPanelPlaceholder.tsx',
    ];

    // WHEN: Checking if placeholder files exist
    // THEN: All placeholder files should NOT exist
    for (const filePath of placeholderFiles) {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      const fileExists = fs.existsSync(fullPath);

      // Note: Some placeholders may never have existed, which is acceptable
      if (fileExists) {
        expect(
          fileExists,
          `Placeholder file ${filePath} should be deleted but still exists`
        ).toBe(false);
      }
    }
  });

  test('should verify no imports reference deleted components', async () => {
    // GIVEN: Codebase should have no imports to deleted components
    const srcPath = path.join(PROJECT_ROOT, 'src');
    const deletedComponents = ['EpgGrid', 'EpgCell', 'TimeNavigationBar'];

    // WHEN: Searching for imports to deleted components
    const foundImports: { component: string; file: string; line: string }[] = [];

    // Helper function to recursively search files
    function searchDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
          searchDirectory(fullPath);
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
        ) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            for (const component of deletedComponents) {
              // Match import statements containing the component name
              if (
                line.includes('import') &&
                (line.includes(`{${component}}`) ||
                  line.includes(`{ ${component}`) ||
                  line.includes(`${component} }`) ||
                  line.includes(`{ ${component} }`))
              ) {
                const relativePath = path.relative(PROJECT_ROOT, fullPath);
                foundImports.push({
                  component,
                  file: relativePath,
                  line: `Line ${index + 1}: ${line.trim()}`,
                });
              }
            }
          });
        }
      }
    }

    searchDirectory(srcPath);

    // THEN: No imports should reference deleted components
    expect(
      foundImports,
      `Found ${foundImports.length} import(s) to deleted components:\n` +
        foundImports.map((imp) => `  - ${imp.file}: ${imp.component} (${imp.line})`).join('\n')
    ).toHaveLength(0);
  });

  test('should verify component index exports are updated', async () => {
    // GIVEN: Component index files should not export deleted components
    const indexFilePath = path.join(PROJECT_ROOT, 'src/components/epg/index.ts');
    const deletedExports = ['EpgGrid', 'EpgCell', 'TimeNavigationBar'];

    // WHEN: Reading the index file
    const indexFileExists = fs.existsSync(indexFilePath);
    expect(indexFileExists, 'Index file should exist').toBe(true);

    const indexContent = fs.readFileSync(indexFilePath, 'utf-8');

    // THEN: Index should not export deleted components
    for (const component of deletedExports) {
      const hasExport =
        indexContent.includes(`export { ${component}`) ||
        indexContent.includes(`export {${component}`) ||
        indexContent.includes(`${component} }`) ||
        indexContent.includes(`export * from './${component}`);

      expect(
        hasExport,
        `Index file should not export ${component}, but found export statement`
      ).toBe(false);
    }

    // THEN: Index should still export non-deleted components
    const expectedExports = ['EpgSourcesList', 'EpgSourceDialog'];

    for (const component of expectedExports) {
      const hasExport =
        indexContent.includes(`export { ${component}`) ||
        indexContent.includes(`export {${component}`) ||
        indexContent.includes(`${component} }`);

      expect(
        hasExport,
        `Index file should still export ${component} (not a legacy component)`
      ).toBe(true);
    }
  });

  test('should verify tv-style index does not export placeholders', async () => {
    // GIVEN: TV-style index should not export placeholder components
    const tvStyleIndexPath = path.join(
      PROJECT_ROOT,
      'src/components/epg/tv-style/index.ts'
    );
    const placeholderExports = [
      'EpgChannelListPlaceholder',
      'EpgSchedulePanelPlaceholder',
      'EpgDetailsPanelPlaceholder',
    ];

    // WHEN: Reading the tv-style index file
    const indexFileExists = fs.existsSync(tvStyleIndexPath);

    if (indexFileExists) {
      const indexContent = fs.readFileSync(tvStyleIndexPath, 'utf-8');

      // THEN: Index should not export placeholder components
      for (const placeholder of placeholderExports) {
        const hasExport =
          indexContent.includes(`export { ${placeholder}`) ||
          indexContent.includes(`export {${placeholder}`) ||
          indexContent.includes(`${placeholder} }`) ||
          indexContent.includes(`export * from './${placeholder}`);

        expect(
          hasExport,
          `TV-style index should not export ${placeholder}, but found export statement`
        ).toBe(false);
      }
    } else {
      // If tv-style index doesn't exist, that's acceptable (may use wildcard exports)
      expect(true).toBe(true);
    }
  });
});

test.describe('Codebase Integrity After Cleanup', () => {
  test('should verify no dead hooks reference deleted components', async () => {
    // GIVEN: Hooks directory should not import deleted components
    const hooksPath = path.join(PROJECT_ROOT, 'src/hooks');
    const deletedComponents = ['EpgGrid', 'EpgCell', 'TimeNavigationBar'];

    // WHEN: Searching hooks for imports
    const foundImports: { hook: string; component: string }[] = [];

    if (fs.existsSync(hooksPath)) {
      const hookFiles = fs
        .readdirSync(hooksPath)
        .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

      for (const hookFile of hookFiles) {
        const fullPath = path.join(hooksPath, hookFile);
        const content = fs.readFileSync(fullPath, 'utf-8');

        for (const component of deletedComponents) {
          if (content.includes(component)) {
            foundImports.push({ hook: hookFile, component });
          }
        }
      }
    }

    // THEN: No hooks should reference deleted components
    expect(
      foundImports,
      `Found ${foundImports.length} hook(s) referencing deleted components:\n` +
        foundImports.map((imp) => `  - ${imp.hook} references ${imp.component}`).join('\n')
    ).toHaveLength(0);
  });

  test('should verify EPG view does not import legacy components', async () => {
    // GIVEN: Main EPG view should only use TV-style components
    const epgViewPath = path.join(PROJECT_ROOT, 'src/views/EPG.tsx');
    const deletedComponents = ['EpgGrid', 'EpgCell', 'TimeNavigationBar'];

    // WHEN: Reading the EPG view file
    if (fs.existsSync(epgViewPath)) {
      const viewContent = fs.readFileSync(epgViewPath, 'utf-8');

      // THEN: View should not import or use deleted components
      for (const component of deletedComponents) {
        const referencesComponent = viewContent.includes(component);

        expect(
          referencesComponent,
          `EPG view should not reference ${component}, but found usage`
        ).toBe(false);
      }
    } else {
      // EPG view might not exist or might be renamed (e.g., EpgTv.tsx)
      // This is acceptable - the test will skip if file doesn't exist
      expect(true).toBe(true);
    }
  });

  test('should verify EpgTv view does not import legacy components', async () => {
    // GIVEN: EpgTv view (TV-style) should only use TV-style components
    const epgTvViewPath = path.join(PROJECT_ROOT, 'src/views/EpgTv.tsx');
    const deletedComponents = ['EpgGrid', 'EpgCell', 'TimeNavigationBar'];

    // WHEN: Reading the EpgTv view file
    if (fs.existsSync(epgTvViewPath)) {
      const viewContent = fs.readFileSync(epgTvViewPath, 'utf-8');

      // THEN: View should not import or use deleted components
      for (const component of deletedComponents) {
        const referencesComponent = viewContent.includes(component);

        expect(
          referencesComponent,
          `EpgTv view should not reference ${component}, but found usage`
        ).toBe(false);
      }
    } else {
      // EpgTv view should exist based on Story 5.4, but test gracefully if missing
      // This test will pass if file doesn't exist (no legacy imports possible)
      expect(true).toBe(true);
    }
  });
});
