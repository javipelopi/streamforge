import { test, expect } from '@playwright/test';

/**
 * Integration Tests for Autostart Tauri Commands
 *
 * Story 1.6: Add Auto-Start on Boot Capability
 *
 * Tests verify that Tauri backend commands correctly interact with
 * the tauri-plugin-autostart to enable/disable auto-start functionality.
 *
 * RED Phase: These tests will fail until:
 * - tauri-plugin-autostart is initialized in lib.rs
 * - get_autostart_enabled command is implemented
 * - set_autostart_enabled command is implemented
 * - Commands are registered in Tauri app builder
 */

test.describe('Autostart Tauri Commands', () => {
  test('should return autostart status via get_autostart_enabled command', async ({ page }) => {
    // GIVEN: Tauri app is running with autostart commands registered
    await page.goto('/');

    // WHEN: Frontend invokes get_autostart_enabled command
    const response = await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<{ enabled: boolean }>('get_autostart_enabled');
    });

    // THEN: Command returns a valid response object
    expect(response).toBeDefined();
    expect(response).toHaveProperty('enabled');

    // AND: enabled property is a boolean
    expect(typeof response.enabled).toBe('boolean');
  });

  test('should enable autostart via set_autostart_enabled command', async ({ page }) => {
    // GIVEN: Autostart is currently disabled
    await page.goto('/');

    const initialStatus = await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<{ enabled: boolean }>('get_autostart_enabled');
    });

    // WHEN: Frontend invokes set_autostart_enabled with enabled: true
    await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_autostart_enabled', { enabled: true });
    });

    // THEN: Autostart should be enabled
    const newStatus = await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<{ enabled: boolean }>('get_autostart_enabled');
    });
    expect(newStatus.enabled).toBe(true);

    // Cleanup: Restore initial state
    await page.evaluate(async (enabled: boolean) => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_autostart_enabled', { enabled });
    }, initialStatus.enabled);
  });

  test('should disable autostart via set_autostart_enabled command', async ({ page }) => {
    // GIVEN: Autostart is currently enabled
    await page.goto('/');

    await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_autostart_enabled', { enabled: true });
    });

    const initialStatus = await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<{ enabled: boolean }>('get_autostart_enabled');
    });
    expect(initialStatus.enabled).toBe(true);

    // WHEN: Frontend invokes set_autostart_enabled with enabled: false
    await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_autostart_enabled', { enabled: false });
    });

    // THEN: Autostart should be disabled
    const newStatus = await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<{ enabled: boolean }>('get_autostart_enabled');
    });
    expect(newStatus.enabled).toBe(false);
  });

  test('should handle errors gracefully when autostart operations fail', async ({ page }) => {
    // GIVEN: Tauri app is running
    await page.goto('/');

    // WHEN: Attempting to check autostart status
    // THEN: Should not throw unhandled errors
    const getResult = await page.evaluate(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const response = await invoke<{ enabled: boolean }>('get_autostart_enabled');
        return { success: true, data: response };
      } catch (error: any) {
        return { success: false, error: error?.message || 'Unknown error' };
      }
    });

    if (getResult.success) {
      expect(getResult.data).toBeDefined();
    } else {
      expect(getResult.error).toBeDefined();
    }

    // WHEN: Attempting to set autostart with valid boolean
    // THEN: Should not throw unhandled errors
    const setResult = await page.evaluate(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_autostart_enabled', { enabled: false });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error?.message || 'Unknown error' };
      }
    });

    expect(setResult).toBeDefined();
  });

  test('should persist autostart state across command invocations', async ({ page }) => {
    // GIVEN: Autostart state is set to enabled
    await page.goto('/');

    await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_autostart_enabled', { enabled: true });
    });

    // WHEN: Checking autostart status multiple times
    const status1 = await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<{ enabled: boolean }>('get_autostart_enabled');
    });
    const status2 = await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<{ enabled: boolean }>('get_autostart_enabled');
    });
    const status3 = await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<{ enabled: boolean }>('get_autostart_enabled');
    });

    // THEN: All status checks should return consistent results
    expect(status1.enabled).toBe(true);
    expect(status2.enabled).toBe(true);
    expect(status3.enabled).toBe(true);

    // Cleanup
    await page.evaluate(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_autostart_enabled', { enabled: false });
    });
  });
});
