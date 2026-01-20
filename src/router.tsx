/**
 * Router Configuration for Tauri App
 * Story 1.3: Create React GUI Shell with Routing
 * Story 3-10: Added Sources view route
 *
 * Uses MemoryRouter for Tauri since there's no browser history
 */
import { createBrowserRouter, createMemoryRouter, RouteObject, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard, TargetLineup, Sources, EPG, Accounts, Settings, Logs } from './views';
import { ROUTES } from './lib/routes';

const routes: RouteObject[] = [
  {
    path: ROUTES.DASHBOARD,
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: ROUTES.TARGET_LINEUP.slice(1), element: <TargetLineup /> },
      { path: ROUTES.SOURCES.slice(1), element: <Sources /> },
      { path: ROUTES.EPG.slice(1), element: <EPG /> },
      { path: ROUTES.ACCOUNTS.slice(1), element: <Accounts /> },
      { path: ROUTES.SETTINGS.slice(1), element: <Settings /> },
      { path: ROUTES.LOGS.slice(1), element: <Logs /> },
      { path: '*', element: <Navigate to={ROUTES.DASHBOARD} replace /> },
    ],
  },
];

// Use BrowserRouter for development (Vite dev server), MemoryRouter for Tauri production
// Check for actual Tauri environment (not just mocked) by verifying we're not in browser dev/test mode
const isActualTauri =
  typeof window !== 'undefined' &&
  '__TAURI_INTERNALS__' in window &&
  // In actual Tauri, there's no browser history/location handling needed
  // In tests with mocked Tauri, we still need BrowserRouter for URL assertions
  window.location.protocol !== 'http:' &&
  window.location.protocol !== 'https:';

export const router = isActualTauri
  ? createMemoryRouter(routes)
  : createBrowserRouter(routes);
