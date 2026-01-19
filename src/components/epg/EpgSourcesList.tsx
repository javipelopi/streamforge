import { useState, useEffect, useCallback } from 'react';
import { TrashIcon, Pencil1Icon, ReloadIcon } from '@radix-ui/react-icons';
import type { XmltvSource, EpgStats } from '../../lib/tauri';
import { refreshEpgSource, refreshAllEpgSources, getEpgStats } from '../../lib/tauri';

interface EpgSourcesListProps {
  sources: XmltvSource[];
  onEdit: (source: XmltvSource) => void;
  onDelete: (source: XmltvSource) => void;
  onToggle: (source: XmltvSource, active: boolean) => void;
  onSourceUpdated?: (source: XmltvSource) => void;
  isLoading?: boolean;
}

/**
 * EpgSourcesList component displays a list of XMLTV EPG sources
 * Shows source name, URL, format, last refresh status, and EPG stats
 */
export function EpgSourcesList({
  sources,
  onEdit,
  onDelete,
  onToggle,
  onSourceUpdated,
  isLoading = false,
}: EpgSourcesListProps) {
  const [refreshingSource, setRefreshingSource] = useState<number | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [epgStats, setEpgStats] = useState<Record<number, EpgStats>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load EPG stats for all sources
  const loadStats = useCallback(async () => {
    const statsMap: Record<number, EpgStats> = {};
    for (const source of sources) {
      try {
        const stats = await getEpgStats(source.id);
        statsMap[source.id] = stats;
      } catch (err) {
        console.error(`Failed to load stats for source ${source.id}:`, err);
      }
    }
    setEpgStats(statsMap);
  }, [sources]);

  useEffect(() => {
    if (sources.length > 0) {
      loadStats();
    }
  }, [sources, loadStats]);

  // Handle single source refresh
  const handleRefreshSource = async (source: XmltvSource) => {
    setRefreshingSource(source.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await refreshEpgSource(source.id);

      // Reload stats for this source
      const stats = await getEpgStats(source.id);
      setEpgStats((prev) => ({ ...prev, [source.id]: stats }));

      // Notify parent of update
      if (onSourceUpdated) {
        // Create updated source with new lastRefresh
        const updatedSource = { ...source, lastRefresh: stats.lastRefresh };
        onSourceUpdated(updatedSource);
      }

      setSuccessMessage(`Successfully refreshed "${source.name}": ${stats.channelCount} channels, ${stats.programCount} programs`);
    } catch (err) {
      console.error('Failed to refresh EPG source:', err);
      const errorMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to refresh EPG source';
      setError(errorMessage);
    } finally {
      setRefreshingSource(null);
    }
  };

  // Handle refresh all sources
  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await refreshAllEpgSources();

      // Reload all stats
      await loadStats();

      setSuccessMessage('Successfully refreshed all EPG sources');
    } catch (err) {
      console.error('Failed to refresh all EPG sources:', err);
      const errorMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to refresh EPG sources';
      setError(errorMessage);
    } finally {
      setRefreshingAll(false);
    }
  };

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (sources.length === 0) {
    return (
      <div data-testid="epg-sources-empty" className="text-center py-8 text-gray-500">
        <p className="text-lg">No EPG sources configured</p>
        <p className="text-sm mt-1">Add an XMLTV source to get program guide data</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh All Button */}
      <div className="flex justify-end">
        <button
          data-testid="refresh-all-epg-sources"
          onClick={handleRefreshAll}
          disabled={isLoading || refreshingAll || refreshingSource !== null}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ReloadIcon className={`w-4 h-4 mr-2 ${refreshingAll ? 'animate-spin' : ''}`} />
          {refreshingAll ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div
          data-testid="toast"
          role="status"
          className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm"
        >
          {successMessage}
        </div>
      )}
      {error && (
        <div
          data-testid="toast"
          role="status"
          className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm"
        >
          {error}
        </div>
      )}

      {/* Sources List */}
      <div data-testid="epg-sources-list" className="space-y-3">
        {sources.map((source) => {
          const stats = epgStats[source.id];
          const isRefreshing = refreshingSource === source.id;

          return (
            <div
              key={source.id}
              data-testid={`epg-source-item-${source.id}`}
              className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  data-testid={`epg-source-toggle-${source.id}`}
                  checked={source.isActive}
                  onChange={(e) => onToggle(source, e.target.checked)}
                  disabled={isLoading || isRefreshing}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
              </label>

              {/* Source Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{source.name}</span>
                  {!source.isActive && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      Disabled
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 truncate">{source.url}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Format: {formatDisplay(source.format)}
                </div>
                {/* Last Refresh Display */}
                <div
                  data-testid={`epg-source-last-refresh-${source.id}`}
                  className="text-xs text-gray-400 mt-1"
                >
                  {source.lastRefresh
                    ? `Last refresh: ${formatTimeAgo(source.lastRefresh)}`
                    : 'Never refreshed'
                  }
                </div>
                {/* EPG Stats Display */}
                <div
                  data-testid={`epg-source-stats-${source.id}`}
                  className="text-xs text-gray-500 mt-1"
                >
                  {stats
                    ? `${stats.channelCount} channel${stats.channelCount !== 1 ? 's' : ''} · ${stats.programCount} program${stats.programCount !== 1 ? 's' : ''}`
                    : 'No EPG data'
                  }
                </div>
              </div>

              {/* Refresh Spinner (when refreshing) */}
              {isRefreshing && (
                <div data-testid={`epg-source-refreshing-${source.id}`}>
                  <ReloadIcon className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Refresh Button */}
                <button
                  data-testid={`refresh-epg-source-${source.id}`}
                  onClick={() => handleRefreshSource(source)}
                  disabled={isLoading || isRefreshing || refreshingAll}
                  className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh EPG"
                >
                  <ReloadIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  data-testid={`epg-source-edit-${source.id}`}
                  onClick={() => onEdit(source)}
                  disabled={isLoading || isRefreshing}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Edit source"
                >
                  <Pencil1Icon className="w-5 h-5" />
                </button>
                <button
                  data-testid={`epg-source-delete-${source.id}`}
                  onClick={() => {
                    if (confirm(`Delete "${source.name}"?`)) {
                      onDelete(source);
                    }
                  }}
                  disabled={isLoading || isRefreshing}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete source"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Format the display string for XMLTV format
 */
function formatDisplay(format: string): string {
  switch (format) {
    case 'xml_gz':
      return 'xml.gz';
    case 'auto':
      return 'Auto-detect';
    default:
      return format;
  }
}

/**
 * Format a timestamp as "X ago" (e.g., "5 minutes ago", "2 hours ago")
 */
function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  }
  if (diffHour > 0) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  }
  if (diffMin > 0) {
    return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}
