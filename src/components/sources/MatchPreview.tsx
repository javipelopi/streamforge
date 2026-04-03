/**
 * Match Preview Component
 *
 * Shows before/after normalization results and match rate for a profile.
 * Calls the preview API to demonstrate what the normalization rules do
 * to actual channel names.
 */
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { invoke } from '../../lib/api/invoke';
import type { NormalizationRule } from '../../lib/api/matching-profiles';

interface XmltvChannel {
  id: string;
  displayName: string;
  sourceId: number;
}

export interface MatchPreviewProps {
  xmltvSourceId: number;
  rules: NormalizationRule[];
}

interface PreviewEntry {
  original: string;
  normalized: string;
  changed: boolean;
}

export function MatchPreview({ xmltvSourceId, rules }: MatchPreviewProps) {
  const [previewing, setPreviewing] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewEntry[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Fetch channels for this XMLTV source
  const { data: channels = [] } = useQuery<XmltvChannel[]>({
    queryKey: ['xmltv-channels-for-source', xmltvSourceId],
    queryFn: () =>
      invoke<XmltvChannel[]>('get_xmltv_channels_for_source', {
        sourceId: xmltvSourceId,
      }),
    enabled: xmltvSourceId > 0,
  });

  const runPreview = useCallback(async () => {
    if (channels.length === 0) return;
    setPreviewing(true);
    setPreviewError(null);

    try {
      // Apply normalization locally for preview (simple client-side simulation)
      const results: PreviewEntry[] = channels.slice(0, 50).map((ch) => {
        let normalized = ch.displayName;
        for (const rule of rules) {
          if (rule.type === 'strip_prefix' && rule.value) {
            if (normalized.startsWith(rule.value)) {
              normalized = normalized.slice(rule.value.length).trimStart();
            }
          } else if (rule.type === 'strip_suffix' && rule.value) {
            if (normalized.endsWith(rule.value)) {
              normalized = normalized.slice(0, -rule.value.length).trimEnd();
            }
          } else if (rule.type === 'regex_replace' && rule.pattern) {
            try {
              const regex = new RegExp(rule.pattern, 'g');
              normalized = normalized.replace(regex, rule.replacement ?? '');
            } catch {
              // Invalid regex, skip
            }
          }
        }
        normalized = normalized.trim();
        return {
          original: ch.displayName,
          normalized,
          changed: normalized !== ch.displayName,
        };
      });

      setPreviewResults(results);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }, [channels, rules]);

  const changedCount = previewResults.filter((r) => r.changed).length;
  const totalCount = previewResults.length;
  const changeRate = totalCount > 0 ? Math.round((changedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Preview
        </label>
        <button
          type="button"
          onClick={runPreview}
          disabled={previewing || channels.length === 0 || rules.length === 0}
          className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {previewing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              Preview Rules
            </>
          )}
        </button>
      </div>

      {rules.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          Add rules above, then preview to see how they affect channel names.
        </p>
      )}

      {previewError && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {previewError}
        </div>
      )}

      {previewResults.length > 0 && (
        <>
          {/* Match rate */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-700">{changeRate}%</div>
            <div className="text-sm text-blue-600">
              <span className="font-medium">{changedCount}</span> of{' '}
              <span className="font-medium">{totalCount}</span> channel names
              modified by rules
              {totalCount === 50 && channels.length > 50 && (
                <span className="text-blue-400">
                  {' '}(showing first 50 of {channels.length})
                </span>
              )}
            </div>
          </div>

          {/* Results table */}
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">
                    Original
                  </th>
                  <th className="px-2 py-2 w-8"></th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">
                    Normalized
                  </th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewResults.map((entry, i) => (
                  <tr
                    key={i}
                    className={entry.changed ? 'bg-yellow-50' : ''}
                  >
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-700">
                      {entry.original}
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-900">
                      {entry.normalized}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {entry.changed ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-300" />
                      )}
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
