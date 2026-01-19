/**
 * Router Configuration for Tauri App
 * Story 1.3: Create React GUI Shell with Routing
 *
 * Uses MemoryRouter for Tauri since there's no browser history
 */
import { createBrowserRouter, createMemoryRouter, RouteObject } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard, Channels, EPG, Accounts, Settings, Logs } from './views';
import { ROUTES } from './lib/routes';

const routes: RouteObject[] = [
  {
    path: ROUTES.DASHBOARD,
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: ROUTES.CHANNELS.slice(1), element: <Channels /> },
      { path: ROUTES.EPG.slice(1), element: <EPG /> },
      { path: ROUTES.ACCOUNTS.slice(1), element: <Accounts /> },
      { path: ROUTES.SETTINGS.slice(1), element: <Settings /> },
      { path: ROUTES.LOGS.slice(1), element: <Logs /> },
    ],
  },
];

// Use BrowserRouter for development (Vite dev server), MemoryRouter for Tauri production
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

export const router = isTauri
  ? createMemoryRouter(routes)
  : createBrowserRouter(routes);
