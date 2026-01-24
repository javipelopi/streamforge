/**
 * Sidebar Navigation Component
 * Story 1.3: Create React GUI Shell with Routing
 * Story 3-9: Updated for Target Lineup navigation
 * Story 3-10: Added Sources navigation item
 *
 * Dark-themed sidebar with navigation menu items
 * Supports keyboard shortcuts: Alt+1-7 for navigation, Ctrl+B to toggle
 */
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  CalendarIcon,
  PersonIcon,
  GearIcon,
  FileTextIcon,
  HamburgerMenuIcon,
} from '@radix-ui/react-icons';
import { ListChecks, Database } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { NAV_ITEMS } from '../../lib/routes';
import { getUnreadEventCount } from '../../lib/tauri';

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  dashboard: HomeIcon,
  listChecks: ListChecks,
  database: Database,
  calendar: CalendarIcon,
  person: PersonIcon,
  gear: GearIcon,
  file: FileTextIcon,
};

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Fetch unread count on mount and set up polling (Story 3-4: AC #5)
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const count = await getUnreadEventCount();
        setUnreadCount(count);
      } catch (error) {
        console.error('Failed to fetch unread event count:', error);
      }
    };

    // Fetch immediately
    fetchUnreadCount();

    // Poll every 10 seconds for updates
    const interval = setInterval(fetchUnreadCount, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleKeyDown = (e: any) => {
      // Alt+1-7 for navigation
      if (e.altKey && e.key >= '1' && e.key <= '7') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (NAV_ITEMS[index]) {
          navigate(NAV_ITEMS[index].path);
        }
      }
      // Ctrl+B (or Cmd+B on Mac) to toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, toggleSidebar]);

  return (
    <aside
      data-testid="sidebar"
      className={`bg-gray-900 text-white h-screen fixed left-0 top-0 z-50 transition-all duration-300 overflow-hidden ${
        sidebarOpen ? 'w-64' : 'w-16 collapsed'
      }`}
    >
      {/* Logo/Title */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        {sidebarOpen && <h1 className="text-xl font-bold">StreamForge</h1>}
        <button
          data-testid="sidebar-toggle"
          onClick={toggleSidebar}
          className="p-2 rounded hover:bg-gray-800 transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <HamburgerMenuIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4" role="navigation" aria-label="Main navigation">
        <ul className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon] || HomeIcon;
            const isLogsItem = item.path === '/logs';
            const showBadge = isLogsItem && unreadCount > 0;

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  data-testid={item.testId}
                  aria-label={item.ariaLabel}
                  className={({ isActive }) =>
                    `flex items-center py-2 rounded transition-colors relative ${
                      sidebarOpen ? 'gap-3 px-4' : 'justify-center px-2'
                    } ${
                      isActive
                        ? 'bg-blue-600 active'
                        : 'hover:bg-gray-800'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                  {/* Notification badge for Logs (Story 6-4: AC #2) - show even when sidebar collapsed */}
                  {showBadge && (
                    <span
                      data-testid="logs-unread-badge"
                      className={`bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] text-center ${
                        sidebarOpen ? 'ml-auto px-2 py-0.5' : 'absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center'
                      }`}
                      title={`${unreadCount} unread event${unreadCount === 1 ? '' : 's'}`}
                    >
                      {sidebarOpen ? (unreadCount > 99 ? '99+' : unreadCount) : ''}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
