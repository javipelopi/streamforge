/**
 * Play Button Component
 *
 * A reusable button for playing streams. Can be used with different
 * stream sources (M3U, Xtream, Acestream, XMLTV channels).
 */
import { useState, useCallback } from 'react';
import { Play, ExternalLink, Loader2 } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useVideoPlayer } from './VideoPlayerContext';

interface PlayButtonProps {
  /** Function to get the stream URL (may be async for Xtream) */
  getStreamUrl: () => string | Promise<string>;
  /** Display title for the player */
  title: string;
  /** Optional channel/stream icon */
  icon?: string | null;
  /** XMLTV channel ID — passed through to HLS player for server-side URL resolution */
  channelId?: number;
  /** Optional size variant */
  size?: 'sm' | 'md';
  /** Optional className override */
  className?: string;
}

export function PlayButton({
  getStreamUrl,
  title,
  icon,
  channelId,
  size = 'sm',
  className,
}: PlayButtonProps) {
  const { playStream, openInExternalPlayer } = useVideoPlayer();
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlay = useCallback(async (external: boolean) => {
    console.log('[PlayButton] handlePlay called, external:', external);
    setIsLoading(true);
    setError(null);
    setMenuOpen(false);

    try {
      console.log('[PlayButton] Getting stream URL...');
      const url = await getStreamUrl();
      console.log('[PlayButton] Got stream URL:', url);

      if (external) {
        console.log('[PlayButton] Opening in external player...');
        await openInExternalPlayer(url);
      } else {
        console.log('[PlayButton] Opening in built-in player...');
        playStream({ url, title, icon, channelId });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get stream URL';
      setError(errorMsg);
      console.error('[PlayButton] Failed to play stream:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getStreamUrl, title, icon, channelId, playStream, openInExternalPlayer]);

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const buttonSize = size === 'sm' ? 'p-1.5' : 'p-2';

  return (
    <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isLoading) return;
            // Single click opens menu for player choice
            setMenuOpen(true);
          }}
          disabled={isLoading}
          className={
            className ??
            `${buttonSize} rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-green-600 disabled:opacity-50`
          }
          title="Play stream"
          aria-label={`Play ${title}`}
        >
          {isLoading ? (
            <Loader2 className={`${iconSize} animate-spin`} />
          ) : (
            <Play className={iconSize} />
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="w-48 bg-white rounded-md shadow-lg border z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handlePlay(false)}
            disabled={isLoading}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-md flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Play in App
          </button>
          <button
            type="button"
            onClick={() => handlePlay(true)}
            disabled={isLoading}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-b-md border-t flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open in VLC/mpv
          </button>
          {error && (
            <div className="px-4 py-2 text-xs text-red-600 border-t">
              {error}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
