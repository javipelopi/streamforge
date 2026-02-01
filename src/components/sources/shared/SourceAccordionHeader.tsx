/**
 * Source Accordion Header Component
 * Sources-Centric UX Unification: Phase 1.2
 *
 * Unified accordion header for all source types:
 * - Name with chevron toggle
 * - Item count badge
 * - Status badges (active/inactive, connection status)
 * - Last refresh timestamp
 * - Orphan count badge (optional)
 * - Action buttons: Toggle, Refresh, Edit, Delete
 */
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Pencil, Trash2, Power, PowerOff } from 'lucide-react';

export interface SourceAccordionHeaderProps {
  /** Source name */
  name: string;
  /** Number of items (channels/streams) */
  itemCount?: number;
  /** Label for items (e.g., "channels", "streams") */
  itemLabel?: string;
  /** Whether the accordion is expanded */
  isExpanded: boolean;
  /** Whether the source is active/enabled */
  isActive?: boolean;
  /** Last refresh timestamp (ISO string or formatted string) */
  lastRefresh?: string | null;
  /** Connection status for Xtream accounts */
  connectionStatus?: 'connected' | 'disconnected' | 'unknown';
  /** Number of orphan items (shows amber badge if > 0) */
  orphanCount?: number;
  /** Whether items are still loading */
  isCountLoading?: boolean;
  /** Loading states for actions */
  isToggling?: boolean;
  isRefreshing?: boolean;
  isDeleting?: boolean;
  /** Action callbacks */
  onToggleExpand: () => void;
  onToggleActive?: () => void;
  onRefresh?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Test IDs */
  testIdPrefix?: string;
}

export function SourceAccordionHeader({
  name,
  itemCount,
  itemLabel = 'items',
  isExpanded,
  isActive = true,
  lastRefresh,
  connectionStatus,
  orphanCount,
  isCountLoading = false,
  isToggling = false,
  isRefreshing = false,
  isDeleting = false,
  onToggleExpand,
  onToggleActive,
  onRefresh,
  onEdit,
  onDelete,
  testIdPrefix,
}: SourceAccordionHeaderProps) {
  const formatLastRefresh = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const getItemCountText = (): string => {
    if (isCountLoading) return '...';
    if (itemCount === undefined) return 'Expand to view';
    if (itemCount === 0) return `No ${itemLabel}`;
    return `${itemCount} ${itemLabel}${itemCount === 1 ? '' : 's'}`;
  };

  return (
    <div className="flex items-center bg-gray-50">
      {/* Expandable header area */}
      <button
        type="button"
        data-testid={testIdPrefix ? `${testIdPrefix}-header` : undefined}
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {/* Chevron */}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}

          {/* Name and badges */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Source name */}
            <span className="font-medium text-gray-900">{name}</span>

            {/* Item count */}
            <span
              data-testid={testIdPrefix ? `${testIdPrefix}-count` : undefined}
              className="text-sm text-gray-500"
            >
              {getItemCountText()}
            </span>

            {/* Active/Inactive status badge */}
            {isActive !== undefined && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isActive ? 'Active' : 'Inactive'}
              </span>
            )}

            {/* Connection status badge (for Xtream) */}
            {connectionStatus && (
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  connectionStatus === 'connected'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {connectionStatus}
              </span>
            )}

            {/* Orphan count badge */}
            {orphanCount !== undefined && orphanCount > 0 && (
              <span
                data-testid={testIdPrefix ? `${testIdPrefix}-orphan-count` : undefined}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
              >
                {orphanCount} orphan{orphanCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Last refresh */}
        {lastRefresh !== undefined && (
          <span className="text-xs text-gray-400">
            Last refresh: {formatLastRefresh(lastRefresh)}
          </span>
        )}
      </button>

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-2">
        {/* Toggle active button */}
        {onToggleActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive();
            }}
            disabled={isToggling}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title={isActive ? 'Disable source' : 'Enable source'}
            aria-label={isActive ? 'Disable source' : 'Enable source'}
          >
            {isToggling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isActive ? (
              <Power className="w-4 h-4" />
            ) : (
              <PowerOff className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            disabled={isRefreshing}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Edit button */}
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded transition-colors"
            title="Edit"
            aria-label="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title="Delete"
            aria-label="Delete"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
