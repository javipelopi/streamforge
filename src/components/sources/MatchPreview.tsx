/**
 * Match Preview Component
 *
 * Shows how provider stream names are stripped using prefix/suffix regex
 * and compared against XMLTV channel names. Runs client-side matching
 * using existing API data.
 */
import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { invoke } from '../../lib/api/invoke';
import type { NormalizationRule, StreamSourceType } from '../../lib/api/matching-profiles';
import type { XmltvSourceChannel } from '../../lib/api/lineup';

export interface MatchPreviewProps {
  xmltvSourceId: number;
  streamSourceType: StreamSourceType;
  streamSourceId: number;
  rules: NormalizationRule[];
}

interface PreviewEntry {
  streamName: string;
  stripped: string;
  matchedXmltv: string | null;
  matched: boolean;
}

/** Normalize for comparison: lowercase, trim, collapse whitespace */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Strip prefix and suffix regex from a provider name (mirrors Rust logic). */
function stripProvider(name: string, rule: NormalizationRule): { stripped: string; passesFilter: boolean } {
  let result = name;
  let passesFilter = true;

  if (rule.prefix) {
    try {
      const re = new RegExp(`^(?:${rule.prefix})`);
      if (re.test(result)) {
        result = result.replace(re, '');
      } else {
        passesFilter = false;
        return { stripped: result.trim(), passesFilter };
      }
    } catch {
      // invalid regex — pass through
    }
  }

  if (rule.suffix) {
    try {
      const re = new RegExp(`(?:${rule.suffix})$`);
      result = result.replace(re, '');
    } catch {
      // invalid regex
    }
  }

  return { stripped: result.trim(), passesFilter };
}

export function MatchPreview({ xmltvSourceId, streamSourceType, streamSourceId, rules }: MatchPreviewProps) {
  const [previewing, setPreviewing] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewEntry[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const { data: xmltvChannels = [] } = useQuery<XmltvSourceChannel[]>({
    queryKey: ['xmltv-channels-for-preview', xmltvSourceId],
    queryFn: () => invoke<XmltvSourceChannel[]>('get_xmltv_channels_for_source', { sourceId: xmltvSourceId }),
    enabled: xmltvSourceId > 0,
  });

  const streamCommand = streamSourceType === 'xtream'
    ? { cmd: 'get_xtream_streams_for_account', param: 'accountId' }
    : streamSourceType === 'm3u'
    ? { cmd: 'get_m3u_channels', param: 'sourceId' }
    : null;

  const { data: rawStreamChannels = [] } = useQuery<Array<{ name: string }>>({
    queryKey: ['stream-channels-for-preview', streamSourceType, streamSourceId],
    queryFn: () => invoke<Array<{ name: string }>>(streamCommand!.cmd, { [streamCommand!.param]: streamSourceId }),
    enabled: streamSourceId > 0 && streamCommand !== null,
  });

  // Build a map of normalized XMLTV names → original display name for reverse lookup
  const xmltvNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ch of xmltvChannels) {
      map.set(normalize(ch.displayName), ch.displayName);
    }
    return map;
  }, [xmltvChannels]);

  const runPreview = useCallback(() => {
    if (xmltvChannels.length === 0 || rawStreamChannels.length === 0) return;
    setPreviewing(true);
    setPreviewError(null);

    try {
      const r = rules[0];
      if (!r) return;

      const results: PreviewEntry[] = [];

      for (const stream of rawStreamChannels) {
        const { stripped, passesFilter } = stripProvider(stream.name, r);
        if (!passesFilter) continue; // Filtered out by prefix

        const strippedNorm = normalize(stripped);
        const matchedOriginal = xmltvNameMap.get(strippedNorm) ?? null;

        results.push({
          streamName: stream.name,
          stripped,
          matchedXmltv: matchedOriginal,
          matched: matchedOriginal !== null,
        });
      }

      // Sort: matched first, then unmatched
      results.sort((a, b) => {
        if (a.matched !== b.matched) return a.matched ? -1 : 1;
        return a.streamName.localeCompare(b.streamName);
      });

      setPreviewResults(results);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }, [xmltvChannels, rawStreamChannels, xmltvNameMap, rules]);

  const matchedCount = previewResults.filter((r) => r.matched).length;
  const totalCount = previewResults.length;
  const matchRate = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Preview</label>
        <button
          type="button"
          onClick={runPreview}
          disabled={previewing || xmltvChannels.length === 0 || rawStreamChannels.length === 0 || rules.length === 0}
          className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {previewing ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Running...</>
          ) : (
            <><Eye className="w-3 h-3" /> Preview Matching</>
          )}
        </button>
      </div>

      {rules.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          Add prefix and/or suffix regex above, then preview to see matching results.
        </p>
      )}

      {previewError && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{previewError}</div>
      )}

      {previewResults.length > 0 && (
        <>
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-700">{matchRate}%</div>
            <div className="text-sm text-blue-600">
              <span className="font-medium">{matchedCount}</span> of{' '}
              <span className="font-medium">{totalCount}</span> filtered streams matched ({matchRate}%)
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Provider Stream</th>
                  <th className="px-2 py-2 w-8"></th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Stripped Name</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">XMLTV Match</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewResults.map((entry, i) => (
                  <tr key={i} className={entry.matched ? 'bg-green-50' : 'bg-red-50/30'}>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-700">{entry.streamName}</td>
                    <td className="px-1 py-1.5 text-center"><ArrowRight className="w-3 h-3 text-gray-400" /></td>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-900">{entry.stripped}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-500">
                      {entry.matchedXmltv ?? <span className="italic text-red-400">no match</span>}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {entry.matched ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-300" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
