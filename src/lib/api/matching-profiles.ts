import { invoke } from './invoke';

// ============================================================================
// Matching Profile Types
// ============================================================================

export type StreamSourceType = 'xtream' | 'm3u' | 'acestream';

/**
 * A matching rule: prefix and suffix added to XMLTV names to match provider names.
 *
 * XMLTV names are the reference (e.g. "La 1"). Provider names are messy
 * (e.g. "Spain La 1 FHD"). Rules augment the XMLTV name so it looks like
 * the provider naming for comparison.
 *
 * Example: prefix="Spain " suffix=" FHD" -> "La 1" becomes "Spain La 1 FHD"
 */
export interface NormalizationRule {
  /** Text prepended to the XMLTV name for matching */
  prefix: string;
  /** Text appended to the XMLTV name for matching */
  suffix: string;
}

export interface MatchingProfile {
  id: number;
  xmltvSourceId: number;
  streamSourceType: StreamSourceType;
  streamSourceId: number;
  priorityOrder: number;
  rules: string;
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
  return invoke<MatchingProfile[]>('get_matching_profiles', { xmltvSourceId });
}

export async function getMatchingProfile(id: number): Promise<MatchingProfile> {
  return invoke<MatchingProfile>('get_matching_profile', { id });
}

export async function createMatchingProfile(profile: NewMatchingProfile): Promise<MatchingProfile> {
  return invoke<MatchingProfile>('create_matching_profile', { profile });
}

export async function updateMatchingProfile(id: number, updates: MatchingProfileUpdate): Promise<MatchingProfile> {
  return invoke<MatchingProfile>('update_matching_profile', { id, updates });
}

export async function deleteMatchingProfile(id: number): Promise<void> {
  return invoke<void>('delete_matching_profile', { id });
}

export async function reorderMatchingProfiles(profileIds: number[]): Promise<MatchingProfile[]> {
  return invoke<MatchingProfile[]>('reorder_matching_profiles', { profileIds });
}

export async function previewNormalization(name: string, rules: NormalizationRule[]): Promise<PreviewResult> {
  return invoke<PreviewResult>('preview_matching_normalization', { name, rules });
}

// ============================================================================
// Preset Rules
// ============================================================================

export const PRESET_RULES: Record<string, { label: string; rule: NormalizationRule }> = {
  spain_fhd: {
    label: 'Spain FHD (prefix "Spain ", suffix " FHD")',
    rule: { prefix: 'Spain ', suffix: ' FHD' },
  },
  spain_hd: {
    label: 'Spain HD (prefix "Spain ", suffix " HD")',
    rule: { prefix: 'Spain ', suffix: ' HD' },
  },
  uk_prefix: {
    label: 'UK prefix (prefix "UK: ")',
    rule: { prefix: 'UK: ', suffix: '' },
  },
  us_prefix: {
    label: 'US prefix (prefix "US: ")',
    rule: { prefix: 'US: ', suffix: '' },
  },
};
