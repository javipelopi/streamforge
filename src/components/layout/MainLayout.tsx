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
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-16'
        }`}
      >
        <Header />
        <main data-testid="main-content" className="flex-1 p-6 min-h-0 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
