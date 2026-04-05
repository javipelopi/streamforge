/**
 * Video Player Component
 *
 * A modal video player for watching IPTV streams.
 * Uses mpegts.js for client-side MPEG-TS demuxing via Media Source Extensions.
 * Connects directly to the stream proxy — no FFmpeg or temp files needed.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Volume2, VolumeX, Maximize, Minimize, Play, Pause, Loader2, AlertCircle, Tv, ExternalLink } from 'lucide-react';
import mpegts from 'mpegts.js';

/** Set fullscreen — uses Tauri window API in desktop, browser Fullscreen API otherwise */
async function setFullscreenMode(value: boolean): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setFullscreen(value);
  } catch {
    if (value) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }
}

interface VideoPlayerProps {
  /** Whether the player modal is open */
  isOpen: boolean;
  /** Stream URL to play (proxy URL or direct stream URL) */
  url: string | null;
  /** Display title */
  title: string;
  /** Optional channel icon */
  icon?: string | null;
  /** Callback when player is closed */
  onClose: () => void;
  /** Callback to open in external player */
  onOpenExternal?: () => void;
}

export function VideoPlayer({ isOpen, url, title, icon, onClose, onOpenExternal }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<mpegts.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [iconError, setIconError] = useState(false);

  // Reset icon error when icon changes
  useEffect(() => {
    setIconError(false);
  }, [icon]);

  // Destroy mpegts.js player
  const destroyPlayer = useCallback(() => {
    const player = playerRef.current;
    playerRef.current = null;

    if (player) {
      player.pause();
      player.unload();
      player.detachMediaElement();
      player.destroy();
    }
  }, []);

  // Initialize video playback via mpegts.js
  useEffect(() => {
    if (!isOpen || !url || !videoRef.current) return;

    const video = videoRef.current;
    setIsLoading(true);
    setError(null);

    console.log('[VideoPlayer] Loading stream via mpegts.js:', url);

    if (!mpegts.isSupported()) {
      setError('MPEG-TS playback is not supported in this browser (requires Media Source Extensions).');
      setIsLoading(false);
      return;
    }

    const player = mpegts.createPlayer({
      type: 'mpegts',
      isLive: true,
      url: url,
    }, {
      enableWorker: true,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: 10,
      liveBufferLatencyMinRemain: 2,
      lazyLoadMaxDuration: 60,
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 30,
      autoCleanupMinBackwardDuration: 15,
    });

    player.attachMediaElement(video);
    player.load();

    player.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
      console.error('[VideoPlayer] mpegts.js error:', errorType, errorDetail, errorInfo);
      setError(`Stream error: ${errorDetail || errorType}`);
      setIsLoading(false);
    });

    player.on(mpegts.Events.LOADING_COMPLETE, () => {
      console.log('[VideoPlayer] Loading complete (stream ended)');
    });

    // Use video element events for readiness
    const handleCanPlay = () => {
      console.log('[VideoPlayer] Stream ready, starting playback');
      setIsLoading(false);
      video.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.log('[VideoPlayer] Autoplay blocked:', e);
        setIsPlaying(false);
      });
    };

    const handleError = () => {
      if (!playerRef.current) return; // Already destroyed
      const mediaError = video.error;
      console.error('[VideoPlayer] Video element error:', mediaError);
      setError(`Playback error: ${mediaError?.message || 'Unknown error'}`);
      setIsLoading(false);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    playerRef.current = player;

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      destroyPlayer();
      video.src = '';
    };
  }, [isOpen, url, destroyPlayer]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isOpen) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => setIsMuted(video.muted);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [isOpen]);

  // Exit fullscreen when player closes
  useEffect(() => {
    if (!isOpen && isFullscreen) {
      setIsFullscreen(false);
      setFullscreenMode(false).catch(() => {
        // Ignore errors during cleanup
      });
    }
  }, [isOpen, isFullscreen]);

  // Hide controls after inactivity
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (isFullscreen) {
            setIsFullscreen(false);
            try {
              await setFullscreenMode(false);
            } catch (err) {
              console.error('[VideoPlayer] Failed to exit fullscreen:', err);
            }
          } else {
            onClose();
          }
          break;
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'e':
          e.preventDefault();
          if (onOpenExternal) {
            onOpenExternal();
          }
          break;
      }
      resetControlsTimeout();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose, onOpenExternal, resetControlsTimeout]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const toggleFullscreen = async () => {
    const newFullscreen = !isFullscreen;
    setIsFullscreen(newFullscreen);
    try {
      await setFullscreenMode(newFullscreen);
    } catch (e) {
      console.error('[VideoPlayer] Fullscreen error:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? 'bg-black' : 'bg-black/90'}`}
      onClick={isFullscreen ? undefined : onClose}
    >
      <div
        ref={containerRef}
        className={`relative w-full h-full bg-black flex flex-col ${isFullscreen ? '' : 'max-w-6xl max-h-[90vh]'}`}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={resetControlsTimeout}
      >
        {/* Header */}
        <div
          className={`absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon && !iconError ? (
                <img
                  src={icon}
                  alt=""
                  className="w-10 h-10 rounded object-contain"
                  onError={() => setIconError(true)}
                />
              ) : (
                <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
                  <Tv className="w-5 h-5 text-white/60" />
                </div>
              )}
              <h2 className="text-white text-lg font-medium truncate max-w-md">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Close player"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Video container */}
        <div className="flex-1 flex items-center justify-center relative">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            onClick={togglePlayPause}
          />

          {/* Loading overlay */}
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
                <p className="text-white/70 text-sm">Loading stream...</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="flex flex-col items-center gap-3 text-center px-4">
                <AlertCircle className="w-12 h-12 text-red-400" />
                <p className="text-white font-medium">Unable to Play Stream</p>
                <p className="text-white/60 text-sm max-w-md">{error}</p>
                <div className="flex gap-2 mt-2">
                  {onOpenExternal && (
                    <button
                      onClick={onOpenExternal}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in VLC/mpv
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Center play/pause button (shown when paused) */}
          {!isPlaying && !isLoading && !error && (
            <button
              onClick={togglePlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
              aria-label="Play"
            >
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                <Play className="w-10 h-10 text-white ml-1" />
              </div>
            </button>
          )}
        </div>

        {/* Controls bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white" />
                )}
              </button>

              {/* Mute */}
              <button
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Open in external player */}
              {onOpenExternal && (
                <button
                  onClick={onOpenExternal}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Open in external player (VLC/mpv)"
                  title="Open in VLC/mpv"
                >
                  <ExternalLink className="w-5 h-5 text-white" />
                </button>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5 text-white" />
                ) : (
                  <Maximize className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="mt-2 text-center text-white/40 text-xs">
            Space: Play/Pause | M: Mute | F: Fullscreen | E: External Player | Esc: Close
          </div>
        </div>
      </div>
    </div>
  );
}
