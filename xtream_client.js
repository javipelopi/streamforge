#!/usr/bin/env node
/**
 * Xtream Codes API Client - Full Featured
 * Based on: https://github.com/chazlarson/py-xtream-codes
 * API Docs: https://github.com/engenex/xtream-codes-api-v2
 */

const fs = require('fs');
const path = require('path');

// Load .env file
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
  }
}
loadEnv();

class XtreamClient {
  constructor(host, username, password) {
    this.host = host.replace(/\/$/, '');
    if (!this.host.startsWith('http')) {
      this.host = `http://${this.host}`;
    }
    this.username = username;
    this.password = password;
    this.authData = null;
  }

  _buildUrl(action = null, params = {}) {
    let url = `${this.host}/player_api.php?username=${this.username}&password=${this.password}`;
    if (action) url += `&action=${action}`;
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url += `&${key}=${value}`;
      }
    }
    return url;
  }

  async _get(action = null, params = {}, silent = false) {
    const url = this._buildUrl(action, params);
    if (!silent) {
      const displayUrl = url.length > 80 ? url.substring(0, 80) + '...' : url;
      process.stdout.write(`  → ${displayUrl}\r`);
    }

    const response = await fetch(url, { timeout: 30000 });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // === Authentication ===
  async authenticate() {
    this.authData = await this._get();
    return this.authData;
  }

  getAccountInfo() {
    return this.authData?.user_info || {};
  }

  getServerInfo() {
    return this.authData?.server_info || {};
  }

  // === Live TV ===
  async getLiveCategories() {
    return this._get('get_live_categories');
  }

  async getLiveStreams(categoryId = null) {
    const params = categoryId ? { category_id: categoryId } : {};
    return this._get('get_live_streams', params);
  }

  // === VOD (Movies) ===
  async getVodCategories() {
    return this._get('get_vod_categories');
  }

  async getVodStreams(categoryId = null) {
    const params = categoryId ? { category_id: categoryId } : {};
    return this._get('get_vod_streams', params);
  }

  async getVodInfo(vodId) {
    return this._get('get_vod_info', { vod_id: vodId }, true);
  }

  // === Series ===
  async getSeriesCategories() {
    return this._get('get_series_categories');
  }

  async getSeries(categoryId = null) {
    const params = categoryId ? { category_id: categoryId } : {};
    return this._get('get_series', params);
  }

  async getSeriesInfo(seriesId) {
    return this._get('get_series_info', { series_id: seriesId }, true);
  }

  // === EPG (Electronic Program Guide) ===
  async getShortEpg(streamId, limit = 10) {
    return this._get('get_short_epg', { stream_id: streamId, limit }, true);
  }

  async getFullEpg(streamId) {
    return this._get('get_simple_data_table', { stream_id: streamId }, true);
  }

  async getAllEpg() {
    // Full XMLTV EPG URL
    const url = `${this.host}/xmltv.php?username=${this.username}&password=${this.password}`;
    return url; // Returns URL - file is usually large
  }

  // === Timeshift / Catchup ===
  buildTimeshiftUrl(streamId, start, duration) {
    // start: Unix timestamp, duration: in minutes
    return `${this.host}/timeshift/${this.username}/${this.password}/${duration}/${start}/${streamId}.ts`;
  }

  buildCatchupUrl(streamId, start, end) {
    // start/end: Unix timestamps
    return `${this.host}/streaming/timeshift.php?username=${this.username}&password=${this.password}&stream=${streamId}&start=${start}&end=${end}`;
  }

  // === URL Builders ===
  buildLiveUrl(streamId, extension = 'ts') {
    return `${this.host}/live/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  buildVodUrl(streamId, extension = 'mp4') {
    return `${this.host}/movie/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  buildSeriesUrl(streamId, extension = 'mp4') {
    return `${this.host}/series/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  // === M3U Exports ===
  async exportLiveM3u(filename = 'live.m3u') {
    const categories = await this.getLiveCategories();
    const categoryMap = Object.fromEntries(
      categories.map(c => [c.category_id, c.category_name])
    );

    const streams = await this.getLiveStreams();
    const lines = ['#EXTM3U'];

    for (const stream of streams) {
      const catName = categoryMap[stream.category_id] || 'Uncategorized';
      const name = stream.name || 'Unknown';
      const logo = stream.stream_icon || '';
      const epgId = stream.epg_channel_id || '';
      const catchup = stream.tv_archive === 1 ? ' catchup="default" catchup-days="7"' : '';

      lines.push(`#EXTINF:-1 tvg-id="${epgId}" tvg-name="${name}" tvg-logo="${logo}" group-title="${catName}"${catchup},${name}`);
      lines.push(this.buildLiveUrl(stream.stream_id));
    }

    fs.writeFileSync(filename, lines.join('\n'), 'utf-8');
    console.log(`\n✓ Exported ${streams.length} live channels → ${filename}`);
    return { filename, count: streams.length };
  }

  async exportVodM3u(filename = 'movies.m3u') {
    const categories = await this.getVodCategories();
    const categoryMap = Object.fromEntries(
      categories.map(c => [c.category_id, c.category_name])
    );

    const streams = await this.getVodStreams();
    const lines = ['#EXTM3U'];

    for (const stream of streams) {
      const catName = categoryMap[stream.category_id] || 'Uncategorized';
      const name = stream.name || 'Unknown';
      const logo = stream.stream_icon || '';
      const ext = stream.container_extension || 'mp4';
      const rating = stream.rating || '';
      const year = stream.year || '';

      const title = year ? `${name} (${year})` : name;
      lines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${catName}" rating="${rating}",${title}`);
      lines.push(this.buildVodUrl(stream.stream_id, ext));
    }

    fs.writeFileSync(filename, lines.join('\n'), 'utf-8');
    console.log(`\n✓ Exported ${streams.length} movies → ${filename}`);
    return { filename, count: streams.length };
  }

  async exportSeriesWithEpisodes(filename = 'series.m3u', progressCallback = null) {
    const categories = await this.getSeriesCategories();
    const categoryMap = Object.fromEntries(
      categories.map(c => [c.category_id, c.category_name])
    );

    const seriesList = await this.getSeries();
    const lines = ['#EXTM3U'];
    let totalEpisodes = 0;

    console.log(`\n  Fetching episodes for ${seriesList.length} series...`);

    for (let i = 0; i < seriesList.length; i++) {
      const show = seriesList[i];
      const progress = Math.round(((i + 1) / seriesList.length) * 100);
      process.stdout.write(`\r  Progress: ${progress}% (${i + 1}/${seriesList.length}) - ${show.name.substring(0, 30)}...          `);

      try {
        const info = await this.getSeriesInfo(show.series_id);
        const catName = categoryMap[show.category_id] || 'Uncategorized';
        const showName = show.name || 'Unknown';
        const showLogo = show.cover || '';

        // Process episodes from all seasons
        if (info.episodes) {
          for (const [seasonNum, episodes] of Object.entries(info.episodes)) {
            for (const ep of episodes) {
              const epNum = ep.episode_num || '0';
              const epTitle = ep.title || `Episode ${epNum}`;
              const epName = `${showName} - S${seasonNum.padStart(2, '0')}E${epNum.toString().padStart(2, '0')} - ${epTitle}`;
              const ext = ep.container_extension || 'mp4';
              const epLogo = ep.info?.movie_image || showLogo;

              lines.push(`#EXTINF:-1 tvg-name="${epName}" tvg-logo="${epLogo}" group-title="${catName} | ${showName}",${epName}`);
              lines.push(this.buildSeriesUrl(ep.id, ext));
              totalEpisodes++;
            }
          }
        }

        // Small delay to avoid hammering the server
        await new Promise(r => setTimeout(r, 50));

      } catch (e) {
        // Skip series that fail
        continue;
      }
    }

    fs.writeFileSync(filename, lines.join('\n'), 'utf-8');
    console.log(`\n✓ Exported ${seriesList.length} series (${totalEpisodes} episodes) → ${filename}`);
    return { filename, seriesCount: seriesList.length, episodeCount: totalEpisodes };
  }

  // === Full Data Export ===
  async exportAllData(outputDir = '.') {
    const data = {
      account: this.authData,
      liveCategories: await this.getLiveCategories(),
      liveStreams: await this.getLiveStreams(),
      vodCategories: await this.getVodCategories(),
      vodStreams: await this.getVodStreams(),
      seriesCategories: await this.getSeriesCategories(),
      series: await this.getSeries(),
    };

    for (const [key, value] of Object.entries(data)) {
      const filename = `${outputDir}/${key}.json`;
      fs.writeFileSync(filename, JSON.stringify(value, null, 2));
    }

    console.log(`\n✓ Saved all data to JSON files`);
    return data;
  }
}

