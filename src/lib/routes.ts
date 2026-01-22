/**
 * Route constants for type-safe navigation
 * Story 1.3: Create React GUI Shell with Routing
 */

export const ROUTES = {
  DASHBOARD: '/',
  TARGET_LINEUP: '/target-lineup',
  SOURCES: '/sources',
  EPG: '/epg',
  EPG_TV: '/epg-tv',
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
  testId?: string;
  ariaLabel?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: 'dashboard' },
  {
    label: 'Target Lineup',
    path: ROUTES.TARGET_LINEUP,
    icon: 'listChecks',
    testId: 'target-lineup-nav-item',
    ariaLabel: 'Target Lineup - Your Plex channel lineup',
  },
  {
    label: 'Sources',
    path: ROUTES.SOURCES,
    icon: 'database',
    testId: 'sources-nav-item',
    ariaLabel: 'Sources - Browse XMLTV and Xtream channel sources',
  },
  { label: 'EPG', path: ROUTES.EPG, icon: 'calendar' },
  { label: 'Accounts', path: ROUTES.ACCOUNTS, icon: 'person' },
  { label: 'Settings', path: ROUTES.SETTINGS, icon: 'gear' },
  { label: 'Logs', path: ROUTES.LOGS, icon: 'file' },
];
