//! FFmpeg-based stream with input-matched output pacing
//!
//! Outputs data at the same rate it's received from FFmpeg,
//! preventing buffer drain faster than the source provides.
//!
//! # Requirements
//!
//! FFmpeg must be installed and available in the system PATH.
//! See README.md for installation instructions.

use bytes::Bytes;
use futures_util::Stream;
use std::collections::VecDeque;
use std::io;
use std::pin::Pin;
use std::process::Stdio;
use std::sync::Arc;
use std::task::{Context, Poll, Waker};
use std::time::Instant;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use super::stream::StreamManager;

/// MPEG-TS packet size in bytes (fixed by spec)
const MPEGTS_PACKET_SIZE: usize = 188;

/// Number of MPEG-TS packets per read buffer.
/// 1000 packets ≈ 188KB, balancing between syscall overhead and latency.
const PACKETS_PER_READ: usize = 1000;

#[derive(Debug, Clone)]
pub struct BufferConfig {
    /// Size of each read from FFmpeg stdout.
    /// Defaults to 188KB (1000 MPEG-TS packets).
    pub read_buffer_size: usize,
    /// Bytes to buffer before starting playback.
    /// Defaults to 2MB for smooth start without stalls.
    pub prefill_bytes: usize,
}

impl Default for BufferConfig {
    fn default() -> Self {
        Self {
            // 1000 MPEG-TS packets per read - balances syscall overhead vs latency
            read_buffer_size: MPEGTS_PACKET_SIZE * PACKETS_PER_READ,
            // 2MB prefill provides ~10 seconds of buffer at typical IPTV bitrates
            prefill_bytes: 2 * 1024 * 1024,
        }
    }
}

/// Check if FFmpeg is available in PATH
pub fn check_ffmpeg_available() -> Result<(), io::Error> {
    match std::process::Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
    {
        Ok(status) if status.success() => Ok(()),
        Ok(_) => Err(io::Error::new(
            io::ErrorKind::Other,
            "FFmpeg returned non-zero exit code",
        )),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Err(io::Error::new(
            io::ErrorKind::NotFound,
            "FFmpeg not found. Please install FFmpeg and ensure it's in your PATH. \
             See README.md for installation instructions.",
        )),
        Err(e) => Err(e),
    }
}

struct BufferState {
    buffer: VecDeque<Bytes>,
    total_bytes: usize,
    bytes_received: usize,
    bytes_sent: usize,
    start_time: Option<Instant>,
    finished: bool,
    prefill_done: bool,
    error: Option<io::Error>,
    waker: Option<Waker>,
}

pub struct BufferedStream {
    state: Arc<Mutex<BufferState>>,
    reader_handle: tokio::task::JoinHandle<()>,
    stderr_handle: tokio::task::JoinHandle<()>,
    session_id: String,
    stream_manager: Arc<StreamManager>,
}

impl BufferedStream {
    pub fn new(
        upstream_url: &str,
        config: BufferConfig,
        session_id: String,
        stream_manager: Arc<StreamManager>,
    ) -> Result<Self, io::Error> {
        // Verify FFmpeg is available before attempting to spawn
        check_ffmpeg_available()?;

        let mut child = Command::new("ffmpeg")
            .args([
                "-hide_banner",
                "-loglevel", "warning",
                "-reconnect", "1",
                "-reconnect_streamed", "1",
                "-reconnect_delay_max", "2",
                "-i", upstream_url,
                "-c", "copy",
                "-f", "mpegts",
                "-fflags", "+genpts",
                "-mpegts_flags", "+initial_discontinuity",
                "-",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let state = Arc::new(Mutex::new(BufferState {
            buffer: VecDeque::new(),
            total_bytes: 0,
            bytes_received: 0,
            bytes_sent: 0,
            start_time: None,
            finished: false,
            prefill_done: false,
            error: None,
            waker: None,
        }));

        let reader_state = state.clone();
        let prefill_bytes = config.prefill_bytes;
        let read_size = config.read_buffer_size;
        let stderr_session_id = session_id.clone();

        // Spawn reader task for stdout
        let reader_handle = tokio::spawn(async move {
            Self::reader_task(stdout, child, reader_state, read_size, prefill_bytes).await;
        });

        // Spawn stderr handler to log FFmpeg warnings/errors with session context
        let stderr_handle = tokio::spawn(async move {
            Self::stderr_task(stderr, stderr_session_id).await;
        });

        Ok(Self {
            state,
            reader_handle,
            stderr_handle,
            session_id,
            stream_manager,
        })
    }

    /// Handle FFmpeg stderr output - log warnings/errors with session context
    async fn stderr_task(stderr: Option<tokio::process::ChildStderr>, session_id: String) {
        let stderr = match stderr {
            Some(s) => s,
            None => return,
        };

        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            // Filter out noisy but harmless FFmpeg messages
            if line.contains("Last message repeated") {
                continue;
            }
            eprintln!("FFmpeg [{}]: {}", session_id, line);
        }
    }

    async fn reader_task(
        stdout: Option<tokio::process::ChildStdout>,
        _child: Child,
        state: Arc<Mutex<BufferState>>,
        read_size: usize,
        prefill_bytes: usize,
    ) {
        let mut stdout = match stdout {
            Some(s) => s,
            None => {
                let mut guard = state.lock().await;
                guard.error = Some(io::Error::new(io::ErrorKind::BrokenPipe, "No stdout"));
                guard.finished = true;
                if let Some(w) = guard.waker.take() { w.wake(); }
                return;
            }
        };

        let mut buf = vec![0u8; read_size];

        loop {
            match stdout.read(&mut buf).await {
                Ok(0) => {
                    let mut guard = state.lock().await;
                    guard.finished = true;
                    guard.prefill_done = true;
                    if let Some(w) = guard.waker.take() { w.wake(); }
                    break;
                }
                Ok(n) => {
                    let chunk = Bytes::copy_from_slice(&buf[..n]);
                    let mut guard = state.lock().await;

                    // Initialize start time on first data
                    if guard.start_time.is_none() {
                        guard.start_time = Some(Instant::now());
                    }

                    guard.buffer.push_back(chunk);
                    guard.total_bytes += n;
                    guard.bytes_received += n;

                    // Check prefill
                    if !guard.prefill_done && guard.bytes_received >= prefill_bytes {
                        guard.prefill_done = true;
                        eprintln!("Buffer: prefill done, {}KB buffered", guard.total_bytes / 1024);
                    }

                    if let Some(w) = guard.waker.take() { w.wake(); }
                }
                Err(e) => {
                    let mut guard = state.lock().await;
                    guard.error = Some(e);
                    guard.finished = true;
                    guard.prefill_done = true;
                    if let Some(w) = guard.waker.take() { w.wake(); }
                    break;
                }
            }
        }
    }
}

impl Stream for BufferedStream {
    type Item = Result<Bytes, io::Error>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.get_mut();

