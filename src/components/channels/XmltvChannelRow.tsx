import { memo } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { ChevronDown, ChevronRight, AlertTriangle, FileText } from 'lucide-react';
import type { XmltvChannelWithMappings } from '../../lib/tauri';
import { formatConfidence, getMatchCountLabel } from '../../lib/tauri';

interface XmltvChannelRowProps {
  channel: XmltvChannelWithMappings;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  style?: React.CSSProperties;
}

/**
 * XmltvChannelRow component displays a single XMLTV channel row
 * Shows channel info, match status, and enable/disable toggle
 *
 * Story 3-2: Display XMLTV Channel List with Match Status
 */
export const XmltvChannelRow = memo(function XmltvChannelRow({
  channel,
  isExpanded,
  onToggleExpand,
  onToggleEnabled,
  style,
}: XmltvChannelRowProps) {
  const hasMatches = channel.matchCount > 0;
  const primaryMatch = channel.matches.find(m => m.isPrimary);

  // Determine row styling based on match status
  const rowClasses = hasMatches
    ? 'bg-white hover:bg-gray-50'
    : 'bg-amber-50 hover:bg-amber-100 warning';

  return (
    <div
      className={`border-b border-gray-200 ${rowClasses}`}
      style={style}
    >
      {/* Main row content */}
      <div className="flex items-center gap-3 p-3">
        {/* Expand/collapse button (only show if has matches) */}
        {hasMatches ? (
          <button
            data-testid="expand-button"
            onClick={onToggleExpand}
            className="p-1 rounded hover:bg-gray-200 flex-shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <div className="w-6 flex-shrink-0" /> // Spacer for alignment
        )}

        {/* Channel Logo */}
        {channel.icon ? (
          <img
            data-testid="channel-logo"
            src={channel.icon}
            alt=""
            className="w-10 h-10 rounded object-cover flex-shrink-0"
            loading="lazy"
            onError={(e) => {
              // Hide broken images
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            data-testid="channel-logo"
            className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0"
          >
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
        )}

        {/* Channel Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span data-testid="channel-name" className="font-medium text-gray-900 truncate">
              {channel.displayName}
            </span>

            {/* XMLTV source icon */}
            <span
              data-testid="source-icon-xmltv"
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
              title="XMLTV Channel"
            >
              XMLTV
            </span>
          </div>

          {/* Secondary info row */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {hasMatches && primaryMatch ? (
              <span>Primary: {primaryMatch.name}</span>
            ) : (
              <span className={hasMatches ? '' : 'text-amber-600'}>
                {hasMatches ? 'Matched' : 'Disabled'}
              </span>
            )}
          </div>
        </div>

        {/* Match status section */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Warning icon for unmatched */}
          {!hasMatches && (
            <AlertTriangle
              data-testid="warning-icon"
              className="w-5 h-5 text-amber-500"
              aria-label="No stream matched"
            />
          )}

          {/* Match count badge or no match status */}
          {hasMatches ? (
            <span
              data-testid="match-count-badge"
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
            >
              {getMatchCountLabel(channel.matchCount)}
            </span>
          ) : (
            <span
              data-testid="match-status"
              className="text-sm text-amber-600 font-medium"
            >
              No stream matched
            </span>
          )}

          {/* Primary stream confidence */}
          {primaryMatch && (
            <span
              data-testid="primary-stream-confidence"
              className="text-sm text-gray-500 min-w-[40px] text-right"
            >
              {formatConfidence(primaryMatch.matchConfidence)}
            </span>
          )}

          {/* Primary stream name (visible in collapsed state) */}
          {primaryMatch && (
            <span
              data-testid="primary-stream-name"
              className="hidden sm:inline text-sm text-gray-600 truncate max-w-[150px]"
            >
              {primaryMatch.name}
            </span>
          )}

          {/* Enable/disable toggle */}
          <Switch.Root
            data-testid="channel-toggle"
            checked={channel.isEnabled}
            onCheckedChange={onToggleEnabled}
            className="w-10 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={channel.isEnabled ? 'Disable channel' : 'Enable channel'}
          >
            <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
          </Switch.Root>
        </div>
      </div>
    </div>
  );
});
