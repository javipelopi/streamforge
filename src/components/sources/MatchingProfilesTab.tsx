/**
 * Matching Profiles Tab Component
 *
 * Main tab content for the "Matching Rules" tab in the Sources view.
 * Lists existing matching profiles, allows creating/editing/deleting them,
 * and provides reordering via up/down buttons.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Layers,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';
import {
  getMatchingProfiles,
  createMatchingProfile,
  updateMatchingProfile,
  deleteMatchingProfile,
  reorderMatchingProfiles,
  type MatchingProfile,
  type NewMatchingProfile,
  type NormalizationRule,
} from '../../lib/api/matching-profiles';
import {
  getXmltvSources,
  getAccounts,
  getM3uSources,
  type XmltvSource,
  type Account,
  type M3uSource,
} from '../../lib/api';
import { MatchingProfileDialog } from './MatchingProfileDialog';
import { DeleteConfirmDialog } from './shared';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  xtream: 'Xtream',
  m3u: 'M3U',
  acestream: 'Acestream',
};

function formatRuleSummary(rulesJson: string): string {
  try {
    const rules: NormalizationRule[] = JSON.parse(rulesJson);
    if (rules.length === 0) return 'No rules';
    return `${rules.length} rule${rules.length > 1 ? 's' : ''}`;
  } catch {
    return 'No rules';
  }
}

export function MatchingProfilesTab() {
  const queryClient = useQueryClient();

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<MatchingProfile | undefined>(undefined);
  const [deletingProfile, setDeletingProfile] = useState<MatchingProfile | null>(null);

  // Fetch profiles
  const {
    data: profiles = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['matching-profiles'],
    queryFn: () => getMatchingProfiles(),
  });

  // Fetch sources for name resolution
  const { data: xmltvSources = [] } = useQuery<XmltvSource[]>({
    queryKey: ['xmltv-sources'],
    queryFn: getXmltvSources,
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const { data: m3uSources = [] } = useQuery<M3uSource[]>({
    queryKey: ['m3u-sources'],
    queryFn: getM3uSources,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: NewMatchingProfile) => createMatchingProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matching-profiles'] });
      setShowDialog(false);
      setEditingProfile(undefined);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: number;
      updates: { priorityOrder?: number; rules?: string; isActive?: number };
    }) => updateMatchingProfile(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matching-profiles'] });
      setShowDialog(false);
      setEditingProfile(undefined);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMatchingProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matching-profiles'] });
      setDeletingProfile(null);
    },
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: (profileIds: number[]) => reorderMatchingProfiles(profileIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matching-profiles'] });
    },
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: number }) =>
      updateMatchingProfile(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matching-profiles'] });
    },
  });

  // Helpers
  const getXmltvSourceName = (id: number) =>
    xmltvSources.find((s) => s.id === id)?.name ?? `Source #${id}`;

  const getStreamSourceName = (type: string, id: number) => {
    if (type === 'xtream') return accounts.find((a) => a.id === id)?.name ?? `Account #${id}`;
    if (type === 'm3u') return m3uSources.find((s) => s.id === id)?.name ?? `M3U #${id}`;
    return `Source #${id}`;
  };

  // Sorted profiles by priority
  const sortedProfiles = [...profiles].sort(
    (a, b) => a.priorityOrder - b.priorityOrder
  );

  // Move profile up/down
  const moveProfile = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sortedProfiles.length) return;

    const reordered = [...sortedProfiles];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    reorderMutation.mutate(reordered.map((p) => p.id));
  };

  // Submit handler
  const handleSubmit = async (data: NewMatchingProfile): Promise<void> => {
    if (editingProfile) {
      await updateMutation.mutateAsync({
        id: editingProfile.id,
        updates: {
          priorityOrder: data.priorityOrder,
          rules: data.rules,
        },
      });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleAdd = () => {
    setEditingProfile(undefined);
    setShowDialog(true);
  };

  const handleEdit = (profile: MatchingProfile) => {
    setEditingProfile(profile);
    setShowDialog(true);
  };

  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setShowDialog(false);
      setEditingProfile(undefined);
      createMutation.reset();
      updateMutation.reset();
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="matching-profiles-tab" className="animate-pulse space-y-4">
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        data-testid="matching-profiles-tab"
        className="p-4 bg-red-50 border border-red-200 rounded-lg"
      >
        <p className="text-red-700">Failed to load matching profiles</p>
      </div>
    );
  }

  return (
    <div data-testid="matching-profiles-tab" className="space-y-4 overflow-auto h-full">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">How matching profiles work</p>
          <p>
            Each profile pairs an XMLTV source with a stream source and applies
            normalization rules to channel names before fuzzy matching. Profiles
            are tried in priority order -- the first match becomes the primary
            stream.
          </p>
          <p className="mt-1 text-amber-600">
            Manual matching is always available for channels the rules don't catch.
          </p>
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <button
          data-testid="add-matching-profile-button"
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          New Profile
        </button>
      </div>

      {/* Empty state */}
      {sortedProfiles.length === 0 && (
        <div className="text-center py-12">
          <Layers className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            No matching profiles
          </h2>
          <p className="text-gray-500 mb-6">
            Create a profile to automatically match channels between your XMLTV
            and stream sources.
          </p>
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create First Profile
          </button>
        </div>
      )}

      {/* Profiles list */}
      {sortedProfiles.length > 0 && (
        <div className="space-y-2">
          {sortedProfiles.map((profile, index) => (
            <div
              key={profile.id}
              data-testid={`matching-profile-${profile.id}`}
              className={`flex items-center gap-3 p-4 border rounded-lg transition-colors ${
                profile.isActive
                  ? 'bg-white border-gray-200 hover:border-gray-300'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              {/* Priority reorder */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveProfile(index, 'up')}
                  disabled={index === 0 || reorderMutation.isPending}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                  title="Move up (higher priority)"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveProfile(index, 'down')}
                  disabled={
                    index === sortedProfiles.length - 1 ||
                    reorderMutation.isPending
                  }
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                  title="Move down (lower priority)"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Priority badge */}
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {index + 1}
              </div>

              {/* Profile info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span className="truncate">
                    {getXmltvSourceName(profile.xmltvSourceId)}
                  </span>
                  <span className="text-gray-400">-&gt;</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                    {SOURCE_TYPE_LABELS[profile.streamSourceType] ?? profile.streamSourceType}
                  </span>
                  <span className="truncate">
                    {getStreamSourceName(
                      profile.streamSourceType,
                      profile.streamSourceId
                    )}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatRuleSummary(profile.rules)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    toggleMutation.mutate({
                      id: profile.id,
                      isActive: profile.isActive ? 0 : 1,
                    })
                  }
                  className={`p-1.5 rounded transition-colors ${
                    profile.isActive
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={profile.isActive ? 'Disable' : 'Enable'}
                >
                  {profile.isActive ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(profile)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Edit profile"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingProfile(profile)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete profile"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile Dialog */}
      <MatchingProfileDialog
        open={showDialog}
        onOpenChange={handleCloseDialog}
        profile={editingProfile}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        existingCount={profiles.length}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={!!deletingProfile}
        onOpenChange={(open) => {
          if (!open) setDeletingProfile(null);
        }}
        title="Delete Matching Profile"
        description={`Are you sure you want to delete this matching profile? This will not affect existing channel mappings.`}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingProfile) {
            deleteMutation.mutate(deletingProfile.id);
          }
        }}
        testIdPrefix="matching-profile-delete"
      />
    </div>
  );
}
