/**
 * MainLayout Component
 * Story 1.3: Create React GUI Shell with Routing
 *
 * Shell layout with sidebar, header, and main content area
 */
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../../stores/appStore';

export function MainLayout() {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-16'
        }`}
      >
        <Header />
        <main data-testid="main-content" className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
