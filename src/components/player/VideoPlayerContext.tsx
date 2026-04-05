/**
 * Video Player Context
 *
 * Provides a global video player modal that can be triggered from anywhere in the app.
 * Used for watching streams directly from Sources, Lineup, and EPG views.
 * Supports both built-in HLS.js player and external player (VLC/mpv) option.
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { VideoPlayer } from './VideoPlayer';

/** Dynamically open a URL via Tauri shell plugin, falling back to window.open in browsers */
async function shellOpen(url: string): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  } catch {
    window.open(url, '_blank');
  }
}

interface PlayStreamOptions {
  /** Stream URL to play (used for external player and legacy HLS) */
  url: string;
  /** Display title for the player */
  title: string;
  /** Optional channel/stream icon */
  icon?: string | null;
  /** XMLTV channel ID — when provided, HLS player resolves upstream URL server-side */
  channelId?: number;
}

interface VideoPlayerContextValue {
  /** Whether the player is currently open */
  isOpen: boolean;
  /** Current stream info */
  currentStream: PlayStreamOptions | null;
  /** Open the player with a stream (built-in player) */
  playStream: (options: PlayStreamOptions) => void;
  /** Open stream in external player (VLC/mpv) */
  openInExternalPlayer: (url: string) => Promise<void>;
  /** Close the player */
  closePlayer: () => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

interface VideoPlayerProviderProps {
  children: ReactNode;
}

export function VideoPlayerProvider({ children }: VideoPlayerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStream, setCurrentStream] = useState<PlayStreamOptions | null>(null);

  const playStream = useCallback((options: PlayStreamOptions) => {
    setCurrentStream(options);
    setIsOpen(true);
  }, []);

  const openInExternalPlayer = useCallback(async (url: string) => {
    // In browser mode, external player URL schemes are not available
    if (!(window as unknown as Record<string, unknown>).__TAURI__) {
      alert('External player is only available in the desktop app. Use the built-in player or copy the stream URL.');
      return;
    }

    // Open the stream URL with IINA using its URL scheme
    // IINA is the recommended player for macOS as it handles URL schemes well
    // Format: iina://open?url=<encoded-url>
    // VLC URL scheme (vlc://) doesn't work well with HTTP URLs on macOS
    // Fallback: just open the URL directly (user can set file associations)

    console.log('[VideoPlayer] Opening in external player:', url);

    try {
      // Try IINA first (popular macOS player with good URL scheme support)
      // IINA URL scheme: iina://open?url=<encoded-url>
      const iinaUrl = `iina://open?url=${encodeURIComponent(url)}`;
      console.log('[VideoPlayer] Trying IINA URL scheme:', iinaUrl);
      await shellOpen(iinaUrl);
    } catch (iinaError) {
      console.log('[VideoPlayer] IINA failed, trying VLC URL scheme...', iinaError);
      try {
        // Try VLC URL scheme: vlc://<url>
        // Note: VLC URL scheme may not work with all URL types
        const vlcUrl = `vlc://${url}`;
        await shellOpen(vlcUrl);
      } catch (vlcError) {
        console.log('[VideoPlayer] VLC URL scheme failed, opening URL directly...', vlcError);
        // Fallback: Open the URL directly
        // The OS will use whatever app is configured for the file type/protocol
        // This may open in browser, but user can copy URL and paste into player
        try {
          await shellOpen(url);
        } catch (directError) {
          console.error('[VideoPlayer] All methods failed:', directError);
          throw new Error(
            'Could not open external player. Please install IINA or VLC, or copy the stream URL and open it manually.'
          );
        }
      }
    }
  }, []);

  const closePlayer = useCallback(() => {
    setIsOpen(false);
    // Delay clearing stream info to allow for close animation
    setTimeout(() => {
      setCurrentStream(null);
    }, 300);
  }, []);

  return (
    <VideoPlayerContext.Provider value={{ isOpen, currentStream, playStream, openInExternalPlayer, closePlayer }}>
      {children}
      <VideoPlayer
        isOpen={isOpen}
        url={currentStream?.url ?? null}
        channelId={currentStream?.channelId ?? null}
        title={currentStream?.title ?? ''}
        icon={currentStream?.icon}
        onClose={closePlayer}
        onOpenExternal={() => currentStream && openInExternalPlayer(currentStream.url)}
      />
    </VideoPlayerContext.Provider>
  );
}

/**
 * Hook to access the video player context
 */
export function useVideoPlayer(): VideoPlayerContextValue {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    throw new Error('useVideoPlayer must be used within a VideoPlayerProvider');
  }
  return context;
}
