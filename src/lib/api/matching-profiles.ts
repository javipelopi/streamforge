import { invoke } from './invoke';

// ============================================================================
// Matching Profile Types
// ============================================================================

export type StreamSourceType = 'xtream' | 'm3u' | 'acestream';

/**
 * A matching rule: prefix and suffix regex patterns stripped from provider stream names.
 *
 * Provider names are messy (e.g. "ES| ANTENA 3 FHD"). XMLTV names are the
 * reference (e.g. "Antena 3"). Rules strip the prefix and suffix from provider
 * names so they match the XMLTV reference.
 *
 * The prefix regex also acts as a FILTER: only provider streams matching the
 * prefix are candidates for matching.
 *
 * Example: prefix="ES\\| " suffix=" FHD$| HD$| SD$| HEVC$| 4K$"
 *   "ES| ANTENA 3 FHD" → strip prefix → "ANTENA 3 FHD" → strip suffix → "ANTENA 3"
 *   Case-insensitive compare against XMLTV "Antena 3" → match ✓
 */
export interface NormalizationRule {
  /** Regex pattern stripped from the start of provider stream names (also filters) */
  prefix: string;
  /** Regex pattern stripped from the end of provider stream names */
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

/** Default quality suffix regex, always included in presets */
const QUALITY_SUFFIX = String.raw` FHD$| HD$| SD$| HEVC$| 4K$`;

export const PRESET_RULES: Record<string, { label: string; rule: NormalizationRule }> = {
  spain: {
    label: 'Spain (ES| prefix, quality suffixes)',
    rule: { prefix: String.raw`ES\| `, suffix: QUALITY_SUFFIX },
  },
  uk: {
    label: 'UK (UK| prefix, quality suffixes)',
    rule: { prefix: String.raw`UK\| `, suffix: QUALITY_SUFFIX },
  },
  france: {
    label: 'France (FR| prefix, quality suffixes)',
    rule: { prefix: String.raw`FR\| `, suffix: QUALITY_SUFFIX },
  },
  custom: {
    label: 'Custom (empty — fill in your own)',
    rule: { prefix: '', suffix: '' },
  },
};
