import { invoke } from './invoke';

// ============================================================================
// Matching Profile Types
// ============================================================================

export type StreamSourceType = 'xtream' | 'm3u' | 'acestream';

export interface NormalizationRule {
  type: 'strip_prefix' | 'strip_suffix' | 'regex_replace';
  value?: string;
  pattern?: string;
  replacement?: string;
}

export interface MatchingProfile {
  id: number;
  xmltvSourceId: number;
  streamSourceType: StreamSourceType;
  streamSourceId: number;
  priorityOrder: number;
  rules: string; // JSON string of NormalizationRule[]
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewMatchingProfile {
  xmltvSourceId: number;
  streamSourceType: StreamSourceType;
  streamSourceId: number;
  priorityOrder: number;
  rules: string;
  isActive?: number;
}

export interface MatchingProfileUpdate {
  priorityOrder?: number;
  rules?: string;
  isActive?: number;
}

export interface PreviewResult {
  original: string;
  normalized: string;
}

// ============================================================================
// API Functions
// ============================================================================

export async function getMatchingProfiles(xmltvSourceId?: number): Promise<MatchingProfile[]> {
  return invoke<MatchingProfile[]>('get_matching_profiles', {
    xmltvSourceId,
  });
}

export async function getMatchingProfile(id: number): Promise<MatchingProfile> {
  return invoke<MatchingProfile>('get_matching_profile', { id });
}

export async function createMatchingProfile(
  profile: NewMatchingProfile
): Promise<MatchingProfile> {
  return invoke<MatchingProfile>('create_matching_profile', { profile });
}

export async function updateMatchingProfile(
  id: number,
  updates: MatchingProfileUpdate
): Promise<MatchingProfile> {
  return invoke<MatchingProfile>('update_matching_profile', { id, updates });
}

export async function deleteMatchingProfile(id: number): Promise<void> {
  return invoke<void>('delete_matching_profile', { id });
}

export async function reorderMatchingProfiles(profileIds: number[]): Promise<MatchingProfile[]> {
  return invoke<MatchingProfile[]>('reorder_matching_profiles', { profileIds });
}

export async function previewNormalization(
  name: string,
  rules: NormalizationRule[]
): Promise<PreviewResult> {
  return invoke<PreviewResult>('preview_matching_normalization', { name, rules });
}

// ============================================================================
// Preset Rules
// ============================================================================

export const PRESET_RULES: Record<string, { label: string; rules: NormalizationRule[] }> = {
  strip_country_prefix: {
    label: 'Strip country prefix (e.g. "ES: ", "UK: ")',
    rules: [{ type: 'regex_replace', pattern: '^[A-Z]{2}:\\s*', replacement: '' }],
  },
  strip_quality_suffix: {
    label: 'Strip quality suffix (HD/FHD/4K/SD)',
    rules: [{ type: 'regex_replace', pattern: '\\s*[-]?\\s*(HD|FHD|SD|4K|UHD)\\s*$', replacement: '' }],
  },
  strip_parenthetical: {
    label: 'Strip parenthetical (e.g. "(ES)", "(UK)")',
    rules: [{ type: 'regex_replace', pattern: '\\s*\\([^)]+\\)\\s*', replacement: ' ' }],
  },
};
