/**
 * Xtream Sources Tab Component
 * Story 3-11: Implement Sources View with Xtream Tab
 * Sources-Centric UX Unification: Phase 4.1
 *
 * Displays Xtream accounts as expandable accordion sections.
 * Each account shows streams with link status and quality badges.
 * Features "Add Xtream Account" button that opens modal dialog.
 */
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Tv, Plus } from 'lucide-react';
import {
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  testConnection,
  type Account,
  type TestConnectionResponse,
} from '../../lib/api';
import { XtreamAccountAccordion } from './XtreamAccountAccordion';
import { SourcesErrorBoundary } from './SourcesErrorBoundary';
import { XtreamAccountDialog, type XtreamAccountFormData } from './XtreamAccountDialog';
import { DeleteConfirmDialog } from './shared';

export function XtreamSourcesTab() {
  const queryClient = useQueryClient();

  // Dialog state
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Fetch Xtream accounts
  const {
    data: accounts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Add account mutation
  const addMutation = useMutation({
    mutationFn: async (data: XtreamAccountFormData) => {
      return addAccount({
        name: data.name,
        serverUrl: data.serverUrl,
        username: data.username,
        password: data.password,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setShowAccountDialog(false);
      setEditingAccount(undefined);
    },
  });

  // Update account mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: XtreamAccountFormData }) => {
      return updateAccount(id, {
        name: data.name,
        serverUrl: data.serverUrl,
        username: data.username,
        password: data.password || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setShowAccountDialog(false);
      setEditingAccount(undefined);
    },
  });

  // Delete account mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return deleteAccount(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setAccountToDelete(null);
    },
  });

  // Test connection handler
  const handleTestConnection = async (accountId: number): Promise<TestConnectionResponse> => {
    return testConnection(accountId);
  };

  // Submit handler for dialog
  const handleSubmit = async (data: XtreamAccountFormData): Promise<void> => {
    if (editingAccount) {
      await updateMutation.mutateAsync({ id: editingAccount.id, data });
    } else {
      await addMutation.mutateAsync(data);
    }
  };

  // Edit handler from accordion
  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setShowAccountDialog(true);
  };

  // Delete handler from accordion
  const handleDelete = (account: Account) => {
    setAccountToDelete(account);
  };

  // Add button handler
  const handleAdd = () => {
    setEditingAccount(undefined);
    setShowAccountDialog(true);
  };

  // Close dialog handler
  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setShowAccountDialog(false);
      setEditingAccount(undefined);
      addMutation.reset();
      updateMutation.reset();
    }
  };

  const isSubmitting = addMutation.isPending || updateMutation.isPending;
  const submitError = addMutation.error?.message || updateMutation.error?.message;

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
              Add an Xtream Codes account to browse streams.
            </p>
          </div>
          <button
            data-testid="add-xtream-account-button"
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Xtream Account
          </button>
        </div>

        <XtreamAccountDialog
          open={showAccountDialog}
          onOpenChange={handleCloseDialog}
          account={editingAccount}
          onSubmit={handleSubmit}
          onTestConnection={handleTestConnection}
          isLoading={isSubmitting}
          error={submitError}
          onClearError={() => {
            addMutation.reset();
            updateMutation.reset();
          }}
        />
      </div>
    );
  }

  // Accounts list
  return (
    <div data-testid="xtream-sources-tab" className="space-y-4 overflow-auto h-full">
      {/* Add account button */}
      <div className="flex justify-end">
        <button
          data-testid="add-xtream-account-button"
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Xtream Account
        </button>
      </div>

      {accounts.map((account) => (
        <SourcesErrorBoundary key={account.id} fallbackMessage={`Error loading streams for ${account.name}`}>
          <XtreamAccountAccordion
            account={account}
            onEdit={() => handleEdit(account)}
            onDelete={() => handleDelete(account)}
          />
        </SourcesErrorBoundary>
      ))}

      {/* Account Dialog */}
      <XtreamAccountDialog
        open={showAccountDialog}
        onOpenChange={handleCloseDialog}
        account={editingAccount}
        onSubmit={handleSubmit}
        onTestConnection={handleTestConnection}
        isLoading={isSubmitting}
        error={submitError}
        onClearError={() => {
          addMutation.reset();
          updateMutation.reset();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={!!accountToDelete}
        onOpenChange={(open) => {
          if (!open) setAccountToDelete(null);
        }}
        title="Delete Xtream Account"
        description={`Are you sure you want to delete "${accountToDelete?.name}"? This will remove all associated streams and mappings.`}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => {
          if (accountToDelete) {
            deleteMutation.mutate(accountToDelete.id);
          }
        }}
        testIdPrefix="xtream-delete"
      />
    </div>
  );
}
