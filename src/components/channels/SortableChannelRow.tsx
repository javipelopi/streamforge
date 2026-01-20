import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as Switch from '@radix-ui/react-switch';
import { ChevronDown, ChevronRight, AlertTriangle, FileText, GripVertical } from 'lucide-react';
import type { XmltvChannelWithMappings, XtreamStreamMatch } from '../../lib/tauri';
import { formatConfidence, getMatchCountLabel } from '../../lib/tauri';
import { MatchedStreamsList } from './MatchedStreamsList';
import { AddStreamButton } from './AddStreamButton';
import type { VirtualItem } from '@tanstack/react-virtual';

interface SortableChannelRowProps {
  channel: XmltvChannelWithMappings;
  isExpanded: boolean;
  isFocused: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  warningClass: string;
  virtualItem: VirtualItem;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  isTogglingEnabled?: boolean;
  onMakePrimary: (xtreamId: number) => void;
  onRemoveMapping: (mappingId: number) => Promise<void>;
  onAddStream: (
    xmltvChannelId: number,
    xtreamChannelId: number,
    setAsPrimary: boolean
  ) => Promise<XtreamStreamMatch[]>;
  isUpdating: boolean;
}

/**
 * SortableChannelRow component displays a single sortable XMLTV channel row
 * Uses dnd-kit useSortable hook for drag-and-drop functionality
 *
 * Story 3-6: Drag-and-Drop Channel Reordering
 */
export const SortableChannelRow = memo(function SortableChannelRow({
  channel,
  isExpanded,
  isFocused,
  isDragging,
  isDropTarget,
  warningClass,
  virtualItem,
  onToggleExpand,
  onToggleEnabled,
  isTogglingEnabled = false,
  onMakePrimary,
  onRemoveMapping,
  onAddStream,
  isUpdating,
}: SortableChannelRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: channel.id });

  // Combine dnd-kit transform with virtualization positioning
  const combinedTransform = transform
    ? `translateY(${virtualItem.start}px) ${CSS.Transform.toString(transform)}`
    : `translateY(${virtualItem.start}px)`;

  const style = {
    transform: combinedTransform,
    transition,
    height: `${virtualItem.size}px`,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
  };

  const hasMatches = channel.matchCount > 0;
  const primaryMatch = channel.matches.find((m) => m.isPrimary);

  // Determine row styling
  const rowClasses = hasMatches
    ? 'bg-white hover:bg-gray-50'
    : 'bg-amber-50 hover:bg-amber-100 warning';

  return (
    <div
      ref={setNodeRef}
      data-testid={`channel-row-${channel.id}`}
      data-index={virtualItem.index}
      data-dragging={isDragging ? 'true' : undefined}
      data-drop-target={isDropTarget ? 'true' : undefined}
      role="option"
      aria-expanded={isExpanded}
      aria-selected={isFocused}
      className={`${warningClass} ${isFocused ? 'ring-2 ring-blue-500 ring-inset z-10' : ''} ${
        isDragging ? 'opacity-50 z-20 shadow-lg' : ''
      } ${isDropTarget ? 'border-t-2 border-blue-500' : ''}`}
      style={style}
    >
      <div
        className={`border-b border-gray-200 ${rowClasses}`}
        aria-describedby={!hasMatches ? `warning-${channel.id}` : undefined}
      >
        {/* Main row content */}
        <div className="flex items-center gap-3 p-3">
          {/* Drag handle */}
          <div
            data-testid="drag-handle"
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200 flex-shrink-0 touch-none"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            aria-describedby="keyboard-instructions"
            role="button"
            tabIndex={0}
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>

          {/* Expand/collapse button */}
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

              <span
                data-testid="source-icon-xmltv"
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                title="XMLTV Channel"
              >
                XMLTV
              </span>
            </div>

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
            {!hasMatches && (
              <AlertTriangle
                data-testid="warning-icon"
                className="w-5 h-5 text-amber-500"
                aria-label="No stream matched"
              />
            )}

            {hasMatches ? (
              <span
                data-testid="match-count-badge"
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
              >
                {getMatchCountLabel(channel.matchCount)}
              </span>
            ) : (
              <span
                id={`warning-${channel.id}`}
                data-testid="match-status"
                className="text-sm text-amber-600 font-medium"
                role="status"
              >
                No stream matched
              </span>
            )}

            {primaryMatch && (
              <span
                data-testid="primary-stream-confidence"
                className="text-sm text-gray-500 min-w-[40px] text-right"
              >
                {formatConfidence(primaryMatch.matchConfidence)}
              </span>
            )}

            {primaryMatch && (
              <span
                data-testid="primary-stream-name"
                className="hidden sm:inline text-sm text-gray-600 truncate max-w-[150px]"
              >
                {primaryMatch.name}
              </span>
            )}

            {/* Add Stream Button */}
            <AddStreamButton
              xmltvChannelId={channel.id}
              xmltvChannelName={channel.displayName}
              onAddStream={onAddStream}
              disabled={isUpdating}
            />

            {/* Enable/disable toggle */}
            <div
              title={!channel.isEnabled && !hasMatches ? 'No stream source available' : undefined}
            >
              <Switch.Root
                data-testid="channel-toggle"
                checked={channel.isEnabled}
                onCheckedChange={onToggleEnabled}
                disabled={isTogglingEnabled || (!channel.isEnabled && !hasMatches)}
                className="w-10 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={channel.isEnabled ? 'Disable channel' : 'Enable channel'}
              >
                <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
              </Switch.Root>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded matched streams */}
      {isExpanded && channel.matches.length > 0 && (
        <MatchedStreamsList
          matches={channel.matches}
          onMakePrimary={onMakePrimary}
          onRemoveMapping={onRemoveMapping}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
});
