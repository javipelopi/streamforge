import { useEffect, useRef } from 'react';
import {
  formatProgramDuration,
  getQualityBadgeClasses,
  type ChannelStreamInfo,
  type EpgGridChannel,
  type EpgGridProgram,
} from '../../lib/tauri';

// Re-export ChannelStreamInfo for consumers
export type { ChannelStreamInfo } from '../../lib/tauri';

/**
 * Extended program details that combines program data with channel info
 * This is the data structure needed for the details panel
 */
export interface ProgramDetailsData {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  category?: string;
  episodeInfo?: string;
  channelId: number;
  channelName: string;
  channelIcon?: string;
}

/**
 * Props for ProgramDetailsPanel component
 */
export interface ProgramDetailsPanelProps {
  /** Program details to display */
  program: ProgramDetailsData | null;
  /** Handler when panel is closed */
  onClose: () => void;
  /** Optional stream info (fetched separately via API) */
  streamInfo?: ChannelStreamInfo | null;
  /** Whether stream info is loading */
  isLoadingStreamInfo?: boolean;
}

/**
 * Format XMLTV episode info to S##E## format
 * XMLTV format: "1.4." means Season 2, Episode 5 (0-indexed)
 *
 * @param episodeInfo - Raw episode info from XMLTV
 * @returns Formatted episode string like "S02E05" or null if not parseable
 */
function formatEpisodeInfo(episodeInfo?: string): string | null {
  if (!episodeInfo) return null;

  // XMLTV format: "season.episode." (0-indexed)
  // Example: "1.4." means Season 2, Episode 5
  const match = episodeInfo.match(/^(\d+)\.(\d+)\./);
  if (match) {
    const season = parseInt(match[1], 10) + 1;
    const episode = parseInt(match[2], 10) + 1;
    return `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
  }

  // Try alternate format: "S01E05" already formatted
  const altMatch = episodeInfo.match(/S(\d{2})E(\d{2})/i);
  if (altMatch) {
    return `S${altMatch[1]}E${altMatch[2]}`;
  }

  return episodeInfo; // Return as-is if not parseable
}

/**
 * Format time for display
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * ProgramDetailsPanel component - Slide-in panel for program details
 *
 * Story 5.3: Program Details View
 * AC #1: Display program details (title, channel, times, duration, description, category, episode)
 * AC #2: Panel closes on click outside or Escape key
 * AC #3: Stream info displays for channels with Xtream mappings
 *
 * Features:
 * - Slide-in from right side
 * - Fixed 400px width, full height
 * - Click outside or Escape to close
 * - Close button (X) in header
 * - Graceful empty states for optional fields
 * - Stream info with quality badges
 */
export function ProgramDetailsPanel({
  program,
  onClose,
  streamInfo,
  isLoadingStreamInfo = false,
}: ProgramDetailsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle Escape key to close panel
  useEffect(() => {
    if (!program) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [program, onClose]);

  // Don't render if no program selected
  if (!program) {
    return null;
  }

  // Calculate duration
  const duration = formatProgramDuration(program.startTime, program.endTime);

  // Format episode info
  const formattedEpisodeInfo = formatEpisodeInfo(program.episodeInfo);

  return (
    <div data-testid="program-details-overlay" className="fixed inset-0 z-50">
      {/* Backdrop - click to close */}
      <div
        data-testid="program-details-backdrop"
        className="absolute inset-0 bg-black/20 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel - slides in from right */}
      <div
        ref={panelRef}
        data-testid="program-details-panel"
        className="absolute right-0 top-0 h-full w-[400px] bg-white shadow-xl transform transition-transform duration-200 ease-out overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-details-title"
      >
        {/* Header with close button */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h2
            id="program-details-title"
            data-testid="program-details-title"
            className="text-lg font-semibold text-gray-900 truncate pr-4"
          >
            {program.title}
          </h2>
          <button
            data-testid="program-details-close"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Channel Info */}
          <div className="flex items-center space-x-3">
            {program.channelIcon ? (
              <img
                data-testid="program-details-channel-logo"
                src={program.channelIcon}
                alt={program.channelName}
                className="w-12 h-12 object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
            <div>
              <p
                data-testid="program-details-channel-name"
                className="font-medium text-gray-900"
              >
                {program.channelName}
              </p>
            </div>
          </div>

          {/* Time Info */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Start</span>
              <span
                data-testid="program-details-start-time"
                className="font-medium text-gray-900"
              >
                {formatTime(program.startTime)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">End</span>
              <span
                data-testid="program-details-end-time"
                className="font-medium text-gray-900"
              >
                {formatTime(program.endTime)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Duration</span>
              <span
                data-testid="program-details-duration"
                className="font-medium text-gray-900"
              >
                {duration}
              </span>
            </div>
          </div>

          {/* Episode Info (if available) */}
          {formattedEpisodeInfo && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 text-sm">Episode</span>
              <span
                data-testid="program-details-episode-info"
                className="px-2 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded"
              >
                {formattedEpisodeInfo}
              </span>
            </div>
          )}

          {/* Category (if available) */}
          {program.category && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 text-sm">Category</span>
              <span
                data-testid="program-details-category"
                className="px-2 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded"
              >
                {program.category}
              </span>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
            <p
              data-testid="program-details-description"
              className="text-gray-700 text-sm"
            >
              {program.description || 'No description available'}
            </p>
          </div>

          {/* Stream Info Section */}
          <div data-testid="program-details-stream-info" className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Stream Source</h3>

            {isLoadingStreamInfo ? (
              <div className="flex items-center space-x-2 text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
                <span className="text-sm">Loading stream info...</span>
              </div>
            ) : streamInfo ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    data-testid="program-details-stream-name"
                    className="text-sm font-medium text-gray-900"
                  >
                    {streamInfo.streamName}
                  </span>
                  {streamInfo.isPrimary && (
                    <span
                      data-testid="program-details-stream-primary"
                      className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded"
                    >
                      Primary
                    </span>
                  )}
                </div>

                {/* Quality Tiers */}
                {streamInfo.qualityTiers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {streamInfo.qualityTiers.map((tier) => (
                      <span
                        key={tier}
                        data-testid={`program-details-quality-badge-${tier}`}
                        className={`px-2 py-0.5 text-xs font-medium rounded ${getQualityBadgeClasses(tier)}`}
                      >
                        {tier}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p
                data-testid="program-details-no-stream"
                className="text-sm text-gray-500 italic"
              >
                No stream source available
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper function to create ProgramDetailsData from EpgGridProgram and channel
 * Use this when you have separate program and channel data
 */
export function createProgramDetailsData(
  program: EpgGridProgram,
  channel: EpgGridChannel
): ProgramDetailsData {
  return {
    id: program.id,
    title: program.title,
    startTime: program.startTime,
    endTime: program.endTime,
    description: program.description,
    category: program.category,
    episodeInfo: program.episodeInfo,
    channelId: channel.channelId,
    channelName: channel.channelName,
    channelIcon: channel.channelIcon,
  };
}