        let mut guard = match this.state.try_lock() {
            Ok(g) => g,
            Err(_) => {
                cx.waker().wake_by_ref();
                return Poll::Pending;
            }
        };

        // Wait for prefill
        if !guard.prefill_done {
            guard.waker = Some(cx.waker().clone());
            return Poll::Pending;
        }

        // Check error
        if let Some(e) = guard.error.take() {
            return Poll::Ready(Some(Err(e)));
        }

        // No pacing - send data as fast as available
        // Let VLC/Plex handle their own buffering

        // Send data
        if let Some(chunk) = guard.buffer.pop_front() {
            let len = chunk.len();
            guard.total_bytes -= len;
            guard.bytes_sent += len;

            // Log periodically (every ~5MB sent)
            if guard.bytes_sent % (5 * 1024 * 1024) < len {
                let elapsed_secs = guard.start_time
                    .map(|t| t.elapsed().as_secs())
                    .unwrap_or(0)
                    .max(1); // Avoid division by zero
                // Use u64 arithmetic to avoid overflow, then convert to display
                let in_rate_kbps = (guard.bytes_received as u64 / elapsed_secs) / 1024;
                let out_rate_kbps = (guard.bytes_sent as u64 / elapsed_secs) / 1024;
                eprintln!("Buffer: {}KB queued, in={}KB/s out={}KB/s",
                    guard.total_bytes / 1024, in_rate_kbps, out_rate_kbps);
            }

            return Poll::Ready(Some(Ok(chunk)));
        }

        // Buffer empty
        if guard.finished {
            return Poll::Ready(None);
        }

        guard.waker = Some(cx.waker().clone());
        Poll::Pending
    }
}

impl Drop for BufferedStream {
    fn drop(&mut self) {
        // Abort both FFmpeg output handlers
        self.reader_handle.abort();
        self.stderr_handle.abort();
        // End the stream session to free up tuner slot
        self.stream_manager.end_session(&self.session_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // BufferConfig Tests
    // =========================================================================

    #[test]
    fn test_buffer_config_defaults() {
        let config = BufferConfig::default();

        // Verify read buffer is 1000 MPEG-TS packets (188 * 1000 = 188000 bytes)
        assert_eq!(config.read_buffer_size, MPEGTS_PACKET_SIZE * PACKETS_PER_READ);
        assert_eq!(config.read_buffer_size, 188_000);

        // Verify prefill is 2MB
        assert_eq!(config.prefill_bytes, 2 * 1024 * 1024);
    }

    #[test]
    fn test_buffer_config_custom() {
        let config = BufferConfig {
            read_buffer_size: 1024,
            prefill_bytes: 512 * 1024,
        };

        assert_eq!(config.read_buffer_size, 1024);
        assert_eq!(config.prefill_bytes, 512 * 1024);
    }

    #[test]
    fn test_buffer_config_clone() {
        let config1 = BufferConfig::default();
        let config2 = config1.clone();

        assert_eq!(config1.read_buffer_size, config2.read_buffer_size);
        assert_eq!(config1.prefill_bytes, config2.prefill_bytes);
    }

    // =========================================================================
    // FFmpeg Availability Tests
    // =========================================================================

    #[test]
    fn test_check_ffmpeg_available() {
        // This test verifies the function works - actual result depends on environment
        let result = check_ffmpeg_available();

        // Either FFmpeg is installed (Ok) or it's not found (specific error)
        match result {
            Ok(()) => {
                // FFmpeg is installed - test passes
            }
            Err(e) => {
                // Should be a meaningful error, not a generic one
                let msg = e.to_string();
                assert!(
                    msg.contains("FFmpeg not found") ||
                    msg.contains("non-zero exit code") ||
                    msg.contains("No such file"),
                    "Unexpected error message: {}", msg
                );
            }
        }
    }

    // =========================================================================
    // Constants Tests
    // =========================================================================

    #[test]
    fn test_mpegts_packet_size_is_standard() {
        // MPEG-TS packet size is defined by the spec as 188 bytes
        assert_eq!(MPEGTS_PACKET_SIZE, 188);
    }

    #[test]
    fn test_packets_per_read_is_reasonable() {
        // Should be between 100 and 10000 packets per read
        assert!(PACKETS_PER_READ >= 100);
        assert!(PACKETS_PER_READ <= 10000);
    }
}
