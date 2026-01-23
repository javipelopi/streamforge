/**
 * MainLayout Component
 * Story 1.3: Create React GUI Shell with Routing
 *
 * Shell layout with sidebar, header, and main content area.
 * Supports full-screen mode for immersive views like EPG (no header, no padding).
 */
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../../stores/appStore';
import { ROUTES } from '../../lib/routes';

/** Routes that should render in full-screen mode (no header, no padding) */
const FULL_SCREEN_ROUTES = [ROUTES.EPG, ROUTES.EPG_TV];

export function MainLayout() {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const location = useLocation();

  // Check if current route should be full-screen (no header, no padding)
  const isFullScreen = FULL_SCREEN_ROUTES.includes(location.pathname as typeof ROUTES.EPG);

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-16'
        }`}
      >
        {!isFullScreen && <Header />}
        <main
          data-testid="main-content"
          className={`flex-1 min-h-0 flex flex-col ${isFullScreen ? '' : 'p-6'}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
