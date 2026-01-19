import { TrashIcon, Pencil1Icon } from '@radix-ui/react-icons';
import type { XmltvSource } from '../../lib/tauri';

interface EpgSourcesListProps {
  sources: XmltvSource[];
  onEdit: (source: XmltvSource) => void;
  onDelete: (source: XmltvSource) => void;
  onToggle: (source: XmltvSource, active: boolean) => void;
  isLoading?: boolean;
}

/**
 * EpgSourcesList component displays a list of XMLTV EPG sources
 * Shows source name, URL, format, and last refresh status
 */
export function EpgSourcesList({
  sources,
  onEdit,
  onDelete,
  onToggle,
  isLoading = false,
}: EpgSourcesListProps) {
  if (sources.length === 0) {
    return (
      <div data-testid="epg-sources-empty" className="text-center py-8 text-gray-500">
        <p className="text-lg">No EPG sources configured</p>
        <p className="text-sm mt-1">Add an XMLTV source to get program guide data</p>
      </div>
    );
  }

  return (
    <div data-testid="epg-sources-list" className="space-y-3">
      {sources.map((source) => (
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
              disabled={isLoading}
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
              {source.lastRefresh && (
                <span>
                  {' · '}Last refresh: {formatTimeAgo(source.lastRefresh)}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              data-testid={`epg-source-edit-${source.id}`}
              onClick={() => onEdit(source)}
              disabled={isLoading}
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
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete source"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
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
