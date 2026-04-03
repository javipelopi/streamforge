/**
 * Video Player Component
 *
 * A modal video player for watching IPTV streams.
 * Uses local FFmpeg-based HLS proxy for reliable playback of any stream format.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Volume2, VolumeX, Maximize, Minimize, Play, Pause, Loader2, AlertCircle, Tv, ExternalLink } from 'lucide-react';
import Hls from 'hls.js';
import { getServerPort } from '../../lib/api';

/** Toggle fullscreen — uses Tauri window API in desktop, browser Fullscreen API otherwise */
async function toggleFullscreen(value: boolean): Promise<void> {
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

/** Get the server base URL — uses window.location in browser, 127.0.0.1 in Tauri */
function getServerBaseUrl(port: number): string {
  if (typeof window !== 'undefined' && !('__TAURI__' in window)) {
    return window.location.origin;
  }
  return `http://127.0.0.1:${port}`;
}

interface VideoPlayerProps {
  /** Whether the player modal is open */
  isOpen: boolean;
  /** Stream URL to play */
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
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const serverPortRef = useRef<number>(5004);

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

  // Stop HLS session when closing
  const stopSession = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    const hls = hlsRef.current;

    // Clear refs first to prevent double cleanup
    sessionIdRef.current = null;
    hlsRef.current = null;

    if (hls) {
      hls.destroy();
    }

    if (sessionId) {
      // Fire and forget - don't await, and ignore errors (component is unmounting)
      fetch(`${getServerBaseUrl(serverPortRef.current)}/hls/${sessionId}/stop`, {
        method: 'DELETE',
      }).catch(() => {
        // Ignore errors during cleanup
      });
    }
  }, []);

  // Initialize video playback via local HLS proxy
  useEffect(() => {
    if (!isOpen || !url || !videoRef.current) return;

    const video = videoRef.current;
    setIsLoading(true);
    setError(null);

    console.log('[VideoPlayer] Loading stream via HLS proxy:', url);

    const setupStream = async () => {
      try {
        // Get server port
        const serverPort = await getServerPort();
        serverPortRef.current = serverPort;

        // Start HLS session
        console.log('[VideoPlayer] Starting HLS session...');
        const startResponse = await fetch(
          `${getServerBaseUrl(serverPort)}/hls/start?url=${encodeURIComponent(url)}`
        );

        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          throw new Error(errorText || 'Failed to start stream');
        }

        const { session_id } = await startResponse.json();
        sessionIdRef.current = session_id;
        console.log('[VideoPlayer] HLS session started:', session_id);

        // Build the HLS playlist URL
        const hlsUrl = `${getServerBaseUrl(serverPort)}/hls/${session_id}/stream.m3u8`;
        console.log('[VideoPlayer] HLS URL:', hlsUrl);

        // Use HLS.js to play the local HLS stream
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            // Buffer settings - very generous for problematic streams
            backBufferLength: 90,
            maxBufferLength: 60,
            maxMaxBufferLength: 180,
            maxBufferSize: 100 * 1000 * 1000, // 100MB buffer
            // Live stream settings - very tolerant
            liveSyncDurationCount: 5,     // Stay 5 segments behind live edge
            liveMaxLatencyDurationCount: 15, // Allow 15 segments latency
            liveDurationInfinity: true,
            liveBackBufferLength: 90,
            // Be extremely tolerant of buffer gaps
            maxBufferHole: 2.0,           // Allow 2s gaps
            highBufferWatchdogPeriod: 8,  // Wait 8s before stall detection
            nudgeOffset: 0.2,             // Nudge by 200ms when stalled
            nudgeMaxRetry: 10,            // Allow many nudge retries
            // Fragment loading - very generous
            fragLoadingTimeOut: 30000,
            fragLoadingMaxRetry: 10,
            fragLoadingRetryDelay: 500,
            fragLoadingMaxRetryTimeout: 60000,
            // Level loading
            levelLoadingTimeOut: 15000,
            levelLoadingMaxRetry: 6,
            levelLoadingRetryDelay: 500,
            // Manifest loading
            manifestLoadingTimeOut: 15000,
            manifestLoadingMaxRetry: 6,
            manifestLoadingRetryDelay: 500,
            // Start position
            startPosition: -1,
            // ABR settings - stick to single quality
            abrEwmaDefaultEstimate: 5000000,
            startLevel: 0,
            // Error recovery
            enableSoftwareAES: true,
            debug: false,
          });

          hls.loadSource(hlsUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('[VideoPlayer] HLS manifest parsed');
            setIsLoading(false);
            video.play().then(() => {
              console.log('[VideoPlayer] Playback started');
              setIsPlaying(true);
            }).catch((e) => {
              console.log('[VideoPlayer] Autoplay blocked:', e);
              setIsPlaying(false);
            });
          });

          // Track retry attempts for network errors
          let networkRetryCount = 0;
          const maxNetworkRetries = 3;

          // Track media error recovery attempts
          let mediaRecoveryAttempts = 0;
          const maxMediaRecovery = 5;

          hls.on(Hls.Events.ERROR, (_, data) => {
            // Only log errors occasionally to reduce noise
            if (data.fatal || data.details === 'bufferStalledError') {
              console.log('[VideoPlayer] HLS error:', data.type, data.details, 'fatal:', data.fatal);
            }

            if (data.fatal) {
              console.error('[VideoPlayer] Fatal HLS error:', data.type, data.details);

              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  networkRetryCount++;
                  if (networkRetryCount <= maxNetworkRetries) {
                    console.log(`[VideoPlayer] Network error, retry ${networkRetryCount}/${maxNetworkRetries}...`);
                    hls.startLoad();
                  } else {
                    setError('Stream ended or became unavailable.');
                    setIsLoading(false);
                  }
                  break;

                case Hls.ErrorTypes.MEDIA_ERROR:
                  mediaRecoveryAttempts++;
                  if (mediaRecoveryAttempts <= maxMediaRecovery) {
                    console.log(`[VideoPlayer] Media error, recovery attempt ${mediaRecoveryAttempts}/${maxMediaRecovery}...`);
                    if (mediaRecoveryAttempts === 1) {
                      hls.recoverMediaError();
                    } else {
                      // More aggressive recovery - swap audio codec
                      hls.swapAudioCodec();
                      hls.recoverMediaError();
                    }
                  } else {
                    setError('Failed to play stream. The stream may be incompatible.');
                    setIsLoading(false);
                  }
                  break;

                default:
                  setError('Failed to play stream. The stream may be offline or incompatible.');
                  setIsLoading(false);
                  break;
              }
            } else {
              // Non-fatal errors - these are usually recoverable
              if (data.details === 'bufferStalledError') {
                // HLS.js will handle this with nudging based on our config
                // Just ensure video keeps trying to play
                if (video.paused && !video.ended) {
                  video.play().catch(() => {});
                }
              }
              // Reset media recovery counter on successful playback
              if (data.details === 'fragBuffered') {
                mediaRecoveryAttempts = 0;
              }
            }
          });

          // Also listen for successful fragment loading to reset counters
          hls.on(Hls.Events.FRAG_LOADED, () => {
            networkRetryCount = 0;
          });

          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          video.src = hlsUrl;
          video.addEventListener('loadedmetadata', () => {
            setIsLoading(false);
            video.play().catch(() => setIsPlaying(false));
          });
          video.addEventListener('error', () => {
            setError('Failed to play stream.');
            setIsLoading(false);
          });
        } else {
          setError('HLS playback is not supported in this browser.');
          setIsLoading(false);
        }
      } catch (e) {
        console.error('[VideoPlayer] Setup error:', e);
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        if (errorMsg.includes('FFmpeg')) {
          setError('FFmpeg not found. Please install FFmpeg to use the built-in player.');
        } else {
          setError(`Failed to start stream: ${errorMsg}`);
        }
        setIsLoading(false);
      }
    };

    setupStream();

    return () => {
      stopSession();
      video.src = '';
    };
  }, [isOpen, url, stopSession]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isOpen) return;

    const handlePlay = () => {
      console.log('[VideoPlayer] Video play event');
      setIsPlaying(true);
    };
    const handlePause = () => {
      console.log('[VideoPlayer] Video pause event');
      setIsPlaying(false);
    };
    const handleVolumeChange = () => setIsMuted(video.muted);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => {
      console.log('[VideoPlayer] Video playing event');
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
      toggleFullscreen(false).catch(() => {
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
              await toggleFullscreen(false);
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
      await toggleFullscreen(newFullscreen);
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
