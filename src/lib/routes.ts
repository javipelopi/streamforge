/**
 * Route constants for type-safe navigation
 * Story 1.3: Create React GUI Shell with Routing
 */

export const ROUTES = {
  DASHBOARD: '/',
  CHANNELS: '/channels',
  EPG: '/epg',
  ACCOUNTS: '/accounts',
  SETTINGS: '/settings',
  LOGS: '/logs',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

export interface NavItem {
  label: string;
  path: RoutePath;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: 'dashboard' },
  { label: 'Channels', path: ROUTES.CHANNELS, icon: 'tv' },
  { label: 'EPG', path: ROUTES.EPG, icon: 'calendar' },
  { label: 'Accounts', path: ROUTES.ACCOUNTS, icon: 'person' },
  { label: 'Settings', path: ROUTES.SETTINGS, icon: 'gear' },
  { label: 'Logs', path: ROUTES.LOGS, icon: 'file' },
];
