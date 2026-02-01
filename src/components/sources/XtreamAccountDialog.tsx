/**
 * Xtream Account Dialog Component
 * Sources-Centric UX Unification: Phase 2.1
 *
 * Dialog for adding or editing Xtream Codes accounts.
 * Features:
 * - Add/Edit modes
 * - Test Connection button with inline status
 * - Password visibility toggle
 */
import { useState, useEffect } from 'react';
import { EyeOpenIcon, EyeClosedIcon } from '@radix-ui/react-icons';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogCancelButton, DialogSubmitButton } from '../common/Dialog';
import type { Account, TestConnectionResponse } from '../../lib/tauri';

export interface XtreamAccountFormData {
  name: string;
  serverUrl: string;
  username: string;
  password: string;
}

export interface XtreamAccountDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state should change */
  onOpenChange: (open: boolean) => void;
  /** Account to edit (undefined for add mode) */
  account?: Account;
  /** Callback when form is submitted */
  onSubmit: (data: XtreamAccountFormData) => Promise<void>;
  /** Callback to test connection */
  onTestConnection?: (accountId: number) => Promise<TestConnectionResponse>;
  /** Whether submitting */
  isLoading?: boolean;
  /** External error */
  error?: string;
  /** Clear external error */
  onClearError?: () => void;
}

export function XtreamAccountDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
  onTestConnection,
  isLoading = false,
  error: externalError,
  onClearError,
}: XtreamAccountDialogProps) {
  const isEditMode = !!account;

  // Form state
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);

  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);

  // Reset form when dialog opens or account changes
  useEffect(() => {
    if (open) {
      if (account) {
        setName(account.name);
        setServerUrl(account.serverUrl);
        setUsername(account.username);
        setPassword('');
      } else {
        setName('');
        setServerUrl('');
        setUsername('');
        setPassword('');
      }
      setShowPassword(false);
      setValidationError(null);
      setTestResult(null);
    }
  }, [open, account]);

  // Clear validation error on input change
  const handleInputChange = (setter: (value: string) => void) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setter(e.target.value);
    setValidationError(null);
    if (onClearError) onClearError();
    setTestResult(null);
  };

  const validateForm = (): boolean => {
    // Validate name
    if (!name.trim()) {
      setValidationError('Account name is required');
      return false;
    }
    if (name.length > 100) {
      setValidationError('Account name must be 100 characters or less');
      return false;
    }

    // Validate server URL
    if (!serverUrl.trim()) {
      setValidationError('Server URL is required');
      return false;
    }
    if (!serverUrl.match(/^https?:\/\/.+/)) {
      setValidationError('Please enter a valid URL (e.g., http://example.com:8080)');
      return false;
    }

    // Validate username
    if (!username.trim()) {
      setValidationError('Username is required');
      return false;
    }
    if (username.length > 100) {
      setValidationError('Username must be 100 characters or less');
      return false;
    }

    // Validate password (required for new accounts, optional for edits)
    if (!isEditMode && !password.trim()) {
      setValidationError('Password is required');
      return false;
    }
    if (password.length > 500) {
      setValidationError('Password must be 500 characters or less');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit({
      name: name.trim(),
      serverUrl: serverUrl.trim(),
      username: username.trim(),
      password: password, // May be empty in edit mode
    });
  };

  const handleTestConnection = async () => {
    if (!account || !onTestConnection) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await onTestConnection(account.id);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClose = () => {
    if (!isLoading && !isTesting) {
      onOpenChange(false);
    }
  };

  const displayError = validationError || externalError;
  const isActionInProgress = isLoading || isTesting;

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={isEditMode ? 'Edit Xtream Account' : 'Add Xtream Account'}
      subtitle={isEditMode ? 'Update your Xtream Codes credentials' : 'Enter your Xtream Codes provider details'}
      isLoading={isActionInProgress}
      error={displayError || undefined}
      testId="xtream-account-dialog"
      footer={
        <>
          <DialogCancelButton onClick={handleClose} disabled={isActionInProgress} />
          <DialogSubmitButton
            type="submit"
            form="xtream-account-form"
            isLoading={isLoading}
            loadingText={isEditMode ? 'Saving...' : 'Adding...'}
            testId="xtream-account-submit"
          >
            {isEditMode ? 'Save Changes' : 'Add Account'}
          </DialogSubmitButton>
        </>
      }
    >
      <form id="xtream-account-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Account Name Field */}
        <div>
          <label htmlFor="xtream-name" className="block text-sm font-medium text-gray-700 mb-1">
            Account Name
          </label>
          <input
            id="xtream-name"
            type="text"
            data-testid="xtream-name-input"
            value={name}
            onChange={handleInputChange(setName)}
            placeholder="My IPTV Provider"
            maxLength={100}
            disabled={isActionInProgress}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            autoFocus
          />
        </div>

        {/* Server URL Field */}
        <div>
          <label htmlFor="xtream-server" className="block text-sm font-medium text-gray-700 mb-1">
            Server URL
          </label>
          <input
            id="xtream-server"
            type="text"
            data-testid="xtream-server-input"
            value={serverUrl}
            onChange={handleInputChange(setServerUrl)}
            placeholder="http://example.com:8080"
            disabled={isActionInProgress}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Username Field */}
        <div>
          <label htmlFor="xtream-username" className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            id="xtream-username"
            type="text"
            data-testid="xtream-username-input"
            value={username}
            onChange={handleInputChange(setUsername)}
            placeholder="your_username"
            maxLength={100}
            disabled={isActionInProgress}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="xtream-password" className="block text-sm font-medium text-gray-700 mb-1">
            Password{' '}
            {isEditMode && (
              <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
            )}
          </label>
          <div className="relative">
            <input
              id="xtream-password"
              type={showPassword ? 'text' : 'password'}
              data-testid="xtream-password-input"
              value={password}
              onChange={handleInputChange(setPassword)}
              placeholder={isEditMode ? '••••••••' : 'your_password'}
              maxLength={500}
              disabled={isActionInProgress}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeClosedIcon className="w-5 h-5" />
              ) : (
                <EyeOpenIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Edit mode actions: Test Connection */}
        {isEditMode && onTestConnection && (
          <div className="pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isActionInProgress}
                className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>

              {/* Connection test result */}
              {testResult && (
                <div
                  className={`flex items-center gap-2 text-sm ${
                    testResult.success ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {testResult.success ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Connected
                      {testResult.status && ` (${testResult.status})`}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      {testResult.errorMessage || 'Connection failed'}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </Dialog>
  );
}
