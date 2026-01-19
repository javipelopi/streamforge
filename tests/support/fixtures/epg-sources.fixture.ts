import { test as base } from '@playwright/test';
import type { NewXmltvSource, XmltvSource, XmltvFormat } from '../factories/xmltv-source.factory';

type XmltvSourceUpdate = {
  name?: string;
  url?: string;
  format?: XmltvFormat;
  refreshHour?: number;
  isActive?: boolean;
};

/**
 * Fixture for managing XMLTV sources via Tauri commands
 * Provides API helpers with automatic cleanup
 */
export const test = base.extend<{
  xmltvSourcesApi: {
    add: (source: NewXmltvSource) => Promise<XmltvSource>;
    getAll: () => Promise<XmltvSource[]>;
    update: (id: number, updates: XmltvSourceUpdate) => Promise<XmltvSource>;
    delete: (id: number) => Promise<void>;
    toggle: (id: number, active: boolean) => Promise<XmltvSource>;
  };
}>({
  xmltvSourcesApi: async ({ page }, use) => {
    const createdSourceIds: number[] = [];

    const api = {
      add: async (source: NewXmltvSource): Promise<XmltvSource> => {
        const result = await page.evaluate(
          async ({ name, url, format }) => {
            // @ts-ignore - Tauri invoke available in Tauri context
            return window.__TAURI__.invoke('add_xmltv_source', { name, url, format });
          },
          source
        );
        createdSourceIds.push(result.id);
        return result;
      },

      getAll: async (): Promise<XmltvSource[]> => {
        return page.evaluate(async () => {
          // @ts-ignore - Tauri invoke available in Tauri context
          return window.__TAURI__.invoke('get_xmltv_sources');
        });
      },

      update: async (id: number, updates: XmltvSourceUpdate): Promise<XmltvSource> => {
        return page.evaluate(
          async ({ sourceId, updates }) => {
            // @ts-ignore - Tauri invoke available in Tauri context
            return window.__TAURI__.invoke('update_xmltv_source', { sourceId, updates });
          },
          { sourceId: id, updates }
        );
      },

      delete: async (id: number): Promise<void> => {
        await page.evaluate(
          async (sourceId) => {
            // @ts-ignore - Tauri invoke available in Tauri context
            return window.__TAURI__.invoke('delete_xmltv_source', { sourceId });
          },
          id
        );
        // Remove from cleanup list if already tracked
        const index = createdSourceIds.indexOf(id);
        if (index > -1) {
          createdSourceIds.splice(index, 1);
        }
      },

      toggle: async (id: number, active: boolean): Promise<XmltvSource> => {
        return page.evaluate(
          async ({ sourceId, active }) => {
            // @ts-ignore - Tauri invoke available in Tauri context
            return window.__TAURI__.invoke('toggle_xmltv_source', { sourceId, active });
          },
          { sourceId: id, active }
        );
      },
    };

    // Provide API to test
    await use(api);

    // Cleanup: Delete all sources created during test
    for (const id of createdSourceIds) {
      try {
        await api.delete(id);
      } catch (error) {
        // Source may have been deleted by test - ignore error
        console.warn(`Failed to cleanup XMLTV source ${id}:`, error);
      }
    }
  },
});

export { expect } from '@playwright/test';
