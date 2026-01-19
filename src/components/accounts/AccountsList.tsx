import { TrashIcon } from '@radix-ui/react-icons';
import { AccountStatus } from './AccountStatus';

export interface Account {
  id: number;
  name: string;
  serverUrl: string;
  username: string;
  maxConnections: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Connection status fields (optional, populated after connection test)
  connectionStatus?: string;
  expiryDate?: string;
  maxConnectionsActual?: number;
  activeConnections?: number;
}

interface AccountsListProps {
  accounts: Account[];
  onDelete?: (id: number) => void;
  isLoading?: boolean;
}

/**
 * AccountsList component displays a list of added Xtream Codes accounts
 * Shows account name, server URL, username, and connection status (never shows password)
 */
export function AccountsList({ accounts, onDelete, isLoading = false }: AccountsListProps) {
  if (accounts.length === 0) {
    return (
      <div data-testid="accounts-empty-state" className="text-center py-8 text-gray-500">
        <p className="text-lg">No accounts configured</p>
        <p className="text-sm mt-1">Click &quot;Add Account&quot; to add your first IPTV provider</p>
      </div>
    );
  }

  return (
    <div data-testid="accounts-list" className="space-y-3">
      {accounts.map((account) => (
        <div
          key={account.id}
          data-testid="account-item"
          data-account-id={account.id}
          className="flex flex-col p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-medium text-gray-900 truncate">{account.name}</h3>
                {account.isActive ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    Inactive
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-500">
                <span className="truncate">{extractHost(account.serverUrl)}</span>
                <span className="hidden sm:inline">|</span>
                <span className="text-gray-600">{account.username}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 ml-4">
              {onDelete && (
                <button
                  data-testid="delete-account-button"
                  onClick={() => onDelete(account.id)}
                  disabled={isLoading}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete account"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Connection Status Section */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <AccountStatus
              accountId={account.id}
              initialStatus={account.connectionStatus}
              initialExpiryDate={account.expiryDate}
              initialMaxConnections={account.maxConnectionsActual}
              initialActiveConnections={account.activeConnections}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Extract host and port from URL for display
 */
function extractHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url;
  }
}
