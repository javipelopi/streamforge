import { memo } from 'react';
import type { XtreamStreamMatch } from '../../lib/tauri';
import { formatConfidence, getQualityBadgeClasses } from '../../lib/tauri';

interface MatchedStreamsListProps {
  matches: XtreamStreamMatch[];
  onMakePrimary: (xtreamChannelId: number) => void;
  isUpdating?: boolean;
}

/**
 * MatchedStreamsList component displays the expanded view of matched Xtream streams
 * Shows stream name, quality badges, confidence, and primary/backup status
 *
 * Story 3-2: Display XMLTV Channel List with Match Status
 */
export const MatchedStreamsList = memo(function MatchedStreamsList({
  matches,
  onMakePrimary,
  isUpdating = false,
}: MatchedStreamsListProps) {
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
        {matches.map((match, index) => (
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
                disabled={isUpdating}
                className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Make Primary
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
