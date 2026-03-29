import { invoke } from './invoke';

/** Account response type (without password) */
export interface Account {
  id: number;
  name: string;
  serverUrl: string;
  username: string;
  maxConnections: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Connection status fields (populated after connection test)
  connectionStatus?: string;
  expiryDate?: string;
  maxConnectionsActual?: number;
  activeConnections?: number;
}

/** Request type for adding a new account */
export interface AddAccountRequest {
  name: string;
  serverUrl: string;
  username: string;
  password: string;
}

/**
 * Add a new Xtream Codes account
 * @param request - Account details including credentials
 * @returns The created account (without password)
 */
export async function addAccount(request: AddAccountRequest): Promise<Account> {
  return invoke<Account>('add_account', { request });
}

/**
 * Get all accounts (without passwords)
 * @returns List of all configured accounts
 */
export async function getAccounts(): Promise<Account[]> {
  return invoke<Account[]>('get_accounts');
}

/**
 * Delete an account by ID
 * @param id - Account ID to delete
 */
export async function deleteAccount(id: number): Promise<void> {
  return invoke('delete_account', { id });
}

/** Request type for updating an account */
export interface UpdateAccountRequest {
  name: string;
  serverUrl: string;
  username: string;
  password?: string; // Optional - only update if provided
}

/**
 * Update an existing account
 * @param id - Account ID to update
 * @param request - Updated account details (password optional)
 * @returns The updated account (without password)
 */
export async function updateAccount(id: number, request: UpdateAccountRequest): Promise<Account> {
  return invoke<Account>('update_account', { id, request });
}

/**
 * Toggle account active status
 * @param accountId - Account ID to toggle
 * @param active - Whether to enable or disable the account
 * @returns The updated account
 */
export async function toggleAccount(accountId: number, active: boolean): Promise<Account> {
  return invoke<Account>('toggle_account', { accountId, isActive: active });
}

/** Response type for test_connection command */
export interface TestConnectionResponse {
  success: boolean;
  status?: string;
  expiryDate?: string; // ISO 8601 format
  maxConnections?: number;
  activeConnections?: number;
  errorMessage?: string;
  suggestions?: string[];
}

/**
 * Test connection to Xtream Codes server
 * @param accountId - Account ID to test
 * @returns Connection test result with status or error
 */
export async function testConnection(accountId: number): Promise<TestConnectionResponse> {
  return invoke<TestConnectionResponse>('test_connection', { accountId });
}
