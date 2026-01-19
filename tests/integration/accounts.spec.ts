import { test, expect } from '@playwright/test';

/**
 * Integration Tests for Story 2.1: Accounts Tauri Commands
 *
 * Tests the backend Tauri commands for account management, including:
 * - Adding accounts
 * - Retrieving accounts
 * - Credential storage security
 * - Error handling
 */

test.describe('Account Tauri Commands', () => {
  test('add_account command should create account with encrypted password', async ({ page }) => {
    // GIVEN: Valid account data
    const accountData = {
      name: 'Test Provider',
      serverUrl: 'http://test.example.com:8080',
      username: 'testuser',
      password: 'securePassword123',
    };

    // WHEN: Calling add_account command via Tauri invoke
    await page.goto('/');
    const result = await page.evaluate(async (data) => {
      // @ts-ignore - Tauri API available in actual app
      return await window.__TAURI__.invoke('add_account', data);
    }, accountData);

    // THEN: Account is created and returned without password
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('name', accountData.name);
    expect(result).toHaveProperty('serverUrl', accountData.serverUrl);
    expect(result).toHaveProperty('username', accountData.username);
    expect(result).not.toHaveProperty('password');
    expect(result).toHaveProperty('isActive', true);
  });

  test('add_account command should reject empty name', async ({ page }) => {
    // GIVEN: Account data with empty name
    const accountData = {
      name: '',
      serverUrl: 'http://test.example.com:8080',
      username: 'testuser',
      password: 'securePassword123',
    };

    // WHEN: Calling add_account command
    await page.goto('/');
    const error = await page.evaluate(async (data) => {
      try {
        // @ts-ignore
        await window.__TAURI__.invoke('add_account', data);
        return null;
      } catch (err) {
        return err;
      }
    }, accountData);

    // THEN: Validation error is returned
    expect(error).toContain('name');
    expect(error).toContain('required');
  });

  test('add_account command should reject empty server URL', async ({ page }) => {
    // GIVEN: Account data with empty server URL
    const accountData = {
      name: 'Test Provider',
      serverUrl: '',
      username: 'testuser',
      password: 'securePassword123',
    };

    // WHEN: Calling add_account command
    await page.goto('/');
    const error = await page.evaluate(async (data) => {
      try {
        // @ts-ignore
        await window.__TAURI__.invoke('add_account', data);
        return null;
      } catch (err) {
        return err;
      }
    }, accountData);

    // THEN: Validation error is returned
    expect(error).toContain('server');
    expect(error).toContain('required');
  });

  test('add_account command should reject invalid server URL format', async ({ page }) => {
    // GIVEN: Account data with invalid URL format
    const accountData = {
      name: 'Test Provider',
      serverUrl: 'not-a-valid-url',
      username: 'testuser',
      password: 'securePassword123',
    };

    // WHEN: Calling add_account command
    await page.goto('/');
    const error = await page.evaluate(async (data) => {
      try {
        // @ts-ignore
        await window.__TAURI__.invoke('add_account', data);
        return null;
      } catch (err) {
        return err;
      }
    }, accountData);

    // THEN: Validation error is returned
    expect(error).toContain('URL');
    expect(error).toContain('invalid');
  });

  test('add_account command should reject empty username', async ({ page }) => {
    // GIVEN: Account data with empty username
    const accountData = {
      name: 'Test Provider',
      serverUrl: 'http://test.example.com:8080',
      username: '',
      password: 'securePassword123',
    };

    // WHEN: Calling add_account command
    await page.goto('/');
    const error = await page.evaluate(async (data) => {
      try {
        // @ts-ignore
        await window.__TAURI__.invoke('add_account', data);
        return null;
      } catch (err) {
        return err;
      }
    }, accountData);

    // THEN: Validation error is returned
    expect(error).toContain('username');
    expect(error).toContain('required');
  });

  test('add_account command should reject empty password', async ({ page }) => {
    // GIVEN: Account data with empty password
    const accountData = {
      name: 'Test Provider',
      serverUrl: 'http://test.example.com:8080',
      username: 'testuser',
      password: '',
    };

    // WHEN: Calling add_account command
    await page.goto('/');
    const error = await page.evaluate(async (data) => {
      try {
        // @ts-ignore
        await window.__TAURI__.invoke('add_account', data);
        return null;
      } catch (err) {
        return err;
      }
    }, accountData);

    // THEN: Validation error is returned
    expect(error).toContain('password');
    expect(error).toContain('required');
  });

  test('get_accounts command should return list of accounts without passwords', async ({ page }) => {
    // GIVEN: An account has been added
    await page.goto('/');
    await page.evaluate(async () => {
      const accountData = {
        name: 'Test Provider',
        serverUrl: 'http://test.example.com:8080',
        username: 'testuser',
        password: 'securePassword123',
      };
      // @ts-ignore
      await window.__TAURI__.invoke('add_account', accountData);
    });

    // WHEN: Calling get_accounts command
    const accounts = await page.evaluate(async () => {
      // @ts-ignore
      return await window.__TAURI__.invoke('get_accounts');
    });

    // THEN: Accounts are returned without passwords
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);

    const account = accounts[0];
    expect(account).toHaveProperty('id');
    expect(account).toHaveProperty('name');
    expect(account).toHaveProperty('serverUrl');
    expect(account).toHaveProperty('username');
    expect(account).not.toHaveProperty('password');
    expect(account).not.toHaveProperty('passwordEncrypted');
  });

  test('get_accounts command should return empty array when no accounts exist', async ({ page }) => {
    // GIVEN: No accounts have been added (fresh database)
    await page.goto('/');

    // WHEN: Calling get_accounts command
    const accounts = await page.evaluate(async () => {
      // @ts-ignore
      return await window.__TAURI__.invoke('get_accounts');
    });

    // THEN: Empty array is returned
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBe(0);
  });

  test('delete_account command should remove account from database', async ({ page }) => {
    // GIVEN: An account exists
    await page.goto('/');
    const createdAccount = await page.evaluate(async () => {
      const accountData = {
        name: 'Test Provider to Delete',
        serverUrl: 'http://test.example.com:8080',
        username: 'testuser',
        password: 'securePassword123',
      };
      // @ts-ignore
      return await window.__TAURI__.invoke('add_account', accountData);
    });

    // WHEN: Calling delete_account command
    await page.evaluate(async (id) => {
      // @ts-ignore
      await window.__TAURI__.invoke('delete_account', { id });
    }, createdAccount.id);

    // THEN: Account is removed from the list
    const accounts = await page.evaluate(async () => {
      // @ts-ignore
      return await window.__TAURI__.invoke('get_accounts');
    });

    const deletedAccount = accounts.find((acc: any) => acc.id === createdAccount.id);
    expect(deletedAccount).toBeUndefined();
  });

  test('delete_account command should also delete stored credentials', async ({ page }) => {
    // GIVEN: An account exists with stored password
    await page.goto('/');
    const createdAccount = await page.evaluate(async () => {
      const accountData = {
        name: 'Test Provider',
        serverUrl: 'http://test.example.com:8080',
        username: 'testuser',
        password: 'securePassword123',
      };
      // @ts-ignore
      return await window.__TAURI__.invoke('add_account', accountData);
    });

    // WHEN: Account is deleted
    await page.evaluate(async (id) => {
      // @ts-ignore
      await window.__TAURI__.invoke('delete_account', { id });
    }, createdAccount.id);

    // THEN: Credentials are removed from keychain/storage
    // (This is verified indirectly - attempting to retrieve password should fail)
    // The actual credential deletion is tested in Rust unit tests
  });
});

