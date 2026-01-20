import { useRef, useState, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  XmltvChannelWithMappings,
  XtreamStreamMatch,
} from '../../lib/tauri';
import { DraggableChannelRow } from './DraggableChannelRow';
import { ChannelDragPreview } from './ChannelDragPreview';

/**
 * Move an item from one position to another in an array
 */
function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  const [item] = newArray.splice(from, 1);
  newArray.splice(to, 0, item);
  return newArray;
}

interface DraggableXmltvChannelsListProps {
  channels: XmltvChannelWithMappings[];
  isLoading: boolean;
  onToggleChannel: (channelId: number) => void;
  onSetPrimaryStream: (xmltvChannelId: number, xtreamChannelId: number) => Promise<XtreamStreamMatch[]>;
  onAddManualMapping: (
    xmltvChannelId: number,
    xtreamChannelId: number,
    setAsPrimary: boolean
  ) => Promise<XtreamStreamMatch[]>;
  onRemoveMapping: (mappingId: number) => Promise<XtreamStreamMatch[]>;
  onReorder: (channelIds: number[]) => void;
}

// Row heights for virtualization
const COLLAPSED_ROW_HEIGHT = 72;
const EXPANDED_STREAM_HEIGHT = 44;
const EXPANDED_HEADER_HEIGHT = 16;

/**
 * DraggableXmltvChannelsList component displays a virtualized list of XMLTV channels
 * with native HTML5 drag-and-drop for Playwright compatibility
 *
 * Story 3-6: Drag-and-Drop Channel Reordering
 */
