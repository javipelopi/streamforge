/**
 * Factory functions for EPG Program Details test data
 */

export interface ProgramWithChannel {
  program: {
    id: number;
    xmltvChannelId: number;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    category?: string;
    episodeInfo?: string;
  };
  channel: {
    id: number;
    displayName: string;
    icon?: string;
  };
}

/**
 * Create mock program with channel data
 */
export function createProgramWithChannel(overrides?: Partial<ProgramWithChannel>): ProgramWithChannel {
  const now = new Date();

  return {
    program: {
      id: Math.floor(Math.random() * 10000),
      xmltvChannelId: 100,
      title: 'Test Program',
      description: 'Test program description for EPG details panel',
      startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      category: 'Drama',
      episodeInfo: 'Season 1, Episode 1',
      ...overrides?.program,
    },
    channel: {
      id: 100,
      displayName: 'Test Channel',
      icon: 'https://example.com/icon.png',
      ...overrides?.channel,
    },
  };
}

/**
 * Format time range for display (e.g., "8:00 AM - 9:30 AM")
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

  return `${start.toLocaleTimeString('en-US', options)} - ${end.toLocaleTimeString('en-US', options)}`;
}

/**
 * Format full date (e.g., "Tuesday, January 21")
 */
export function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get program status based on current time
 */
export function getProgramStatus(
  startTime: string,
  endTime: string
): { status: 'live' | 'upcoming' | 'aired'; label: string; color: string } {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (now >= start && now <= end) {
    return { status: 'live', label: 'Live Now', color: 'text-green-500' };
  }

  if (now < start) {
    const diffMs = start.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes < 60) {
      return { status: 'upcoming', label: `Starts in ${diffMinutes} min`, color: 'text-blue-500' };
    }
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
      return { status: 'upcoming', label: `Starts in ${diffHours}h`, color: 'text-blue-500' };
    }
    return {
      status: 'upcoming',
      label: `Starts ${formatTimeDisplay(start)}`,
      color: 'text-blue-500',
    };
  }

  return { status: 'aired', label: `Aired at ${formatTimeDisplay(start)}`, color: 'text-gray-500' };
}

/**
 * Format time for display (e.g., "8:00 AM")
 */
function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
