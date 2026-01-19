/**
 * Sidebar Navigation Component
 * Story 1.3: Create React GUI Shell with Routing
 *
 * Dark-themed sidebar with navigation menu items
 * Supports keyboard shortcuts: Alt+1-6 for navigation, Ctrl+B to toggle
 */
import type { ComponentType } from 'react';
import { useEffect } from 'react';
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
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 rounded transition-colors ${
                      isActive
                        ? 'bg-blue-600 active'
                        : 'hover:bg-gray-800'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
