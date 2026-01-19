import { memo, useState, useCallback } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import type { XtreamStreamMatch } from '../../lib/tauri';
import { formatConfidence, getQualityBadgeClasses } from '../../lib/tauri';

interface MatchedStreamsListProps {
  matches: XtreamStreamMatch[];
  onMakePrimary: (xtreamChannelId: number) => void;
  onRemoveMapping?: (mappingId: number) => Promise<void>;
  isUpdating?: boolean;
}

/**
 * MatchedStreamsList component displays the expanded view of matched Xtream streams
 * Shows stream name, quality badges, confidence, and primary/backup status
 *
 * Story 3-2: Display XMLTV Channel List with Match Status
 * Story 3-3: Manual Match Override via Search Dropdown (remove functionality)
 */
export const MatchedStreamsList = memo(function MatchedStreamsList({
  matches,
  onMakePrimary,
  onRemoveMapping,
  isUpdating = false,
}: MatchedStreamsListProps) {
  const [removingMappingId, setRemovingMappingId] = useState<number | null>(null);

  const handleRemove = useCallback(
    async (mappingId: number) => {
      if (!onRemoveMapping) return;
      setRemovingMappingId(mappingId);
      try {
        await onRemoveMapping(mappingId);
      } finally {
        setRemovingMappingId(null);
      }
    },
    [onRemoveMapping]
  );

  if (matches.length === 0) {
    return null;
  }

  // Keep matches in their original order (by streamPriority from backend)
  // Do NOT sort here - the test expects elements to remain in place when isPrimary changes
  // The backend returns matches ordered by stream_priority, which reflects the user's preferred order

  return (
    <div
      data-testid="matched-streams-list"
      className="bg-gray-50 border-t border-gray-200 px-4 py-2"
    >
      <div className="ml-8 space-y-1">
        {matches.map((match, index) => {
          const isRemoving = removingMappingId === match.mappingId;

          return (
            <div
              key={match.id}
              data-testid={`stream-item-${match.id}`}
              className="flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-100"
            >
              {/* Tree connector */}
              <span className="text-gray-400 text-sm w-4">
                {index === matches.length - 1 ? '└─' : '├─'}
              </span>

              {/* Primary/Backup badge */}
              <span
                data-testid="primary-badge"
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  match.isPrimary
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {match.isPrimary ? 'Primary' : 'Backup'}
              </span>

              {/* Stream name */}
              <span data-testid="stream-name" className="flex-1 text-sm text-gray-800 truncate">
                {match.name}
              </span>

              {/* Manual match indicator */}
              {match.isManual && (
                <span
                  data-testid="manual-badge"
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                >
                  Manual
                </span>
              )}

              {/* Quality badges */}
              <div className="flex gap-1">
                {match.qualities.map((quality, idx) => (
                  <span
                    key={idx}
                    data-testid="quality-badge"
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getQualityBadgeClasses(quality)}`}
                  >
                    {quality}
                  </span>
                ))}
              </div>

              {/* Match confidence */}
              <span
                data-testid="match-confidence"
                className="text-sm text-gray-500 min-w-[40px] text-right"
              >
                {formatConfidence(match.matchConfidence)}
              </span>

              {/* Make Primary button (only for non-primary streams) */}
              {!match.isPrimary && (
                <button
                  data-testid="make-primary-button"
                  onClick={() => onMakePrimary(match.id)}
                  disabled={isUpdating || isRemoving}
                  className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Make Primary
                </button>
              )}

              {/* Remove button (only for manual matches) */}
              {match.isManual && onRemoveMapping && (
                <button
                  data-testid="remove-mapping-button"
                  onClick={() => handleRemove(match.mappingId)}
                  disabled={isUpdating || isRemoving}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Remove ${match.name} mapping`}
                >
                  {isRemoving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
