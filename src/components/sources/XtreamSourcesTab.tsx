/**
 * Xtream Sources Tab Component
 * Story 3-11: Implement Sources View with Xtream Tab
 *
 * Displays Xtream accounts as expandable accordion sections.
 * Each account shows streams with link status and quality badges.
 * Code Review Fix #1: Wrapped in error boundary for crash protection
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Tv } from 'lucide-react';
import { getAccounts } from '../../lib/tauri';
import { XtreamAccountAccordion } from './XtreamAccountAccordion';
import { ROUTES } from '../../lib/routes';
import { SourcesErrorBoundary } from './SourcesErrorBoundary';

export function XtreamSourcesTab() {
  const navigate = useNavigate();

  // Fetch Xtream accounts
  const {
    data: accounts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="xtream-sources-tab" className="animate-pulse space-y-4">
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div data-testid="xtream-sources-tab" className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Failed to load Xtream accounts</p>
      </div>
    );
  }

  // Empty state
  if (accounts.length === 0) {
    return (
      <div data-testid="xtream-sources-tab">
        <div data-testid="xtream-empty-state" className="text-center py-12">
          <Tv className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <div data-testid="xtream-empty-state-message">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No Xtream accounts configured
            </h2>
            <p className="text-gray-500 mb-6">
              Add accounts in Accounts to browse streams.
            </p>
          </div>
          <button
            data-testid="go-to-accounts-button"
            onClick={() => navigate(ROUTES.ACCOUNTS)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Accounts
          </button>
        </div>
      </div>
    );
  }

  // Accounts list
  // Code Review Fix #1: Wrap each accordion in error boundary
  return (
    <div data-testid="xtream-sources-tab" className="space-y-4 overflow-auto h-full">
      {accounts.map((account) => (
        <SourcesErrorBoundary key={account.id} fallbackMessage={`Error loading streams for ${account.name}`}>
          <XtreamAccountAccordion account={account} />
        </SourcesErrorBoundary>
      ))}
    </div>
  );
}
