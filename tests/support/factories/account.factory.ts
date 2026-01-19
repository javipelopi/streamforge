import { faker } from '@faker-js/faker';

/**
 * Account Factory
 *
 * Generates random account data for testing using faker.
 * Follows data factory best practices:
 * - All data is randomly generated (no hardcoded values)
 * - Supports overrides for specific test scenarios
 * - Generates complete valid objects
 */

export interface AccountInput {
  name?: string;
  serverUrl?: string;
  username?: string;
  password?: string;
}

export interface Account {
  id: number;
  name: string;
  serverUrl: string;
  username: string;
  maxConnections: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a random account input (for adding accounts)
 */
export const createAccountInput = (overrides: Partial<AccountInput> = {}): AccountInput => {
  return {
    name: faker.company.name(),
    serverUrl: `http://${faker.internet.domainName()}:${faker.number.int({ min: 8000, max: 9000 })}`,
    username: faker.internet.username(),
    password: faker.internet.password({ length: 16, memorable: false }),
    ...overrides,
  };
};

/**
 * Create multiple random account inputs
 */
export const createAccountInputs = (count: number): AccountInput[] => {
  return Array.from({ length: count }, () => createAccountInput());
};

/**
 * Create a mock account response (as returned from backend)
 */
export const createAccount = (overrides: Partial<Account> = {}): Account => {
  return {
    id: faker.number.int({ min: 1, max: 10000 }),
    name: faker.company.name(),
    serverUrl: `http://${faker.internet.domainName()}:${faker.number.int({ min: 8000, max: 9000 })}`,
    username: faker.internet.username(),
    maxConnections: 1,
    isActive: true,
    createdAt: faker.date.recent().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
};

/**
 * Create multiple mock accounts
 */
export const createAccounts = (count: number): Account[] => {
  return Array.from({ length: count }, () => createAccount());
};

/**
 * Create account input with specific validation failures for testing
 */
export const createInvalidAccountInput = (invalidField: 'name' | 'serverUrl' | 'username' | 'password'): AccountInput => {
  const validAccount = createAccountInput();

  switch (invalidField) {
    case 'name':
      return { ...validAccount, name: '' };
    case 'serverUrl':
      return { ...validAccount, serverUrl: '' };
    case 'username':
      return { ...validAccount, username: '' };
    case 'password':
      return { ...validAccount, password: '' };
  }
};

/**
 * Create account input with invalid URL format for testing
 */
export const createAccountInputWithInvalidUrl = (): AccountInput => {
  return createAccountInput({ serverUrl: 'not-a-valid-url' });
};
