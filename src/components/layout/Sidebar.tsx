/**
 * Sidebar Navigation Component
 * Story 1.3: Create React GUI Shell with Routing
 *
 * Dark-themed sidebar with navigation menu items
 * Supports keyboard shortcuts: Alt+1-6 for navigation, Ctrl+B to toggle
 */
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  VideoIcon,
  CalendarIcon,
  PersonIcon,
  GearIcon,
  FileTextIcon,
  HamburgerMenuIcon,
} from '@radix-ui/react-icons';
import { useAppStore } from '../../stores/appStore';
import { NAV_ITEMS } from '../../lib/routes';
import { getUnreadEventCount } from '../../lib/tauri';

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  dashboard: HomeIcon,
  tv: VideoIcon,
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
      // Alt+1-6 for navigation
      if (e.altKey && e.key >= '1' && e.key <= '6') {
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
      className={`bg-gray-900 text-white h-screen fixed left-0 top-0 transition-all duration-300 overflow-hidden ${
        sidebarOpen ? 'w-64' : 'w-16 collapsed'
      }`}
    >
      {/* Logo/Title */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        {sidebarOpen && <h1 className="text-xl font-bold">iptv</h1>}
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
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 rounded transition-colors relative ${
                      isActive
                        ? 'bg-blue-600 active'
                        : 'hover:bg-gray-800'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                  {/* Notification badge for Logs (Story 3-4: AC #5) */}
                  {showBadge && (
                    <span
                      data-testid="logs-unread-badge"
                      className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[1.25rem] text-center"
                      title={`${unreadCount} unread event${unreadCount === 1 ? '' : 's'}`}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
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
