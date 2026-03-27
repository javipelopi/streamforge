/**
 * Video Player Context
 *
 * Provides a global video player modal that can be triggered from anywhere in the app.
 * Used for watching streams directly from Sources, Lineup, and EPG views.
 * Supports both built-in HLS.js player and external player (VLC/mpv) option.
 */
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { VideoPlayer } from './VideoPlayer';
import { getServerPort, buildProxyStreamUrl } from '../../lib/tauri';

export interface PlayStreamOptions {
  /** Stream URL to play */
  url: string;
  /** Display title for the player */
  title: string;
  /** Optional channel/stream icon */
  icon?: string | null;
  /** Optional channel ID for channel switching */
  channelId?: number;
}

export interface ChannelInfo {
  channelId: number;
  channelName: string;
  channelIcon?: string;
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
  /** Set the channel list for channel switching */
  setChannelList: (channels: ChannelInfo[]) => void;
  /** Switch to next channel */
  nextChannel: () => void;
  /** Switch to previous channel */
  prevChannel: () => void;
  /** Whether channel switching is available */
  hasChannelList: boolean;
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

interface VideoPlayerProviderProps {
  children: ReactNode;
}

export function VideoPlayerProvider({ children }: VideoPlayerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStream, setCurrentStream] = useState<PlayStreamOptions | null>(null);
  const channelListRef = useRef<ChannelInfo[]>([]);

  const setChannelList = useCallback((channels: ChannelInfo[]) => {
    channelListRef.current = channels;
  }, []);

  const playStream = useCallback((options: PlayStreamOptions) => {
    setCurrentStream(options);
    setIsOpen(true);
  }, []);

  const openInExternalPlayer = useCallback(async (url: string) => {
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
      await open(iinaUrl);
    } catch (iinaError) {
      console.log('[VideoPlayer] IINA failed, trying VLC URL scheme...', iinaError);
      try {
        // Try VLC URL scheme: vlc://<url>
        // Note: VLC URL scheme may not work with all URL types
        const vlcUrl = `vlc://${url}`;
        await open(vlcUrl);
      } catch (vlcError) {
        console.log('[VideoPlayer] VLC URL scheme failed, opening URL directly...', vlcError);
        // Fallback: Open the URL directly
        // The OS will use whatever app is configured for the file type/protocol
        // This may open in browser, but user can copy URL and paste into player
        try {
          await open(url);
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

  const switchToChannel = useCallback(async (channel: ChannelInfo) => {
    try {
      const port = await getServerPort();
      const url = buildProxyStreamUrl(channel.channelId, port);
      setCurrentStream({
        url,
        title: channel.channelName,
        icon: channel.channelIcon,
        channelId: channel.channelId,
      });
    } catch (err) {
      console.error('[VideoPlayer] Failed to switch channel:', err);
    }
  }, []);

  const nextChannel = useCallback(() => {
    const channels = channelListRef.current;
    if (channels.length === 0 || !currentStream?.channelId) return;
    const currentIndex = channels.findIndex(c => c.channelId === currentStream.channelId);
    const nextIndex = currentIndex < channels.length - 1 ? currentIndex + 1 : 0;
    switchToChannel(channels[nextIndex]);
  }, [currentStream, switchToChannel]);

  const prevChannel = useCallback(() => {
    const channels = channelListRef.current;
    if (channels.length === 0 || !currentStream?.channelId) return;
    const currentIndex = channels.findIndex(c => c.channelId === currentStream.channelId);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : channels.length - 1;
    switchToChannel(channels[prevIndex]);
  }, [currentStream, switchToChannel]);

  const hasChannelList = channelListRef.current.length > 0 && !!currentStream?.channelId;

  return (
    <VideoPlayerContext.Provider value={{
      isOpen, currentStream, playStream, openInExternalPlayer, closePlayer,
      setChannelList, nextChannel, prevChannel, hasChannelList,
    }}>
      {children}
      <VideoPlayer
        isOpen={isOpen}
        url={currentStream?.url ?? null}
        title={currentStream?.title ?? ''}
        icon={currentStream?.icon}
        onClose={closePlayer}
        onOpenExternal={() => currentStream && openInExternalPlayer(currentStream.url)}
        onNextChannel={hasChannelList ? nextChannel : undefined}
        onPrevChannel={hasChannelList ? prevChannel : undefined}
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
