import { memo } from 'react';
import { FileText, GripVertical } from 'lucide-react';
import type { XmltvChannelWithMappings } from '../../lib/tauri';

interface ChannelDragPreviewProps {
  channel: XmltvChannelWithMappings;
}

/**
 * ChannelDragPreview component displays a preview of the channel being dragged
 * Shown in the DragOverlay for visual feedback during drag operations
 *
 * Story 3-6: Drag-and-Drop Channel Reordering
 */
export const ChannelDragPreview = memo(function ChannelDragPreview({
  channel,
}: ChannelDragPreviewProps) {
  const hasMatches = channel.matchCount > 0;
  const rowClasses = hasMatches
    ? 'bg-white'
    : 'bg-amber-50';

  return (
    <div
      data-testid="drag-preview"
      className={`${rowClasses} border border-gray-300 rounded-lg shadow-xl opacity-90 p-3`}
      style={{ width: '400px' }}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle icon */}
        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />

        {/* Channel Logo */}
        {channel.icon ? (
          <img
            src={channel.icon}
            alt=""
            className="w-10 h-10 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
        )}

        {/* Channel name */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900 truncate block">
            {channel.displayName}
          </span>
          <span className="text-sm text-gray-500">
            {hasMatches ? `${channel.matchCount} stream${channel.matchCount !== 1 ? 's' : ''}` : 'No stream'}
          </span>
        </div>

        {/* XMLTV badge */}
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
          XMLTV
        </span>
      </div>
    </div>
  );
});
