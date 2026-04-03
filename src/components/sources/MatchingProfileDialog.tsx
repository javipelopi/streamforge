/**
 * Matching Profile Dialog Component
 *
 * Dialog for creating or editing a matching profile.
 * Allows selecting an XMLTV source, a stream source (Xtream/M3U),
 * setting priority order, and configuring prefix/suffix regex for provider name stripping.
 */
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogCancelButton, DialogSubmitButton } from '../common/Dialog';
import { MatchingRuleEditor } from './MatchingRuleEditor';
import { MatchPreview } from './MatchPreview';
import type {
  MatchingProfile,
  NewMatchingProfile,
  NormalizationRule,
  StreamSourceType,
} from '../../lib/api/matching-profiles';
import {
  getXmltvSources,
  getAccounts,
  getM3uSources,
  type XmltvSource,
  type Account,
  type M3uSource,
} from '../../lib/api';
import { runChannelMatching, type MatchResponse } from '../../lib/api/matcher';
import { Play, Loader2, CheckCircle2 } from 'lucide-react';

export interface MatchingProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: MatchingProfile;
  onSubmit: (data: NewMatchingProfile) => Promise<void>;
  isLoading?: boolean;
  existingCount: number;
}

export function MatchingProfileDialog({
  open,
  onOpenChange,
  profile,
  onSubmit,
  isLoading = false,
  existingCount,
}: MatchingProfileDialogProps) {
  const isEditMode = !!profile;
  const queryClient = useQueryClient();

  const [xmltvSourceId, setXmltvSourceId] = useState<number>(0);
  const [streamSourceType, setStreamSourceType] = useState<StreamSourceType>('xtream');
  const [streamSourceId, setStreamSourceId] = useState<number>(0);
  const [priorityOrder, setPriorityOrder] = useState<number>(0);
  const [rule, setRule] = useState<NormalizationRule>({ prefix: '', suffix: '' });
  const [error, setError] = useState<string | null>(null);
  const [savedState, setSavedState] = useState<'idle' | 'saved' | 'matching' | 'done'>('idle');
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);

  const rematchMutation = useMutation({
    mutationFn: () => runChannelMatching(),
    onSuccess: (result) => {
      setMatchResult(result);
      setSavedState('done');
      queryClient.invalidateQueries({ queryKey: ['xmltv-channels-with-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['match-stats'] });
    },
    onError: () => {
      setSavedState('saved');
    },
  });

  const { data: xmltvSources = [] } = useQuery<XmltvSource[]>({
    queryKey: ['xmltv-sources'],
    queryFn: getXmltvSources,
    enabled: open,
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: open,
  });

  const { data: m3uSources = [] } = useQuery<M3uSource[]>({
    queryKey: ['m3u-sources'],
    queryFn: getM3uSources,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      if (profile) {
        setXmltvSourceId(profile.xmltvSourceId);
        setStreamSourceType(profile.streamSourceType);
        setStreamSourceId(profile.streamSourceId);
        setPriorityOrder(profile.priorityOrder);
        try {
          const parsed = JSON.parse(profile.rules) as NormalizationRule[];
          setRule(parsed[0] ?? { prefix: '', suffix: '' });
        } catch {
          setRule({ prefix: '', suffix: '' });
        }
      } else {
        setXmltvSourceId(xmltvSources[0]?.id ?? 0);
        setStreamSourceType('xtream');
        setStreamSourceId(accounts[0]?.id ?? 0);
        setPriorityOrder(existingCount);
        setRule({ prefix: '', suffix: '' });
      }
      setError(null);
      setSavedState('idle');
      setMatchResult(null);
    }
  }, [open, profile, xmltvSources, accounts, existingCount]);

  useEffect(() => {
    if (!isEditMode) {
      if (streamSourceType === 'xtream') {
        setStreamSourceId(accounts[0]?.id ?? 0);
      } else {
        setStreamSourceId(m3uSources[0]?.id ?? 0);
      }
    }
  }, [streamSourceType, accounts, m3uSources, isEditMode]);

  const handleSubmit = async () => {
    setError(null);
    if (!xmltvSourceId) { setError('Please select an XMLTV source.'); return; }
    if (!streamSourceId) { setError('Please select a stream source.'); return; }

    try {
      await onSubmit({
        xmltvSourceId,
        streamSourceType,
        streamSourceId,
        priorityOrder,
        rules: JSON.stringify([rule]),
      });
      setSavedState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    }
  };

  const handleRunMatching = useCallback(() => {
    setSavedState('matching');
    rematchMutation.mutate();
  }, [rematchMutation]);

  const streamSourceOptions =
    streamSourceType === 'xtream'
      ? accounts.map((a) => ({ id: a.id, name: a.name }))
      : m3uSources.map((s) => ({ id: s.id, name: s.name }));

  const rulesForPreview: NormalizationRule[] = (rule.prefix || rule.suffix) ? [rule] : [];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? 'Edit Matching Profile' : 'New Matching Profile'}
      subtitle="Configure how channel names are matched between sources"
      isLoading={isLoading}
      error={error ?? undefined}
      maxWidth="max-w-2xl"
      footer={
        savedState === 'idle' ? (
          <>
            <DialogCancelButton onClick={() => onOpenChange(false)} disabled={isLoading} />
            <DialogSubmitButton onClick={handleSubmit} isLoading={isLoading} loadingText="Saving...">
              {isEditMode ? 'Update Profile' : 'Create Profile'}
            </DialogSubmitButton>
          </>
        ) : savedState === 'saved' ? (
          <>
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              data-testid="run-matching-now-button"
              onClick={handleRunMatching}
              className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Run Matching Now
            </button>
          </>
        ) : savedState === 'matching' ? (
          <button
            disabled
            className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg opacity-75 inline-flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Matching...
          </button>
        ) : (
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        )
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">XMLTV Source (EPG)</label>
            <select
              value={xmltvSourceId}
              onChange={(e) => setXmltvSourceId(Number(e.target.value))}
              disabled={isEditMode}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
            >
              <option value={0}>Select source...</option>
              {xmltvSources.map((src) => (
                <option key={src.id} value={src.id}>{src.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stream Source</label>
            <div className="flex gap-2">
              <select
                value={streamSourceType}
                onChange={(e) => setStreamSourceType(e.target.value as StreamSourceType)}
                disabled={isEditMode}
                className="w-28 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
              >
                <option value="xtream">Xtream</option>
                <option value="m3u">M3U</option>
              </select>
              <select
                value={streamSourceId}
                onChange={(e) => setStreamSourceId(Number(e.target.value))}
                disabled={isEditMode}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
              >
                <option value={0}>Select...</option>
                {streamSourceOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority Order</label>
          <p className="text-xs text-gray-500 mb-1">
            Lower number = higher priority. First matching profile provides the primary stream.
          </p>
          <input
            type="number"
            min={0}
            value={priorityOrder}
            onChange={(e) => setPriorityOrder(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <hr className="border-gray-200" />

        <MatchingRuleEditor rule={rule} onChange={setRule} />

        <hr className="border-gray-200" />

        {xmltvSourceId > 0 && streamSourceId > 0 && savedState === 'idle' && (
          <MatchPreview
            xmltvSourceId={xmltvSourceId}
            streamSourceType={streamSourceType}
            streamSourceId={streamSourceId}
            rules={rulesForPreview}
          />
        )}

        {/* Post-save: prompt to run matching */}
        {savedState === 'saved' && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Profile saved. Run matching now?</p>
              <p className="text-blue-600 text-xs mt-0.5">
                This will re-run the matching algorithm across all active profiles.
              </p>
            </div>
          </div>
        )}

        {/* Matching result */}
        {savedState === 'done' && matchResult && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-medium">
                Matched {matchResult.matchedCount}/{matchResult.totalXmltv} channels.{' '}
                {matchResult.unmatchedCount > 0 && (
                  <span className="text-green-600">{matchResult.unmatchedCount} unmatched.</span>
                )}
              </p>
              <p className="text-green-600 text-xs mt-0.5">
                Completed in {(matchResult.durationMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>
        )}

        {/* Matching error */}
        {rematchMutation.isError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-800">
              <p className="font-medium">Matching failed</p>
              <p>{rematchMutation.error instanceof Error ? rematchMutation.error.message : 'Unknown error'}</p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
