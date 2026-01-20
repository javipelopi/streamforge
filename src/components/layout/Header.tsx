/**
 * Header Component
 * Story 1.3: Create React GUI Shell with Routing
 *
 * Displays app title and status indicator
 */
import { StatusIndicator } from '../ui/StatusIndicator';
import { useAppStore } from '../../stores/appStore';

export function Header() {
  const serverStatus = useAppStore((state) => state.serverStatus);

  return (
    <header
      data-testid="app-header"
      className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6"
    >
      <h1 className="text-lg font-semibold text-gray-900">StreamForge</h1>
      <div className="flex items-center gap-4">
        <StatusIndicator status={serverStatus} />
      </div>
    </header>
  );
}
