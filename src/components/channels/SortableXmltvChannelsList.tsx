import { useRef, useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  XmltvChannelWithMappings,
  XtreamStreamMatch,
} from '../../lib/tauri';
import { SortableChannelRow } from './SortableChannelRow';
import { ChannelDragPreview } from './ChannelDragPreview';

interface SortableXmltvChannelsListProps {
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
 * SortableXmltvChannelsList component displays a sortable virtualized list of XMLTV channels
 * Uses dnd-kit for drag-and-drop reordering with TanStack Virtual for efficient rendering
 *
 * Story 3-6: Drag-and-Drop Channel Reordering
 */
export function SortableXmltvChannelsList({
  channels,
  isLoading,
  onToggleChannel,
  onSetPrimaryStream,
  onAddManualMapping,
  onRemoveMapping,
  onReorder,
}: SortableXmltvChannelsListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [updatingChannels, setUpdatingChannels] = useState<Set<number>>(new Set());
  const [togglingChannels, setTogglingChannels] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  // Configure dnd-kit sensors for accessibility and Playwright test compatibility
  // PointerSensor handles pointer events (modern browsers)
  // MouseSensor handles mouse events (fallback for tests)
  // TouchSensor handles touch events (mobile)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 0,
        tolerance: 0,
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 0,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 0,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    console.log('[DndKit] Drag start:', event.active.id);
    setActiveId(event.active.id as number);
  }, []);

  // Handle drag over for drop zone highlighting
  const handleDragOver = useCallback((event: DragOverEvent) => {
    console.log('[DndKit] Drag over:', event.over?.id);
    setOverId(event.over?.id as number | null);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      console.log('[DndKit] Drag end:', { activeId: active.id, overId: over?.id });
      setActiveId(null);
      setOverId(null);

      if (over && active.id !== over.id) {
        const oldIndex = channels.findIndex((ch) => ch.id === active.id);
        const newIndex = channels.findIndex((ch) => ch.id === over.id);
        console.log('[DndKit] Reorder:', { oldIndex, newIndex });

        if (oldIndex !== -1 && newIndex !== -1) {
          // Calculate new order
          const newOrder = arrayMove(channels, oldIndex, newIndex);
          console.log('[DndKit] New order:', newOrder.map(ch => ch.id));
          // Call reorder handler with new channel IDs
          onReorder(newOrder.map((ch) => ch.id));
        }
      }
    },
    [channels, onReorder]
  );

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

  // Keyboard navigation (non-drag)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (channels.length === 0 || activeId !== null) return;

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
    [channels, focusedIndex, handleToggleExpand, activeId]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      virtualizer.scrollToIndex(focusedIndex, { align: 'auto' });
    }
  }, [focusedIndex, virtualizer]);

  // Find active channel for drag overlay
  const activeChannel = activeId
    ? channels.find((ch) => ch.id === activeId)
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      measuring={{
        droppable: {
          strategy: 2, // Always measure droppable rects
        },
      }}
    >
      {/* Hidden keyboard instructions for screen readers */}
      <div id="keyboard-instructions" className="sr-only">
        Press Space to pick up a channel, use Arrow keys to move, and Space to drop.
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
        <SortableContext
          items={channels.map((ch) => ch.id)}
          strategy={verticalListSortingStrategy}
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
              const isDragging = activeId === channel.id;
              const isDropTarget = overId === channel.id && activeId !== null && activeId !== channel.id;

              const hasMatches = channel.matchCount > 0;
              const warningClass = !hasMatches ? 'warning bg-amber-50' : '';

              return (
                <SortableChannelRow
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
                />
              );
            })}
          </div>
        </SortableContext>
      </div>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {activeChannel ? (
          <ChannelDragPreview channel={activeChannel} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