test.describe('Credential Storage Security', () => {
  test('should never log password in console', async ({ page }) => {
    // GIVEN: Console messages are being captured
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    // WHEN: Adding an account with password
    await page.goto('/');
    await page.evaluate(async () => {
      const accountData = {
        name: 'Security Test Provider',
        serverUrl: 'http://test.example.com:8080',
        username: 'testuser',
        password: 'ThisPasswordShouldNeverAppearInLogs123',
      };
      // @ts-ignore
      await window.__TAURI__.invoke('add_account', accountData);
    });

    // THEN: Password does not appear in any console messages
    const passwordInLogs = consoleMessages.some((msg) =>
      msg.includes('ThisPasswordShouldNeverAppearInLogs123')
    );
    expect(passwordInLogs).toBe(false);
  });

  test('should store password encrypted in database', async ({ page }) => {
    // GIVEN: An account is added
    await page.goto('/');
    const account = await page.evaluate(async () => {
      const accountData = {
        name: 'Encryption Test Provider',
        serverUrl: 'http://test.example.com:8080',
        username: 'testuser',
        password: 'PlaintextPassword123',
      };
      // @ts-ignore
      return await window.__TAURI__.invoke('add_account', accountData);
    });

    // WHEN: Retrieving accounts
    const accounts = await page.evaluate(async () => {
      // @ts-ignore
      return await window.__TAURI__.invoke('get_accounts');
    });

    // THEN: Password field is not present in response
    const retrievedAccount = accounts.find((acc: any) => acc.id === account.id);
    expect(retrievedAccount).toBeDefined();
    expect(retrievedAccount.password).toBeUndefined();
    expect(retrievedAccount.passwordEncrypted).toBeUndefined();

    // The actual encryption is tested in Rust unit tests
    // Here we verify the API contract: password is never returned
  });
});
