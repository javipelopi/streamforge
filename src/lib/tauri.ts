import { invoke } from '@tauri-apps/api/core';

export async function greet(name: string): Promise<string> {
  return invoke('greet', { name });
}

/** Response type for autostart status queries */
export interface AutostartStatus {
  enabled: boolean;
}

/**
 * Get the current autostart status
 * @returns Whether autostart is enabled
 */
export async function getAutostartEnabled(): Promise<AutostartStatus> {
  return invoke<AutostartStatus>('get_autostart_enabled');
}

/**
 * Set the autostart status
 * @param enabled - Whether to enable or disable autostart
 */
export async function setAutostartEnabled(enabled: boolean): Promise<void> {
  return invoke('set_autostart_enabled', { enabled });
}

// Account types and functions

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
