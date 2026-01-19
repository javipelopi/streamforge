/**
 * StatusIndicator Component
 * Story 1.3: Create React GUI Shell with Routing
 *
 * Displays server status with color-coded indicator and tooltip
 * Note: Removed continuous pulse animation for better performance
 */
import * as Tooltip from '@radix-ui/react-tooltip';
import { ServerStatus } from '../../stores/appStore';

interface StatusIndicatorProps {
  status: ServerStatus;
  className?: string;
}

const statusConfig: Record<
  ServerStatus,
  { colorClass: string; label: string }
> = {
  running: {
    colorClass: 'bg-green-500',
    label: 'Running',
  },
  stopped: {
    colorClass: 'bg-gray-400',
    label: 'Stopped',
  },
  error: {
    colorClass: 'bg-red-500',
    label: 'Error',
  },
};

export function StatusIndicator({ status, className = '' }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div
            data-testid="status-indicator"
            role="status"
            aria-label={`Server status: ${config.label}`}
            aria-live="polite"
            className={`w-3 h-3 rounded-full ${config.colorClass} ${className}`}
          />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white px-2 py-1 text-sm rounded shadow-lg"
            sideOffset={5}
          >
            {config.label}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
