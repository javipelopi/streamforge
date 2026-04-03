/**
 * Matching Profile Dialog Component
 *
 * Dialog for creating or editing a matching profile.
 * Allows selecting an XMLTV source, a stream source (Xtream/M3U),
 * setting priority order, and configuring normalization rules.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  // Form state
  const [xmltvSourceId, setXmltvSourceId] = useState<number>(0);
  const [streamSourceType, setStreamSourceType] = useState<StreamSourceType>('xtream');
  const [streamSourceId, setStreamSourceId] = useState<number>(0);
  const [priorityOrder, setPriorityOrder] = useState<number>(0);
  const [rules, setRules] = useState<NormalizationRule[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch available sources
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

  // Reset form when dialog opens or profile changes
  useEffect(() => {
    if (open) {
      if (profile) {
        setXmltvSourceId(profile.xmltvSourceId);
        setStreamSourceType(profile.streamSourceType);
        setStreamSourceId(profile.streamSourceId);
        setPriorityOrder(profile.priorityOrder);
        try {
          setRules(JSON.parse(profile.rules) as NormalizationRule[]);
        } catch {
          setRules([]);
        }
      } else {
        setXmltvSourceId(xmltvSources[0]?.id ?? 0);
        setStreamSourceType('xtream');
        setStreamSourceId(accounts[0]?.id ?? 0);
        setPriorityOrder(existingCount);
        setRules([]);
      }
      setError(null);
    }
  }, [open, profile, xmltvSources, accounts, existingCount]);

  // Update stream source id when type changes
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

    if (!xmltvSourceId) {
      setError('Please select an XMLTV source.');
      return;
    }
    if (!streamSourceId) {
      setError('Please select a stream source.');
      return;
    }

    try {
      await onSubmit({
        xmltvSourceId,
        streamSourceType,
        streamSourceId,
        priorityOrder,
        rules: JSON.stringify(rules),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    }
  };

  const streamSourceOptions =
    streamSourceType === 'xtream'
      ? accounts.map((a) => ({ id: a.id, name: a.name }))
      : m3uSources.map((s) => ({ id: s.id, name: s.name }));

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
        <>
          <DialogCancelButton
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          />
          <DialogSubmitButton
            onClick={handleSubmit}
            isLoading={isLoading}
            loadingText="Saving..."
          >
            {isEditMode ? 'Update Profile' : 'Create Profile'}
          </DialogSubmitButton>
        </>
      }
    >
      <div className="space-y-5">
        {/* Source selection */}
        <div className="grid grid-cols-2 gap-4">
          {/* XMLTV Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              XMLTV Source (EPG)
            </label>
            <select
              value={xmltvSourceId}
              onChange={(e) => setXmltvSourceId(Number(e.target.value))}
              disabled={isEditMode}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
            >
              <option value={0}>Select source...</option>
              {xmltvSources.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stream Source Type + ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stream Source
            </label>
            <div className="flex gap-2">
              <select
                value={streamSourceType}
                onChange={(e) =>
                  setStreamSourceType(e.target.value as StreamSourceType)
                }
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
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority Order
          </label>
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

        {/* Divider */}
        <hr className="border-gray-200" />

        {/* Normalization rules */}
        <MatchingRuleEditor rules={rules} onChange={setRules} />

        {/* Divider */}
        <hr className="border-gray-200" />

        {/* Preview */}
        {xmltvSourceId > 0 && (
          <MatchPreview xmltvSourceId={xmltvSourceId} rules={rules} />
        )}
      </div>
    </Dialog>
  );
}
