import { useState, useEffect, useCallback } from 'react';
import { ChannelsList } from '../components/channels';
import { getChannels, getAccounts, type Channel, type Account } from '../lib/tauri';

/**
 * Channels View - Displays channels from all accounts
 * Story 2-3: Retrieve and store channel list from Xtream
 */
export function Channels() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load accounts on mount
  const loadAccounts = useCallback(async () => {
    try {
      const loadedAccounts = await getAccounts();
      setAccounts(loadedAccounts);
      // Select first account by default if available
      if (loadedAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(loadedAccounts[0].id);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setError('Failed to load accounts');
    }
  }, [selectedAccountId]);

  // Load channels when account is selected
  const loadChannels = useCallback(async () => {
    if (!selectedAccountId) {
      setChannels([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loadedChannels = await getChannels(selectedAccountId);
      setChannels(loadedChannels);
    } catch (err) {
      console.error('Failed to load channels:', err);
      setError('Failed to load channels');
      setChannels([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Handle account selection change
  const handleAccountChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const accountId = parseInt(event.target.value, 10);
    setSelectedAccountId(isNaN(accountId) ? null : accountId);
  };

  return (
    <div data-testid="channels-view" className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Channels</h1>

        {/* Account selector */}
        {accounts.length > 0 && (
          <select
            data-testid="account-selector"
            value={selectedAccountId ?? ''}
            onChange={handleAccountChange}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select account...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* No accounts state */}
      {accounts.length === 0 && !isLoading && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg">No accounts configured</p>
          <p className="text-sm mt-1">
            Add an account in the Accounts section first
          </p>
        </div>
      )}

      {/* No account selected state */}
      {accounts.length > 0 && !selectedAccountId && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg">Select an account</p>
          <p className="text-sm mt-1">
            Choose an account from the dropdown to view its channels
          </p>
        </div>
      )}

      {/* Channels list */}
      {selectedAccountId && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <span className="text-sm text-gray-500">
              {channels.length} channel{channels.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ChannelsList
            accountId={selectedAccountId}
            channels={channels}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
