import { useState, FormEvent, ChangeEvent } from 'react';

export interface AccountFormData {
  name: string;
  serverUrl: string;
  username: string;
  password: string;
}

export interface AccountFormErrors {
  name?: string;
  serverUrl?: string;
  username?: string;
  password?: string;
}

interface AccountFormProps {
  onSubmit: (data: AccountFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

/**
 * AccountForm component for adding Xtream Codes accounts
 * Provides form fields for account name, server URL, username, and password
 * with client-side validation.
 */
export function AccountForm({ onSubmit, onCancel, isLoading = false }: AccountFormProps) {
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    serverUrl: '',
    username: '',
    password: '',
  });

  const [errors, setErrors] = useState<AccountFormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: AccountFormErrors = {};

    // Validate account name
    if (!formData.name.trim()) {
      newErrors.name = 'Account name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Account name must be 100 characters or less';
    }

    // Validate server URL
    if (!formData.serverUrl.trim()) {
      newErrors.serverUrl = 'Server URL is required';
    } else if (!formData.serverUrl.match(/^https?:\/\/.+/)) {
      newErrors.serverUrl = 'Please enter a valid URL (e.g., http://example.com:8080)';
    }

    // Validate username
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length > 100) {
      newErrors.username = 'Username must be 100 characters or less';
    }

    // Validate password
    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length > 500) {
      newErrors.password = 'Password must be 500 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);

    // Clear form after successful submission (Story Task 6.6)
    setFormData({
      name: '',
      serverUrl: '',
      username: '',
      password: '',
    });
    setErrors({});
  };

  const handleChange = (field: keyof AccountFormData) => (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form
      data-testid="account-form"
      onSubmit={handleSubmit}
      className="space-y-4 p-4 bg-gray-50 rounded-lg"
    >
      {/* Account Name Field */}
      <div>
        <label htmlFor="account-name" className="block text-sm font-medium text-gray-700 mb-1">
          Account Name
        </label>
        <input
          id="account-name"
          type="text"
          data-testid="account-name-input"
          value={formData.name}
          onChange={handleChange('name')}
          placeholder="My IPTV Provider"
          maxLength={100}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isLoading}
        />
        {errors.name && (
          <p data-testid="account-name-error" className="mt-1 text-sm text-red-600">
            {errors.name}
          </p>
        )}
      </div>

      {/* Server URL Field */}
      <div>
        <label htmlFor="server-url" className="block text-sm font-medium text-gray-700 mb-1">
          Server URL
        </label>
        <input
          id="server-url"
          type="text"
          data-testid="server-url-input"
          value={formData.serverUrl}
          onChange={handleChange('serverUrl')}
          placeholder="http://example.com:8080"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.serverUrl ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isLoading}
        />
        {errors.serverUrl && (
          <p data-testid="server-url-error" className="mt-1 text-sm text-red-600">
            {errors.serverUrl}
          </p>
        )}
      </div>

      {/* Username Field */}
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
          Username
        </label>
        <input
          id="username"
          type="text"
          data-testid="username-input"
          value={formData.username}
          onChange={handleChange('username')}
          placeholder="your_username"
          maxLength={100}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.username ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isLoading}
        />
        {errors.username && (
          <p data-testid="username-error" className="mt-1 text-sm text-red-600">
            {errors.username}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          data-testid="password-input"
          value={formData.password}
          onChange={handleChange('password')}
          placeholder="your_password"
          maxLength={500}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.password ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isLoading}
        />
        {errors.password && (
          <p data-testid="password-error" className="mt-1 text-sm text-red-600">
            {errors.password}
          </p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          data-testid="submit-account-button"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? 'Adding...' : 'Add Account'}
        </button>
      </div>
    </form>
  );
}
