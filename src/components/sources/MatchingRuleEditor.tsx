/**
 * Matching Rule Editor Component
 *
 * Simple editor for prefix/suffix matching rules. Each profile has one rule
 * that defines a prefix and suffix to augment XMLTV names for matching against
 * provider stream names.
 *
 * Example: XMLTV "La 1" + prefix "Spain " + suffix " FHD" = "Spain La 1 FHD"
 */
import { useState } from 'react';
import { ChevronDown, Wand2 } from 'lucide-react';
import type { NormalizationRule } from '../../lib/api/matching-profiles';
import { PRESET_RULES } from '../../lib/api/matching-profiles';

export interface MatchingRuleEditorProps {
  rule: NormalizationRule;
  onChange: (rule: NormalizationRule) => void;
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

  const exampleXmltv = 'La 1';
  const augmented = rule.prefix + exampleXmltv + rule.suffix;
  const hasRule = rule.prefix || rule.suffix;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Name Augmentation (Prefix / Suffix)
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
        Add a prefix and/or suffix to XMLTV names to match provider naming.
        The display name in the lineup is always the original XMLTV name.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Prefix
          </label>
          <input
            type="text"
            value={rule.prefix}
            onChange={(e) => onChange({ ...rule, prefix: e.target.value })}
            placeholder='e.g. "Spain "'
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Suffix
          </label>
          <input
            type="text"
            value={rule.suffix}
            onChange={(e) => onChange({ ...rule, suffix: e.target.value })}
            placeholder='e.g. " FHD"'
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {hasRule && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-600 font-medium">Example:</span>{' '}
          <span className="text-gray-600">&quot;{exampleXmltv}&quot;</span>
          {' -> '}
          <span className="text-blue-800 font-mono">&quot;{augmented}&quot;</span>
        </div>
      )}
    </div>
  );
}