// === Main ===
async function main() {
  const host = process.env.XTREAM_HOST;
  const username = process.env.XTREAM_USERNAME;
  const password = process.env.XTREAM_PASSWORD;

  if (!host || !username || !password) {
    console.error('Missing credentials. Please set XTREAM_HOST, XTREAM_USERNAME, and XTREAM_PASSWORD in .env file');
    console.error('See .env.example for template');
    process.exit(1);
  }

  const client = new XtreamClient(host, username, password);

  console.log('═'.repeat(60));
  console.log('  XTREAM CODES API CLIENT - Live Channels Only');
  console.log('═'.repeat(60));

  // 1. Authentication
  console.log('\n[1/4] Authenticating...');
  try {
    await client.authenticate();
    console.log('✓ Connected!\n');

    const user = client.getAccountInfo();
    const server = client.getServerInfo();

    console.log('  ┌─ Account ─────────────────────────────────────');
    console.log(`  │ Username:    ${user.username}`);
    console.log(`  │ Status:      ${user.status}`);
    console.log(`  │ Expires:     ${user.exp_date ? new Date(user.exp_date * 1000).toLocaleDateString() : 'N/A'}`);
    console.log(`  │ Connections: ${user.active_cons || 0}/${user.max_connections || 'N/A'}`);
    console.log('  └───────────────────────────────────────────────');

    console.log('  ┌─ Server ──────────────────────────────────────');
    console.log(`  │ URL:         ${server.url}:${server.port}`);
    console.log(`  │ Timezone:    ${server.timezone}`);
    console.log(`  │ Timestamp:   ${server.timestamp_now}`);
    console.log('  └───────────────────────────────────────────────');

  } catch (e) {
    console.log(`✗ Connection failed: ${e.message}`);
    console.log('\nMake sure you can access the server from this network.');
    return;
  }

  // 2. Live TV Categories
  console.log('\n[2/4] Fetching live TV categories...');
  let liveCategories = [];
  try {
    liveCategories = await client.getLiveCategories();
    console.log(`✓ Found ${liveCategories.length} categories`);
  } catch (e) {
    console.log(`✗ Failed: ${e.message}`);
  }

  // 3. Live Streams
  console.log('\n[3/4] Fetching live streams...');
  let liveStreams = [];
  try {
    liveStreams = await client.getLiveStreams();
    const withCatchup = liveStreams.filter(s => s.tv_archive === 1).length;
    console.log(`✓ Found ${liveStreams.length} channels (${withCatchup} with catchup/DVR)`);
  } catch (e) {
    console.log(`✗ Failed: ${e.message}`);
  }

  // 4. Export Live M3U
  console.log('\n[4/4] Exporting live TV playlist...');
  try {
    await client.exportLiveM3u('live.m3u');
  } catch (e) {
    console.log(`✗ Failed: ${e.message}`);
  }

  // Save raw JSON data (live channels only)
  console.log('\n[+] Saving raw JSON data...');
  try {
    fs.writeFileSync('data_live_categories.json', JSON.stringify(liveCategories, null, 2));
    fs.writeFileSync('data_live_streams.json', JSON.stringify(liveStreams, null, 2));
    console.log('✓ Saved JSON files');
  } catch (e) {
    console.log(`✗ Failed: ${e.message}`);
  }

  // EPG URL
  console.log('\n[+] EPG (Electronic Program Guide)...');
  const epgUrl = await client.getAllEpg();
  console.log(`✓ XMLTV EPG URL: ${epgUrl}`);
  console.log('  (Use this URL in xTeve for program guide data)');

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  EXPORT COMPLETE');
  console.log('═'.repeat(60));
  console.log('\n  Generated files:');
  console.log('  ├── live.m3u                  (Live TV channels)');
  console.log('  ├── data_live_categories.json (Category data)');
  console.log('  ├── data_live_streams.json    (Stream data)');
  console.log('  └── EPG URL above             (For xTeve/Plex guide)\n');
}

main().catch(console.error);
