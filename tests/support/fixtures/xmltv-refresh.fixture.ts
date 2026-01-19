import { test as base } from '@playwright/test';
import { createServer, Server } from 'http';
import type { XmltvChannel } from '../factories/xmltv-channel.factory';
import type { Program } from '../factories/program.factory';
import { createXmltvXml, createXmltvXmlGz } from '../factories/xmltv-data.factory';

type XmltvRefreshApi = {
  refreshSource: (sourceId: number) => Promise<void>;
  refreshAll: () => Promise<void>;
  getStats: (sourceId: number) => Promise<{ channelCount: number; programCount: number; lastRefresh?: string }>;
};

type MockXmltvServer = {
  url: string;
  port: number;
  serveXml: (channels: XmltvChannel[], programs: Program[]) => void;
  serveXmlGz: (channels: XmltvChannel[], programs: Program[]) => void;
  serveError: (statusCode: number, message: string) => void;
  close: () => Promise<void>;
};

/**
 * Extended test fixture with XMLTV refresh API helpers and mock server
 */
export const test = base.extend<{
  xmltvRefreshApi: XmltvRefreshApi;
  mockXmltvServer: MockXmltvServer;
}>({
  xmltvRefreshApi: async ({ page }, use) => {
    const api: XmltvRefreshApi = {
      refreshSource: async (sourceId: number) => {
        const result = await page.evaluate(
          async (id) => {
            // @ts-expect-error - Tauri API not typed in test context
            return window.__TAURI__.invoke('refresh_epg_source', { sourceId: id });
          },
          sourceId
        );
        return result;
      },

      refreshAll: async () => {
        const result = await page.evaluate(async () => {
          // @ts-expect-error - Tauri API not typed in test context
          return window.__TAURI__.invoke('refresh_all_epg_sources');
        });
        return result;
      },

      getStats: async (sourceId: number) => {
        const result = await page.evaluate(
          async (id) => {
            // @ts-expect-error - Tauri API not typed in test context
            return window.__TAURI__.invoke('get_epg_stats', { sourceId: id });
          },
          sourceId
        );
        return result;
      },
    };

    await use(api);

    // Cleanup: no persistent state to clean in this fixture
  },

  mockXmltvServer: async ({}, use) => {
    let server: Server | null = null;
    let currentHandler: ((req: any, res: any) => void) | null = null;
    const port = 9876; // Fixed port for testing

    // Create HTTP server
    server = createServer((req, res) => {
      if (currentHandler) {
        currentHandler(req, res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => {
      server!.listen(port, () => {
        resolve();
      });
    });

    const mockServer: MockXmltvServer = {
      url: `http://localhost:${port}`,
      port,

      serveXml: (channels: XmltvChannel[], programs: Program[]) => {
        const xml = createXmltvXml(channels, programs);
        currentHandler = (_req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/xml' });
          res.end(xml);
        };
      },

      serveXmlGz: (channels: XmltvChannel[], programs: Program[]) => {
        const gzData = createXmltvXmlGz(channels, programs);
        currentHandler = (_req, res) => {
          res.writeHead(200, {
            'Content-Type': 'application/gzip',
            'Content-Encoding': 'gzip',
          });
          res.end(gzData);
        };
      },

      serveError: (statusCode: number, message: string) => {
        currentHandler = (_req, res) => {
          res.writeHead(statusCode);
          res.end(message);
        };
      },

      close: async () => {
        if (server) {
          await new Promise<void>((resolve, reject) => {
            server!.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      },
    };

    await use(mockServer);

    // Cleanup: close server
    await mockServer.close();
  },
});

export { expect } from '@playwright/test';
