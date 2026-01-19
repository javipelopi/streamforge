import { useState, useEffect, useCallback } from 'react';
import { PlusIcon } from '@radix-ui/react-icons';
import { AccountForm, AccountsList } from '../components/accounts';
import { EpgSourcesList, EpgSourceDialog } from '../components/epg';
import type { AccountFormData } from '../components/accounts';
import type { Account, XmltvSource, NewXmltvSource } from '../lib/tauri';
import {
  addAccount,
  getAccounts,
  deleteAccount,
  getXmltvSources,
  addXmltvSource,
  updateXmltvSource,
  deleteXmltvSource,
  toggleXmltvSource,
} from '../lib/tauri';

/**
 * Accounts View - Manages Xtream Codes IPTV provider accounts and EPG sources
 * Story 2.1: Add Xtream Account with Secure Credential Storage
 * Story 2.4: Add XMLTV Source Management
 */
export function Accounts() {
  // Account state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // EPG Sources state
  const [epgSources, setEpgSources] = useState<XmltvSource[]>([]);
  const [showEpgDialog, setShowEpgDialog] = useState(false);
  const [editingEpgSource, setEditingEpgSource] = useState<XmltvSource | undefined>(undefined);
  const [epgLoading, setEpgLoading] = useState(false);

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

  // Load EPG sources
  const loadEpgSources = useCallback(async () => {
    try {
      const sources = await getXmltvSources();
      setEpgSources(sources);
    } catch (err) {
      console.error('Failed to load EPG sources:', err);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadEpgSources();
  }, [loadAccounts, loadEpgSources]);

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
      const errorMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to add account. Please try again.';
      setError(errorMessage);
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

  // EPG Source handlers
  const handleAddEpgSource = () => {
    setEditingEpgSource(undefined);
    setShowEpgDialog(true);
  };

  const handleEditEpgSource = (source: XmltvSource) => {
    setEditingEpgSource(source);
    setShowEpgDialog(true);
  };

  const handleEpgDialogSubmit = async (data: NewXmltvSource) => {
    setEpgLoading(true);
    try {
      if (editingEpgSource) {
        // Update existing source
        const updated = await updateXmltvSource(editingEpgSource.id, {
          name: data.name,
          url: data.url,
          format: data.format,
        });
        setEpgSources((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
      } else {
        // Add new source
        const newSource = await addXmltvSource(data);
        setEpgSources((prev) => [...prev, newSource]);
      }
      setShowEpgDialog(false);
      setEditingEpgSource(undefined);
    } finally {
      setEpgLoading(false);
    }
  };

  const handleDeleteEpgSource = async (source: XmltvSource) => {
    setEpgLoading(true);
    try {
      await deleteXmltvSource(source.id);
      setEpgSources((prev) => prev.filter((s) => s.id !== source.id));
    } catch (err) {
      console.error('Failed to delete EPG source:', err);
      setError('Failed to delete EPG source. Please try again.');
    } finally {
      setEpgLoading(false);
    }
  };

  const handleToggleEpgSource = async (source: XmltvSource, active: boolean) => {
    setEpgLoading(true);
    try {
      const updated = await toggleXmltvSource(source.id, active);
      setEpgSources((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
    } catch (err) {
      console.error('Failed to toggle EPG source:', err);
      setError('Failed to update EPG source. Please try again.');
    } finally {
      setEpgLoading(false);
    }
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

      {/* EPG Sources Section */}
      {!showForm && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">EPG Sources</h2>
            <button
              data-testid="add-epg-source-button"
              onClick={handleAddEpgSource}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add EPG Source
            </button>
          </div>

          <EpgSourcesList
            sources={epgSources}
            onEdit={handleEditEpgSource}
            onDelete={handleDeleteEpgSource}
            onToggle={handleToggleEpgSource}
            onSourceUpdated={(updatedSource) => {
              setEpgSources((prev) =>
                prev.map((s) => (s.id === updatedSource.id ? updatedSource : s))
              );
            }}
            isLoading={epgLoading}
          />
        </div>
      )}

      {/* EPG Source Dialog */}
      <EpgSourceDialog
        open={showEpgDialog}
        onOpenChange={setShowEpgDialog}
        source={editingEpgSource}
        onSubmit={handleEpgDialogSubmit}
        isLoading={epgLoading}
      />
    </div>
  );
}
