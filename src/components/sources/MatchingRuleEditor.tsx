/**
 * Matching Rule Editor Component
 *
 * Inline editor for normalization rules within a matching profile.
 * Supports strip_prefix, strip_suffix, and regex_replace rule types.
 * Includes preset rules for common patterns.
 */
import { useState } from 'react';
import { Plus, Trash2, ChevronDown, Wand2 } from 'lucide-react';
import type { NormalizationRule } from '../../lib/api/matching-profiles';
import { PRESET_RULES } from '../../lib/api/matching-profiles';

export interface MatchingRuleEditorProps {
  rules: NormalizationRule[];
  onChange: (rules: NormalizationRule[]) => void;
}

const RULE_TYPE_LABELS: Record<NormalizationRule['type'], string> = {
  strip_prefix: 'Strip Prefix',
  strip_suffix: 'Strip Suffix',
  regex_replace: 'Regex Replace',
};

export function MatchingRuleEditor({ rules, onChange }: MatchingRuleEditorProps) {
  const [showPresets, setShowPresets] = useState(false);

  const addRule = (type: NormalizationRule['type']) => {
    const newRule: NormalizationRule =
      type === 'regex_replace'
        ? { type, pattern: '', replacement: '' }
        : { type, value: '' };
    onChange([...rules, newRule]);
  };

  const updateRule = (index: number, updates: Partial<NormalizationRule>) => {
    const updated = rules.map((rule, i) =>
      i === index ? { ...rule, ...updates } : rule
    );
    onChange(updated);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const moveRule = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rules.length) return;
    const updated = [...rules];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  const addPreset = (presetKey: string) => {
    const preset = PRESET_RULES[presetKey];
    if (preset) {
      onChange([...rules, ...preset.rules]);
    }
    setShowPresets(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Normalization Rules
        </label>
        <div className="flex gap-2">
          {/* Presets dropdown */}
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
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {Object.entries(PRESET_RULES).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => addPreset(key)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add rule dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Rule
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <button
                type="button"
                onClick={() => addRule('strip_prefix')}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-t-lg"
              >
                Strip Prefix
              </button>
              <button
                type="button"
                onClick={() => addRule('strip_suffix')}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                Strip Suffix
              </button>
              <button
                type="button"
                onClick={() => addRule('regex_replace')}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-b-lg"
              >
                Regex Replace
              </button>
            </div>
          </div>
        </div>
      </div>

      {rules.length === 0 && (
        <p className="text-sm text-gray-400 italic py-2">
          No rules yet. Add rules to preprocess channel names before matching.
        </p>
      )}

      {/* Rule list */}
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div
            key={index}
            className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg"
          >
            {/* Reorder buttons */}
            <div className="flex flex-col gap-0.5 pt-1">
              <button
                type="button"
                onClick={() => moveRule(index, 'up')}
                disabled={index === 0}
                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move up"
              >
                <ChevronDown className="w-3 h-3 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => moveRule(index, 'down')}
                disabled={index === rules.length - 1}
                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move down"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Rule content */}
            <div className="flex-1 space-y-2">
              <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                {RULE_TYPE_LABELS[rule.type]}
              </span>

              {rule.type === 'regex_replace' ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={rule.pattern ?? ''}
                    onChange={(e) =>
                      updateRule(index, { pattern: e.target.value })
                    }
                    placeholder="Pattern (regex)"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                  <input
                    type="text"
                    value={rule.replacement ?? ''}
                    onChange={(e) =>
                      updateRule(index, { replacement: e.target.value })
                    }
                    placeholder="Replacement"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={rule.value ?? ''}
                  onChange={(e) =>
                    updateRule(index, { value: e.target.value })
                  }
                  placeholder={
                    rule.type === 'strip_prefix'
                      ? 'Text to remove from start'
                      : 'Text to remove from end'
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => removeRule(index)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="Remove rule"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
