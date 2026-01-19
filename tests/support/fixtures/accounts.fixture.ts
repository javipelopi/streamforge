import { test as base, Page } from '@playwright/test';
import { createAccountInput, Account, AccountInput } from '../factories/account.factory';

/**
 * Account Fixtures
 *
 * Provides test fixtures for account management with automatic cleanup.
 * Follows fixture architecture best practices:
 * - Setup: Create account via Tauri command
 * - Provide: Return account data to test
 * - Cleanup: Delete account after test completes
 */

interface AccountFixtures {
  /**
   * Creates a single account with random data and provides it to the test.
   * Account is automatically deleted after test completion.
   */
  testAccount: Account;

  /**
   * Creates a custom account with provided data and ensures cleanup.
   * Use this when you need specific account data for your test.
   */
  createAccount: (input: Partial<AccountInput>) => Promise<Account>;

  /**
   * Provides an account input factory without creating the account.
   * Use this when you want to test the creation process itself.
   */
  accountInput: AccountInput;
}

/**
 * Invoke Tauri command from within page context
 */
async function invokeTauriCommand<T>(page: Page, command: string, args?: any): Promise<T> {
  return await page.evaluate(
    async ({ cmd, params }) => {
      // @ts-ignore - __TAURI__ is available in Tauri app context
      return await window.__TAURI__.invoke(cmd, params);
    },
    { cmd: command, params: args }
  );
}

/**
 * Delete account via Tauri command
 */
async function deleteAccount(page: Page, accountId: number): Promise<void> {
  try {
    await invokeTauriCommand(page, 'delete_account', { id: accountId });
  } catch (error) {
    // Ignore errors during cleanup (account might not exist)
    console.log(`Cleanup: Failed to delete account ${accountId}:`, error);
  }
}

/**
 * Extended test with account fixtures
 */
export const test = base.extend<AccountFixtures>({
  /**
   * testAccount fixture: Creates a random account and provides it to the test
   */
  testAccount: async ({ page }, use) => {
    // Setup: Navigate to app and create account
    await page.goto('/');
    const input = createAccountInput();

    const account = await invokeTauriCommand<Account>(page, 'add_account', { request: input });

    // Provide to test
    await use(account);

    // Cleanup: Delete the account
    await deleteAccount(page, account.id);
  },

  /**
   * createAccount fixture: Factory function for creating accounts with custom data
   */
  createAccount: async ({ page }, use) => {
    const createdAccounts: number[] = [];

    // Provide factory function to test
    const factory = async (input: Partial<AccountInput> = {}) => {
      await page.goto('/');
      const accountInput = createAccountInput(input);
      const account = await invokeTauriCommand<Account>(page, 'add_account', { request: accountInput });

      // Track for cleanup
      createdAccounts.push(account.id);

      return account;
    };

    await use(factory);

    // Cleanup: Delete all created accounts
    for (const accountId of createdAccounts) {
      await deleteAccount(page, accountId);
    }
  },

  /**
   * accountInput fixture: Provides random account input data without creating account
   */
  accountInput: async ({}, use) => {
    const input = createAccountInput();
    await use(input);
    // No cleanup needed - account was never created
  },
});

export { expect } from '@playwright/test';
