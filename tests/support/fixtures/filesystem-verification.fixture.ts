/**
 * Filesystem Verification Fixture for Story 5.9
 *
 * Provides utilities for checking file existence, searching for patterns,
 * and verifying exports in the codebase. Used in legacy-component-cleanup.spec.ts
 * to verify legacy components have been properly removed.
 *
 * Pattern: Pure function → Fixture wrapper (from fixture-architecture.md)
 */

import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Pure function: Check if file exists
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// Pure function: Check if multiple files exist
export function filesExist(filePaths: string[]): { [key: string]: boolean } {
  const results: { [key: string]: boolean } = {};

  for (const filePath of filePaths) {
    results[filePath] = fs.existsSync(filePath);
  }

  return results;
}

// Pure function: Search for pattern in file
export function searchFileForPattern(filePath: string, pattern: string | RegExp): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (typeof pattern === 'string') {
    return content.includes(pattern);
  } else {
    return pattern.test(content);
  }
}

// Pure function: Search directory recursively for pattern
export interface SearchResult {
  file: string;
  line: number;
  content: string;
}

export function searchDirectoryForPattern(
  directory: string,
  pattern: string | RegExp,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']
): SearchResult[] {
  const results: SearchResult[] = [];

  function search(dir: string) {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules, dist, and hidden directories
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
          search(fullPath);
        }
      } else if (entry.isFile()) {
        // Check if file has matching extension
        const hasMatchingExtension = extensions.some((ext) => entry.name.endsWith(ext));

        if (hasMatchingExtension) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            const matches =
              typeof pattern === 'string' ? line.includes(pattern) : pattern.test(line);

            if (matches) {
              results.push({
                file: fullPath,
                line: index + 1,
                content: line.trim(),
              });
            }
          });
        }
      }
    }
  }

  search(directory);
  return results;
}

// Pure function: Check if exports exist in index file
export function checkExportsInIndex(
  indexFilePath: string,
  exportNames: string[]
): { [key: string]: boolean } {
  const results: { [key: string]: boolean } = {};

  if (!fs.existsSync(indexFilePath)) {
    // If index doesn't exist, no exports exist
    exportNames.forEach((name) => {
      results[name] = false;
    });
    return results;
  }

  const content = fs.readFileSync(indexFilePath, 'utf-8');

  for (const exportName of exportNames) {
    // Check for various export patterns
    const hasExport =
      content.includes(`export { ${exportName}`) ||
      content.includes(`export {${exportName}`) ||
      content.includes(`${exportName} }`) ||
      content.includes(`export * from './${exportName}`);

    results[exportName] = hasExport;
  }

  return results;
}

// Pure function: List all files in directory with extension filter
export function listFiles(
  directory: string,
  extensions: string[] = ['.ts', '.tsx']
): string[] {
  const files: string[] = [];

  function traverse(dir: string) {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath);
      } else if (entry.isFile()) {
        const hasMatchingExtension = extensions.some((ext) => entry.name.endsWith(ext));
        if (hasMatchingExtension) {
          files.push(fullPath);
        }
      }
    }
  }

  traverse(directory);
  return files;
}

// Fixture wrapper
type FilesystemVerificationFixtures = {
  filesystemChecker: {
    fileExists: (relativePath: string) => boolean;
    filesExist: (relativePaths: string[]) => { [key: string]: boolean };
    searchForPattern: (
      directory: string,
      pattern: string | RegExp
    ) => SearchResult[];
    checkExports: (indexPath: string, exportNames: string[]) => { [key: string]: boolean };
    listComponentFiles: (directory: string) => string[];
  };
};

export const test = base.extend<FilesystemVerificationFixtures>({
  filesystemChecker: async ({}, use) => {
    const projectRoot = path.resolve(__dirname, '../../..');

    // Provide filesystem checker utilities
    await use({
      fileExists: (relativePath: string) => {
        const fullPath = path.join(projectRoot, relativePath);
        return fileExists(fullPath);
      },

      filesExist: (relativePaths: string[]) => {
        const fullPaths = relativePaths.map((p) => path.join(projectRoot, p));
        return filesExist(fullPaths);
      },

      searchForPattern: (directory: string, pattern: string | RegExp) => {
        const fullDir = path.join(projectRoot, directory);
        return searchDirectoryForPattern(fullDir, pattern);
      },

      checkExports: (indexPath: string, exportNames: string[]) => {
        const fullPath = path.join(projectRoot, indexPath);
        return checkExportsInIndex(fullPath, exportNames);
      },

      listComponentFiles: (directory: string) => {
        const fullDir = path.join(projectRoot, directory);
        return listFiles(fullDir, ['.ts', '.tsx']);
      },
    });

    // No cleanup needed (read-only operations)
  },
});

export { expect } from '@playwright/test';