export function DraggableXmltvChannelsList({
  channels,
  isLoading,
  onToggleChannel,
  onSetPrimaryStream,
  onAddManualMapping,
  onRemoveMapping,
  onReorder,
}: DraggableXmltvChannelsListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [updatingChannels, setUpdatingChannels] = useState<Set<number>>(new Set());
  const [togglingChannels, setTogglingChannels] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  // Mouse-based drag state (for Playwright tests using page.mouse.down/hover)
  const [mouseDraggedId, setMouseDraggedId] = useState<number | null>(null);
  const [mouseOverId, setMouseOverId] = useState<number | null>(null);
  // Keyboard reordering state (Space + Arrow keys)
  const [keyboardPickedId, setKeyboardPickedId] = useState<number | null>(null);
  // ARIA live region message for screen readers
  const [ariaMessage, setAriaMessage] = useState<string>('');

  // Calculate row height based on expanded state
  const getRowHeight = useCallback(
    (index: number) => {
      const channel = channels[index];
      if (!channel) return COLLAPSED_ROW_HEIGHT;

      if (expandedRows.has(channel.id)) {
        const matchCount = channel.matches.length;
        return (
          COLLAPSED_ROW_HEIGHT +
          EXPANDED_HEADER_HEIGHT +
          matchCount * EXPANDED_STREAM_HEIGHT
        );
      }
      return COLLAPSED_ROW_HEIGHT;
    },
    [channels, expandedRows]
  );

  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getRowHeight,
    overscan: 5,
  });

  // Recalculate sizes when expanded rows change
  useEffect(() => {
    virtualizer.measure();
  }, [expandedRows, virtualizer]);

  // Handle HTML5 drag start
  const handleDragStart = useCallback((channelId: number) => {
    const channel = channels.find(ch => ch.id === channelId);
    if (channel) {
      setAriaMessage(`Dragging ${channel.displayName}`);
    }
    setDraggedId(channelId);
  }, [channels]);

  // Handle HTML5 drag over
  const handleDragOver = useCallback((channelId: number) => {
    if (draggedId !== null && channelId !== draggedId) {
      setOverId(channelId);
    }
  }, [draggedId]);

  // Handle HTML5 drag end
  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setOverId(null);
  }, []);

  // Handle HTML5 drop
  const handleDrop = useCallback((targetChannelId: number) => {
    if (draggedId !== null && draggedId !== targetChannelId) {
      const oldIndex = channels.findIndex((ch) => ch.id === draggedId);
      const newIndex = channels.findIndex((ch) => ch.id === targetChannelId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const draggedChannel = channels[oldIndex];
        const targetChannel = channels[newIndex];
        setAriaMessage(`Moved ${draggedChannel.displayName} to position ${newIndex + 1}, before ${targetChannel.displayName}`);
        const newOrder = arrayMove(channels, oldIndex, newIndex);
        onReorder(newOrder.map((ch) => ch.id));
      }
    }
    setDraggedId(null);
    setOverId(null);
  }, [draggedId, channels, onReorder]);

  // Mouse-based drag start (for Playwright tests using page.mouse.down)
  const handleMouseDragStart = useCallback((channelId: number) => {
    setMouseDraggedId(channelId);
  }, []);

  // Mouse-based drag over (for Playwright tests using hover during mousedown)
  const handleMouseDragOver = useCallback((channelId: number) => {
    if (mouseDraggedId !== null && channelId !== mouseDraggedId) {
      setMouseOverId(channelId);
    }
  }, [mouseDraggedId]);

  // Global mouse up listener to clear mouse drag state
  useEffect(() => {
    const handleMouseUp = () => {
      if (mouseDraggedId !== null) {
        setMouseDraggedId(null);
        setMouseOverId(null);
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [mouseDraggedId]);

  // Keyboard pick (Space to select item for reordering)
  const handleKeyboardPick = useCallback((channelId: number) => {
    const channel = channels.find(ch => ch.id === channelId);
    if (channel) {
      setAriaMessage(`Picked up ${channel.displayName}. Use arrow keys to move, space to drop.`);
    }
    setKeyboardPickedId(channelId);
  }, [channels]);

  // Keyboard drop (Space to drop item)
  const handleKeyboardDrop = useCallback(() => {
    if (keyboardPickedId !== null) {
      const channel = channels.find(ch => ch.id === keyboardPickedId);
      if (channel) {
        setAriaMessage(`Dropped ${channel.displayName}`);
      }
    }
    setKeyboardPickedId(null);
  }, [keyboardPickedId, channels]);

  // Keyboard move (Arrow keys to reorder)
  const handleKeyboardMove = useCallback((_channelId: number, direction: 'up' | 'down') => {
    if (keyboardPickedId === null) {
      return;
    }
    const currentIndex = channels.findIndex((ch) => ch.id === keyboardPickedId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < channels.length) {
      const newOrder = arrayMove(channels, currentIndex, newIndex);
      onReorder(newOrder.map((ch) => ch.id));
    }
  }, [keyboardPickedId, channels, onReorder]);

  // Handle expand/collapse
  const handleToggleExpand = useCallback((channelId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }, []);

  // Handle toggle channel
  const handleToggleChannel = useCallback(
    async (channelId: number) => {
      setTogglingChannels((prev) => new Set(prev).add(channelId));
      try {
        await onToggleChannel(channelId);
      } finally {
        setTogglingChannels((prev) => {
          const next = new Set(prev);
          next.delete(channelId);
          return next;
        });
      }
    },
    [onToggleChannel]
  );

  // Handle make primary
  const handleMakePrimary = useCallback(
    async (xmltvChannelId: number, xtreamChannelId: number) => {
      setUpdatingChannels((prev) => new Set(prev).add(xmltvChannelId));
      try {
        await onSetPrimaryStream(xmltvChannelId, xtreamChannelId);
      } finally {
        setUpdatingChannels((prev) => {
          const next = new Set(prev);
          next.delete(xmltvChannelId);
          return next;
        });
      }
    },
    [onSetPrimaryStream]
  );

  // Handle add manual mapping
  const handleAddManualMapping = useCallback(
    async (
      xmltvChannelId: number,
      xtreamChannelId: number,
      setAsPrimary: boolean
    ) => {
      setUpdatingChannels((prev) => new Set(prev).add(xmltvChannelId));
      try {
        const result = await onAddManualMapping(xmltvChannelId, xtreamChannelId, setAsPrimary);
        setExpandedRows((prev) => new Set(prev).add(xmltvChannelId));
        return result;
      } finally {
        setUpdatingChannels((prev) => {
          const next = new Set(prev);
          next.delete(xmltvChannelId);
          return next;
        });
      }
    },
    [onAddManualMapping]
  );

  // Handle remove mapping
  const handleRemoveMapping = useCallback(
    async (xmltvChannelId: number, mappingId: number) => {
      setUpdatingChannels((prev) => new Set(prev).add(xmltvChannelId));
      try {
        await onRemoveMapping(mappingId);
      } finally {
        setUpdatingChannels((prev) => {
          const next = new Set(prev);
          next.delete(xmltvChannelId);
          return next;
        });
      }
    },
    [onRemoveMapping]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (channels.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, channels.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < channels.length) {
            const channel = channels[focusedIndex];
            if (channel.matchCount > 0) {
              handleToggleExpand(channel.id);
            }
          }
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(channels.length - 1);
          break;
      }
    },
    [channels, focusedIndex, handleToggleExpand]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      virtualizer.scrollToIndex(focusedIndex, { align: 'auto' });
    }
  }, [focusedIndex, virtualizer]);

  // Find active channel for drag overlay (support both HTML5 and mouse drag)
  const activeDragId = draggedId || mouseDraggedId;
  const activeChannel = activeDragId
    ? channels.find((ch) => ch.id === activeDragId)
    : null;

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="xmltv-channels-list"
        className="flex items-center justify-center h-64 text-gray-500"
      >
        <span className="animate-pulse">Loading XMLTV channels...</span>
      </div>
    );
  }

  // Empty state
  if (channels.length === 0) {
    return (
      <div
        data-testid="xmltv-channels-list"
        className="flex flex-col items-center justify-center h-64 text-gray-500"
      >
        <p className="text-lg">No XMLTV channels found</p>
        <p className="text-sm mt-1">
          Add an EPG source and refresh to see channels
        </p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <>
      {/* Hidden keyboard instructions for screen readers */}
      <div id="keyboard-instructions" className="sr-only">
        Use arrow keys to navigate. Drag and drop to reorder channels.
      </div>

      {/* ARIA live region for drag-and-drop announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {ariaMessage}
      </div>

      <div
        ref={parentRef}
        data-testid="xmltv-channels-list"
        role="listbox"
        aria-label="XMLTV Channels"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="h-[500px] overflow-auto focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
      >
        <div
          className="relative w-full"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualItems.map((virtualItem) => {
            const channel = channels[virtualItem.index];
            const isExpanded = expandedRows.has(channel.id);
            const isUpdating = updatingChannels.has(channel.id);
            const isToggling = togglingChannels.has(channel.id);
            const isFocused = focusedIndex === virtualItem.index;
            // Combine HTML5 drag and mouse drag states
            const isDragging = draggedId === channel.id || mouseDraggedId === channel.id;
            const isDropTarget =
              (overId === channel.id && draggedId !== null && draggedId !== channel.id) ||
              (mouseOverId === channel.id && mouseDraggedId !== null && mouseDraggedId !== channel.id);
            const isMouseDragging = mouseDraggedId !== null;

            const hasMatches = channel.matchCount > 0;
            const warningClass = !hasMatches ? 'warning bg-amber-50' : '';

            return (
              <DraggableChannelRow
                key={channel.id}
                channel={channel}
                isExpanded={isExpanded}
                isFocused={isFocused}
                isDragging={isDragging}
                isDropTarget={isDropTarget}
                warningClass={warningClass}
                virtualItem={virtualItem}
                onToggleExpand={() => handleToggleExpand(channel.id)}
                onToggleEnabled={() => handleToggleChannel(channel.id)}
                isTogglingEnabled={isToggling}
                onMakePrimary={(xtreamId) => handleMakePrimary(channel.id, xtreamId)}
                onRemoveMapping={(mappingId) => handleRemoveMapping(channel.id, mappingId)}
                onAddStream={handleAddManualMapping}
                isUpdating={isUpdating}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                onMouseDragStart={handleMouseDragStart}
                onMouseDragOver={handleMouseDragOver}
                onKeyboardPick={handleKeyboardPick}
                onKeyboardDrop={handleKeyboardDrop}
                onKeyboardMove={handleKeyboardMove}
                isMouseDragging={isMouseDragging}
                isKeyboardPicked={keyboardPickedId === channel.id}
              />
            );
          })}
        </div>
      </div>

      {/* Drag overlay for visual feedback */}
      {activeChannel && (
        <div
          data-testid="drag-overlay"
          className="fixed pointer-events-none z-50"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <ChannelDragPreview channel={activeChannel} />
        </div>
      )}
    </>
  );
}
