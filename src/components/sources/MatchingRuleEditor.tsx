/**
 * Matching Rule Editor Component
 *
 * Editor for prefix/suffix regex patterns that are stripped from provider
 * stream names before matching against XMLTV channel names.
 *
 * Example: Provider "ES| ANTENA 3 FHD" with prefix="ES\\| " suffix=" FHD$| HD$| SD$"
 *   → strip prefix → "ANTENA 3 FHD" → strip suffix → "ANTENA 3"
 *   → case-insensitive match against XMLTV "Antena 3" ✓
 */
import { useState, useMemo } from 'react';
import { ChevronDown, Wand2 } from 'lucide-react';
import type { NormalizationRule } from '../../lib/api/matching-profiles';
import { PRESET_RULES } from '../../lib/api/matching-profiles';

export interface MatchingRuleEditorProps {
  rule: NormalizationRule;
  onChange: (rule: NormalizationRule) => void;
}

/** Try to strip prefix and suffix regex from a sample name, client-side. */
function tryStrip(name: string, rule: NormalizationRule): { stripped: string; matches: boolean } {
  let result = name;
  let matches = true;

  if (rule.prefix) {
    try {
      const re = new RegExp(`^(?:${rule.prefix})`);
      if (re.test(result)) {
        result = result.replace(re, '');
      } else {
        matches = false;
      }
    } catch {
      // invalid regex — show as-is
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

  return { stripped: result.trim(), matches };
}

export function MatchingRuleEditor({ rule, onChange }: MatchingRuleEditorProps) {
  const [showPresets, setShowPresets] = useState(false);

  const applyPreset = (presetKey: string) => {
    const preset = PRESET_RULES[presetKey];
    if (preset) {
      onChange({ ...preset.rule });
    }
    setShowPresets(false);
  };

  const hasRule = rule.prefix || rule.suffix;

  const example = useMemo(() => {
    if (!hasRule) return null;
    const sample = 'ES| ANTENA 3 FHD';
    return tryStrip(sample, rule);
  }, [rule, hasRule]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Provider Name Stripping (Regex)
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="px-2 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 transition-colors inline-flex items-center gap-1"
          >
            <Wand2 className="w-3 h-3" />
            Presets
            <ChevronDown className="w-3 h-3" />
          </button>
          {showPresets && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {Object.entries(PRESET_RULES).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Regex patterns stripped from provider stream names before matching.
        The prefix also filters: only streams matching the prefix are candidates.
        XMLTV names are never modified.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Prefix pattern (strip from start)
          </label>
          <input
            type="text"
            value={rule.prefix}
            onChange={(e) => onChange({ ...rule, prefix: e.target.value })}
            placeholder='e.g. ES\\| '
            className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Suffix pattern (strip from end)
          </label>
          <input
            type="text"
            value={rule.suffix}
            onChange={(e) => onChange({ ...rule, suffix: e.target.value })}
            placeholder='e.g.  FHD$| HD$| SD$'
            className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {example && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-600 font-medium">Example:</span>{' '}
          <span className="text-gray-600 font-mono">&quot;ES| ANTENA 3 FHD&quot;</span>
          {' → '}
          <span className="text-blue-800 font-mono">&quot;{example.stripped}&quot;</span>
          {!example.matches && rule.prefix && (
            <span className="text-amber-600 ml-2">(prefix did not match sample)</span>
          )}
        </div>
      )}
    </div>
  );
}
