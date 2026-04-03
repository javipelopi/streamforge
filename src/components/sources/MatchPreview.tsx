/**
 * Match Preview Component
 *
 * Shows how XMLTV names are augmented with prefix/suffix and compared
 * against provider stream names.
 */
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { invoke } from '../../lib/api/invoke';
import type { NormalizationRule } from '../../lib/api/matching-profiles';

interface XmltvChannelBasic {
  id: number;
  displayName: string;
}

interface StreamChannel {
  id: number;
  name: string;
}

export interface MatchPreviewProps {
  xmltvSourceId: number;
  streamSourceType: 'xtream' | 'm3u';
  streamSourceId: number;
  rules: NormalizationRule[];
}

interface PreviewEntry {
  xmltvName: string;
  augmented: string;
  matchedStream: string | null;
  matched: boolean;
}

export function MatchPreview({ xmltvSourceId, streamSourceType, streamSourceId, rules }: MatchPreviewProps) {
  const [previewing, setPreviewing] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewEntry[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const { data: xmltvChannels = [] } = useQuery<XmltvChannelBasic[]>({
    queryKey: ['xmltv-channels-for-preview', xmltvSourceId],
    queryFn: () => invoke<XmltvChannelBasic[]>('get_xmltv_channels_for_source', { sourceId: xmltvSourceId }),
    enabled: xmltvSourceId > 0,
  });

  const streamQueryKey = streamSourceType === 'xtream' ? 'get_xtream_channels_for_account' : 'get_m3u_channels_for_source';
  const streamParamKey = streamSourceType === 'xtream' ? 'accountId' : 'sourceId';

  const { data: streamChannels = [] } = useQuery<StreamChannel[]>({
    queryKey: ['stream-channels-for-preview', streamSourceType, streamSourceId],
    queryFn: () => invoke<StreamChannel[]>(streamQueryKey, { [streamParamKey]: streamSourceId }),
    enabled: streamSourceId > 0,
  });

  const runPreview = useCallback(async () => {
    if (xmltvChannels.length === 0 || streamChannels.length === 0) return;
    setPreviewing(true);
    setPreviewError(null);

    try {
      const r = rules[0];
      const prefix = r?.prefix ?? '';
      const suffix = r?.suffix ?? '';

      const streamNamesNorm = new Map<string, string>();
      for (const ch of streamChannels) {
        streamNamesNorm.set(ch.name.toLowerCase().trim(), ch.name);
      }

      const results: PreviewEntry[] = xmltvChannels.slice(0, 50).map((xmltv) => {
        const augmented = prefix + xmltv.displayName + suffix;
        const augNorm = augmented.toLowerCase().trim();
        const matchedOriginal = streamNamesNorm.get(augNorm) ?? null;

        return {
          xmltvName: xmltv.displayName,
          augmented,
          matchedStream: matchedOriginal,
          matched: matchedOriginal !== null,
        };
      });

      setPreviewResults(results);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }, [xmltvChannels, streamChannels, rules]);

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
          disabled={previewing || xmltvChannels.length === 0 || streamChannels.length === 0 || rules.length === 0}
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
          Add a prefix and/or suffix above, then preview to see matching results.
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
              <span className="font-medium">{totalCount}</span> XMLTV channels found exact match
              {totalCount === 50 && xmltvChannels.length > 50 && (
                <span className="text-blue-400"> (showing first 50 of {xmltvChannels.length})</span>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">XMLTV Name</th>
                  <th className="px-2 py-2 w-8"></th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Augmented (search)</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewResults.map((entry, i) => (
                  <tr key={i} className={entry.matched ? 'bg-green-50' : ''}>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-700">{entry.xmltvName}</td>
                    <td className="px-1 py-1.5 text-center"><ArrowRight className="w-3 h-3 text-gray-400" /></td>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-900">{entry.augmented}</td>
                    <td className="px-3 py-1.5 text-center">
                      {entry.matched ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
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
