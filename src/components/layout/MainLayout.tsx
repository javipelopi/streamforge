/**
 * MainLayout Component
 * Story 1.3: Create React GUI Shell with Routing
 * Story 6-5: Auto-check for updates on startup
 *
 * Shell layout with sidebar, header, and main content area.
 * Supports full-screen mode for immersive views like EPG (no header, no padding).
 * Performs auto-update check on startup if enabled.
 */
import { useEffect, useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../../stores/appStore';
import { ROUTES } from '../../lib/routes';
import {
  UpdateInfo,
  getUpdateSettings,
  checkForUpdate,
} from '../../lib/tauri';
import { UpdateNotificationDialog } from '../settings/UpdateNotificationDialog';

/** Routes that should render in full-screen mode (no header, no padding) */
const FULL_SCREEN_ROUTES = [ROUTES.EPG, ROUTES.EPG_TV];

/** Session storage key for update snooze */
const UPDATE_SNOOZED_KEY = 'update_snoozed';

export function MainLayout() {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const location = useLocation();

  // Auto-update check state (Story 6-5)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Check for current route should be full-screen (no header, no padding)
  const isFullScreen = FULL_SCREEN_ROUTES.includes(location.pathname as typeof ROUTES.EPG);

  // Auto-check for updates on startup (Story 6-5, AC #4)
  useEffect(() => {
    if (hasChecked) return;

    const performAutoCheck = async () => {
      try {
        // Check if auto-check is enabled
        const settings = await getUpdateSettings();
        if (!settings.autoCheck) {
          setHasChecked(true);
          return;
        }

        // Check if update was snoozed in this session
        const snoozed = sessionStorage.getItem(UPDATE_SNOOZED_KEY);
        if (snoozed) {
          setHasChecked(true);
          return;
        }

        // Small delay to let the app settle before checking
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Check for updates
        const info = await checkForUpdate();
        setUpdateInfo(info);

        // Show dialog if update is available
        if (info.available) {
          setShowUpdateDialog(true);
        }
      } catch (err) {
        // Silently fail - auto-check errors shouldn't interrupt the user
        console.warn('Auto-update check failed:', err);
      } finally {
        setHasChecked(true);
      }
    };

    performAutoCheck();
  }, [hasChecked]);

  // Handle "Remind Later" - snooze for this session
  const handleRemindLater = useCallback(() => {
    sessionStorage.setItem(UPDATE_SNOOZED_KEY, 'true');
    setShowUpdateDialog(false);
  }, []);

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

      {/* Update notification dialog (Story 6-5) */}
      {showUpdateDialog && updateInfo && (
        <UpdateNotificationDialog
          updateInfo={updateInfo}
          onRemindLater={handleRemindLater}
        />
      )}
    </div>
  );
}
