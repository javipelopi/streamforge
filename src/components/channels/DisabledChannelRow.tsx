import { memo } from 'react';
import { FileText, Plus } from 'lucide-react';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { TargetLineupChannel } from '../../lib/api';

interface DisabledChannelRowProps {
  channel: TargetLineupChannel;
  virtualItem: VirtualItem;
  onEnable: () => void;
}

export const DisabledChannelRow = memo(function DisabledChannelRow({
  channel,
  virtualItem,
  onEnable,
}: DisabledChannelRowProps) {
  const style = {
    transform: `translateY(${virtualItem.start}px)`,
    height: `${virtualItem.size}px`,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
  };

  return (
    <div
      data-testid={`disabled-channel-${channel.id}`}
      data-channel-id={channel.id}
      role="option"
      aria-selected={false}
      style={style}
    >
      <div className="border-b border-gray-200 bg-white hover:bg-gray-50">
        <div className="flex items-center gap-3 p-3">
          {/* Channel Logo */}
          {channel.icon ? (
            <img
              src={channel.icon}
              alt=""
              className="w-10 h-10 rounded object-contain flex-shrink-0"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
          )}

          {/* Channel Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate">
                {channel.displayName}
              </span>
              {channel.isSynthetic && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  Synthetic
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {channel.streamCount} stream{channel.streamCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Enable button */}
          <button
            data-testid={`channel-enable-${channel.id}`}
            type="button"
            onClick={onEnable}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={`Add ${channel.displayName} to lineup`}
          >
            <Plus className="w-4 h-4" />
            Enable
          </button>
        </div>
      </div>
    </div>
  );
});
