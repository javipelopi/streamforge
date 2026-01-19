/**
 * Settings View
 * Story 1.3: Create React GUI Shell with Routing
 * Story 1.6: Add Auto-Start on Boot Capability
 */
import { useState, useEffect } from 'react';
import { getAutostartEnabled, setAutostartEnabled } from '../lib/tauri';

export function Settings() {
  const [autostartEnabled, setAutostartEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load autostart status on mount
  useEffect(() => {
    async function loadAutostartStatus() {
      try {
        setIsLoading(true);
        setError(null);
        const status = await getAutostartEnabled();
        setAutostartEnabledState(status.enabled);
      } catch (err) {
        setError(`Failed to load autostart status: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    }
    loadAutostartStatus();
  }, []);

  // Handle toggle change
  async function handleAutostartToggle() {
    const newValue = !autostartEnabled;
    try {
      setIsLoading(true);
      setError(null);
      await setAutostartEnabled(newValue);
      setAutostartEnabledState(newValue);
    } catch (err) {
      setError(`Failed to ${newValue ? 'enable' : 'disable'} autostart: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div data-testid="settings-view">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Startup Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">Startup</h2>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label
                htmlFor="autostart-toggle"
                data-testid="autostart-toggle-label"
                className="font-medium text-gray-900"
              >
                Start on boot
              </label>
              <p className="text-sm text-gray-500 mt-1">
                Automatically launch the app when you log in to your computer
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isLoading && (
                <span
                  data-testid="settings-loading-indicator"
                  className="text-sm text-gray-500"
                >
                  Loading...
                </span>
              )}

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="autostart-toggle"
                  type="checkbox"
                  data-testid="autostart-toggle"
                  checked={autostartEnabled}
                  onChange={handleAutostartToggle}
                  disabled={isLoading}
                  className="absolute w-11 h-6 opacity-0 cursor-pointer peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed pointer-events-none"></div>
              </label>
            </div>
          </div>

          {error && (
            <div
              data-testid="settings-error-message"
              className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm"
            >
              {error}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
