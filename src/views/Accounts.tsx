import { useState, useEffect, useCallback } from 'react';
import { PlusIcon } from '@radix-ui/react-icons';
import { AccountForm, AccountsList } from '../components/accounts';
import type { AccountFormData } from '../components/accounts';
import type { Account } from '../lib/tauri';
import { addAccount, getAccounts, deleteAccount } from '../lib/tauri';

/**
 * Accounts View - Manages Xtream Codes IPTV provider accounts
 * Story 2.1: Add Xtream Account with Secure Credential Storage
 */
export function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load accounts on mount
  const loadAccounts = useCallback(async () => {
    try {
      setError(null);
      const loadedAccounts = await getAccounts();
      setAccounts(loadedAccounts);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setError('Failed to load accounts. Please try again.');
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Handle form submission
  const handleSubmit = async (data: AccountFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const newAccount = await addAccount({
        name: data.name,
        serverUrl: data.serverUrl,
        username: data.username,
        password: data.password,
      });

      setAccounts((prev) => [...prev, newAccount]);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to add account:', err);
      setError(typeof err === 'string' ? err : 'Failed to add account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle account deletion
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await deleteAccount(id);
      setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    } catch (err) {
      console.error('Failed to delete account:', err);
      setError('Failed to delete account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowForm(false);
    setError(null);
  };

  if (isInitialLoading) {
    return (
      <div data-testid="accounts-view" className="p-4">
        <h1 className="text-2xl font-bold mb-4">Accounts</h1>
        <div className="text-gray-500">Loading accounts...</div>
      </div>
    );
  }

  return (
    <div data-testid="accounts-view" className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Accounts</h1>
        {!showForm && (
          <button
            data-testid="add-account-button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Account
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Form or List */}
      {showForm ? (
        <AccountForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      ) : (
        <AccountsList
          accounts={accounts}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
