/**
 * REST API adapter for browser mode.
 *
 * When the app runs outside Tauri (no window.__TAURI__), this module maps
 * Tauri invoke() command names to fetch() calls against the management REST API
 * served by streamforge-server at /api/*.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path template — tokens like {id} are replaced from args. */
  path: string;
  /** Extract path params from the invoke args object. */
  pathParams?: string[];
  /** For GET requests, keys to send as query-string params. */
  queryParams?: string[];
  /** For POST/PUT/DELETE with a body, transform args into the JSON body. */
  mapBody?: (args: Record<string, unknown>) => unknown;
}

/** Returned by the REST API on errors. */
interface ApiErrorResponse {
  error: string;
}

// ---------------------------------------------------------------------------
// Base URL detection
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  // In browser mode the frontend is served by the same streamforge-server
  // that exposes /api, so we use a relative URL.
  return '';
}

// ---------------------------------------------------------------------------
// Command → REST endpoint mapping
// ---------------------------------------------------------------------------

/** Helper: pass a single key from args as the JSON body. */
const bodyKey = (key: string) => (args: Record<string, unknown>) => args[key];

/** Helper: pass entire args as body. */
const bodyAll = (args: Record<string, unknown>) => args;

const ROUTES: Record<string, RouteSpec> = {
  // -- Accounts -------------------------------------------------------------
  get_accounts: {
    method: 'GET',
    path: '/api/accounts',
  },
  add_account: {
    method: 'POST',
    path: '/api/accounts',
    mapBody: bodyKey('request'),
  },
  delete_account: {
    method: 'DELETE',
    path: '/api/accounts/{id}',
    pathParams: ['id'],
  },
  update_account: {
    method: 'PUT',
    path: '/api/accounts/{id}',
    pathParams: ['id'],
    mapBody: bodyKey('request'),
  },
  toggle_account: {
    method: 'POST',
    path: '/api/accounts/{accountId}/toggle',
    pathParams: ['accountId'],
    mapBody: (args) => ({ isActive: args.isActive }),
  },
  test_connection: {
    method: 'POST',
    path: '/api/accounts/{accountId}/test',
    pathParams: ['accountId'],
  },

  // -- Channels -------------------------------------------------------------
  get_channels: {
    method: 'GET',
    path: '/api/channels/{accountId}',
    pathParams: ['accountId'],
  },
  scan_channels: {
    method: 'POST',
    path: '/api/channels/{accountId}/scan',
    pathParams: ['accountId'],
  },
  get_channel_count: {
    method: 'GET',
    path: '/api/channels/{accountId}/count',
    pathParams: ['accountId'],
  },

  // -- XMLTV Sources --------------------------------------------------------
  get_xmltv_sources: {
    method: 'GET',
    path: '/api/xmltv-sources',
  },
  add_xmltv_source: {
    method: 'POST',
    path: '/api/xmltv-sources',
    mapBody: bodyAll,
  },
  update_xmltv_source: {
    method: 'PUT',
    path: '/api/xmltv-sources/{sourceId}',
    pathParams: ['sourceId'],
    mapBody: bodyKey('updates'),
  },
  delete_xmltv_source: {
    method: 'DELETE',
    path: '/api/xmltv-sources/{sourceId}',
    pathParams: ['sourceId'],
  },
  toggle_xmltv_source: {
    method: 'POST',
    path: '/api/xmltv-sources/{sourceId}/toggle',
    pathParams: ['sourceId'],
    mapBody: (args) => ({ active: args.active }),
  },

  // -- EPG ------------------------------------------------------------------
  refresh_all_epg_sources: {
    method: 'POST',
    path: '/api/epg/refresh',
  },
  refresh_epg_source: {
    method: 'POST',
    path: '/api/epg/refresh/{sourceId}',
    pathParams: ['sourceId'],
  },
  get_epg_stats: {
    method: 'GET',
    path: '/api/epg/stats',
    queryParams: ['sourceId'],
  },

  // -- Settings -------------------------------------------------------------
  get_server_port: {
    method: 'GET',
    path: '/api/settings/server_port',
  },
  set_server_port: {
    method: 'PUT',
    path: '/api/settings/server_port',
    mapBody: (args) => ({ value: args.port }),
  },
  get_log_verbosity: {
    method: 'GET',
    path: '/api/settings/log_verbosity',
  },
  set_log_verbosity: {
    method: 'PUT',
    path: '/api/settings/log_verbosity',
    mapBody: (args) => ({ value: args.verbosity }),
  },

  // -- Events / logs --------------------------------------------------------
  get_events: {
    method: 'GET',
    path: '/api/events',
    queryParams: ['limit', 'offset', 'level', 'category', 'unreadOnly', 'createdAfter', 'createdBefore'],
  },
  get_unread_event_count: {
    method: 'GET',
    path: '/api/events/unread-count',
  },
  mark_event_read: {
    method: 'POST',
    path: '/api/events/{eventId}/read',
    pathParams: ['eventId'],
  },
  mark_all_events_read: {
    method: 'POST',
    path: '/api/events/read-all',
  },

  // -- Matcher --------------------------------------------------------------
  get_match_stats: {
    method: 'GET',
    path: '/api/matcher/stats',
  },
  run_channel_matching: {
    method: 'POST',
    path: '/api/matcher/run',
    mapBody: (args) => ({ threshold: args.threshold }),
  },
};

// ---------------------------------------------------------------------------
// Core fetch invoker
// ---------------------------------------------------------------------------

/**
 * Invoke a Tauri command via the REST API.
 *
 * @throws Error if the command has no REST mapping or the request fails.
 */
export async function invokeApi<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const route = ROUTES[cmd];
  if (!route) {
    throw new Error(
      `Command "${cmd}" is not available in browser mode (no REST API mapping).`,
    );
  }

  const safeArgs = args ?? {};
  const baseUrl = getBaseUrl();

  // Build path with substituted params
  let path = route.path;
  if (route.pathParams) {
    for (const param of route.pathParams) {
      const value = safeArgs[param];
      if (value === undefined || value === null) {
        throw new Error(`Missing path param "${param}" for command "${cmd}".`);
      }
      path = path.replace(`{${param}}`, encodeURIComponent(String(value)));
    }
  }

  // Build query string for GET requests
  let queryString = '';
  if (route.queryParams && route.method === 'GET') {
    const params = new URLSearchParams();
    for (const key of route.queryParams) {
      const value = safeArgs[key];
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    if (qs) {
      queryString = `?${qs}`;
    }
  }

  const url = `${baseUrl}${path}${queryString}`;

  // Build fetch options
  const init: RequestInit = { method: route.method };

  if (route.mapBody && (route.method === 'POST' || route.method === 'PUT')) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(route.mapBody(safeArgs));
  }

  const response = await fetch(url, init);

  // 204 No Content (e.g. DELETE)
  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    let message = `API error ${response.status}`;
    try {
      const body: ApiErrorResponse = await response.json();
      if (body.error) {
        message = body.error;
      }
    } catch {
      // body wasn't JSON — use status text
      message = `${response.status} ${response.statusText}`;
    }
    throw new Error(message);
  }

  // Some endpoints return a value wrapper for settings — unwrap if needed
  const data = await response.json();
  // Settings endpoints return { key, value } — unwrap to just the value
  if (path.startsWith('/api/settings/') && route.method === 'GET' && data && 'value' in data) {
    return data.value as T;
  }
  return data as T;
}
