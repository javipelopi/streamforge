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
    path: '/api/accounts/{id}/toggle',
    pathParams: ['id'],
    mapBody: (args) => ({ isActive: args.isActive }),
  },
  test_connection: {
    method: 'POST',
    path: '/api/accounts/{id}/test',
    pathParams: ['id'],
  },

  // -- Channels -------------------------------------------------------------
  get_channels: {
    method: 'GET',
    path: '/api/channels/{account_id}',
    pathParams: ['account_id'],
  },
  scan_channels: {
    method: 'POST',
    path: '/api/channels/{account_id}/scan',
    pathParams: ['account_id'],
  },
  get_channel_count: {
    method: 'GET',
    path: '/api/channels/{account_id}/count',
    pathParams: ['account_id'],
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
    path: '/api/xmltv-sources/{id}',
    pathParams: ['id'],
    mapBody: bodyKey('updates'),
  },
  delete_xmltv_source: {
    method: 'DELETE',
    path: '/api/xmltv-sources/{id}',
    pathParams: ['id'],
  },
  toggle_xmltv_source: {
    method: 'POST',
    path: '/api/xmltv-sources/{id}/toggle',
    pathParams: ['id'],
    mapBody: (args) => ({ active: args.active }),
  },

  // -- EPG ------------------------------------------------------------------
  refresh_all_epg_sources: {
    method: 'POST',
    path: '/api/epg/refresh',
  },
  refresh_epg_source: {
    method: 'POST',
    path: '/api/epg/refresh/{source_id}',
    pathParams: ['source_id'],
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
    path: '/api/events/{id}/read',
    pathParams: ['id'],
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
  get_channel_mappings_for_xmltv: {
    method: 'GET',
    path: '/api/matcher/channel-mappings/{xmltv_channel_id}',
    pathParams: ['xmltv_channel_id'],
  },
  get_match_threshold: {
    method: 'GET',
    path: '/api/matcher/threshold',
  },
  set_match_threshold: {
    method: 'PUT',
    path: '/api/matcher/threshold',
    mapBody: (args) => ({ threshold: args.threshold }),
  },
  normalize_channel_name: {
    method: 'GET',
    path: '/api/matcher/normalize',
    queryParams: ['name'],
  },
  calculate_match_score: {
    method: 'GET',
    path: '/api/matcher/score',
    queryParams: ['name1', 'name2'],
  },
  scan_and_rematch: {
    method: 'POST',
    path: '/api/channels/{account_id}/scan-and-rematch',
    pathParams: ['account_id'],
  },
  auto_match_m3u_channels: {
    method: 'POST',
    path: '/api/matcher/auto-match-m3u',
    mapBody: (args) => ({ sourceId: args.sourceId }),
  },
  get_m3u_auto_match_results: {
    method: 'GET',
    path: '/api/matcher/m3u-match-results',
    queryParams: ['sourceId'],
  },

  // -- M3U Sources ----------------------------------------------------------
  add_m3u_source: {
    method: 'POST',
    path: '/api/m3u-sources',
    mapBody: bodyAll,
  },
  get_m3u_sources: {
    method: 'GET',
    path: '/api/m3u-sources',
  },
  refresh_m3u_source: {
    method: 'POST',
    path: '/api/m3u-sources/{id}/refresh',
    pathParams: ['id'],
  },
  delete_m3u_source: {
    method: 'DELETE',
    path: '/api/m3u-sources/{id}',
    pathParams: ['id'],
  },
  get_m3u_channels: {
    method: 'GET',
    path: '/api/m3u-sources/{id}/channels',
    pathParams: ['id'],
  },
  toggle_m3u_source: {
    method: 'POST',
    path: '/api/m3u-sources/{id}/toggle',
    pathParams: ['id'],
    mapBody: (args) => ({ active: args.active }),
  },
  update_m3u_source: {
    method: 'PUT',
    path: '/api/m3u-sources/{id}',
    pathParams: ['id'],
    mapBody: bodyKey('updates'),
  },

  // -- Acestream Sources ----------------------------------------------------
  check_acestream_status: {
    method: 'GET',
    path: '/api/acestream/status',
  },
  add_acestream_source: {
    method: 'POST',
    path: '/api/acestream-sources',
    mapBody: bodyAll,
  },
  get_acestream_sources: {
    method: 'GET',
    path: '/api/acestream-sources',
  },
  delete_acestream_source: {
    method: 'DELETE',
    path: '/api/acestream-sources/{id}',
    pathParams: ['id'],
  },
  toggle_acestream_source: {
    method: 'POST',
    path: '/api/acestream-sources/{id}/toggle',
    pathParams: ['id'],
    mapBody: (args) => ({ active: args.active }),
  },
  update_acestream_source: {
    method: 'PUT',
    path: '/api/acestream-sources/{id}',
    pathParams: ['id'],
    mapBody: bodyKey('updates'),
  },

  // -- XMLTV Channels -------------------------------------------------------
  get_xmltv_channels_with_mappings: {
    method: 'GET',
    path: '/api/xmltv-channels/with-mappings',
    queryParams: ['sourceId'],
  },
  set_primary_stream: {
    method: 'POST',
    path: '/api/xmltv-channels/{id}/primary-stream',
    pathParams: ['id'],
    mapBody: (args) => ({ mappingId: args.mappingId }),
  },
  toggle_xmltv_channel: {
    method: 'POST',
    path: '/api/xmltv-channels/{id}/toggle',
    pathParams: ['id'],
    mapBody: (args) => ({ enabled: args.enabled }),
  },
  update_channel_order: {
    method: 'PUT',
    path: '/api/xmltv-channels/{id}/order',
    pathParams: ['id'],
    mapBody: (args) => ({ order: args.order }),
  },
  get_all_xtream_streams: {
    method: 'GET',
    path: '/api/xtream-streams',
  },
  search_xtream_streams: {
    method: 'GET',
    path: '/api/xtream-streams/search',
    queryParams: ['query', 'accountId'],
  },
  add_manual_stream_mapping: {
    method: 'POST',
    path: '/api/xmltv-channels/{id}/mappings/xtream',
    pathParams: ['id'],
    mapBody: (args) => ({ xtreamChannelId: args.xtreamChannelId, isPrimary: args.isPrimary }),
  },
  remove_stream_mapping: {
    method: 'DELETE',
    path: '/api/mappings/{id}',
    pathParams: ['id'],
  },
  add_m3u_channel_mapping: {
    method: 'POST',
    path: '/api/xmltv-channels/{id}/mappings/m3u',
    pathParams: ['id'],
    mapBody: (args) => ({ m3uChannelId: args.m3uChannelId }),
  },
  add_acestream_channel_mapping: {
    method: 'POST',
    path: '/api/xmltv-channels/{id}/mappings/acestream',
    pathParams: ['id'],
    mapBody: (args) => ({ acestreamSourceId: args.acestreamSourceId }),
  },
  get_all_channel_mappings: {
    method: 'GET',
    path: '/api/xmltv-channels/{id}/mappings',
    pathParams: ['id'],
  },
  bulk_toggle_channels: {
    method: 'POST',
    path: '/api/xmltv-channels/bulk-toggle',
    mapBody: (args) => ({ channelIds: args.channelIds, enabled: args.enabled }),
  },
  get_orphan_xtream_streams: {
    method: 'GET',
    path: '/api/xtream-streams/orphans',
  },
  get_orphan_m3u_channels: {
    method: 'GET',
    path: '/api/orphans/m3u',
  },
  get_orphan_acestream_sources: {
    method: 'GET',
    path: '/api/orphans/acestream',
  },
  get_target_lineup_channels: {
    method: 'GET',
    path: '/api/xmltv-channels/target-lineup',
  },
  get_xmltv_channels_for_source: {
    method: 'GET',
    path: '/api/xmltv-channels/for-source/{source_id}',
    pathParams: ['source_id'],
  },

  // -- Xtream Streams -------------------------------------------------------
  get_xtream_streams_for_account: {
    method: 'GET',
    path: '/api/xtream-streams/account/{account_id}',
    pathParams: ['account_id'],
  },
  get_account_stream_stats: {
    method: 'GET',
    path: '/api/xtream-streams/account/{account_id}/stats',
    pathParams: ['account_id'],
  },
  unlink_xtream_stream: {
    method: 'POST',
    path: '/api/xtream-streams/{id}/unlink',
    pathParams: ['id'],
  },
  get_xtream_stream_url: {
    method: 'GET',
    path: '/api/xtream-streams/{id}/url',
    pathParams: ['id'],
    queryParams: ['accountId'],
  },

  // -- EPG (additional) -----------------------------------------------------
  get_xmltv_channels: {
    method: 'GET',
    path: '/api/epg/channels/{source_id}',
    pathParams: ['source_id'],
  },
  get_programs: {
    method: 'GET',
    path: '/api/epg/programs/{source_id}',
    pathParams: ['source_id'],
    queryParams: ['limit', 'offset'],
  },
  get_epg_schedule: {
    method: 'GET',
    path: '/api/epg/schedule',
  },
  set_epg_schedule: {
    method: 'PUT',
    path: '/api/epg/schedule',
    mapBody: (args) => ({ enabled: args.enabled, hour: args.hour, minute: args.minute }),
  },
  get_enabled_channels_with_programs: {
    method: 'GET',
    path: '/api/epg/grid',
  },
  search_epg_programs: {
    method: 'GET',
    path: '/api/epg/search',
    queryParams: ['query', 'limit'],
  },
  get_channel_stream_info: {
    method: 'GET',
    path: '/api/epg/channel-stream-info/{channel_id}',
    pathParams: ['channel_id'],
  },
  get_program_by_id: {
    method: 'GET',
    path: '/api/epg/programs/by-id/{program_id}',
    pathParams: ['program_id'],
  },
  get_xmltv_channel_settings: {
    method: 'GET',
    path: '/api/matcher/channel-settings/{xmltv_channel_id}',
    pathParams: ['xmltv_channel_id'],
  },

  // -- Logs (additional) ----------------------------------------------------
  log_event: {
    method: 'POST',
    path: '/api/events',
    mapBody: (args) => ({ level: args.level, category: args.category, message: args.message, details: args.details }),
  },
  clear_old_events: {
    method: 'POST',
    path: '/api/events/clear-old',
    queryParams: ['keepCount'],
  },

  // -- Settings (additional) ------------------------------------------------
  get_plex_config: {
    method: 'GET',
    path: '/api/settings/plex-config',
  },
  get_resilience_config: {
    method: 'GET',
    path: '/api/settings/resilience-config',
  },
  set_failover_strictness: {
    method: 'PUT',
    path: '/api/settings/failover-strictness',
    mapBody: (args) => ({ strictness: args.strictness }),
  },
  restart_server: {
    method: 'POST',
    path: '/api/settings/restart-server',
  },

  // -- Config ---------------------------------------------------------------
  export_configuration: {
    method: 'GET',
    path: '/api/config/export',
  },
  import_configuration: {
    method: 'POST',
    path: '/api/config/import',
    mapBody: bodyAll,
  },
  validate_import_file: {
    method: 'POST',
    path: '/api/config/validate-import',
    mapBody: bodyAll,
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
