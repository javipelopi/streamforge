//! Stream health monitoring for mid-stream failover (Story 4.7)
//!
//! Provides continuous health monitoring of active streams with configurable
//! stall detection and failover triggering thresholds.

use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{watch, Mutex};

use super::buffer::BufferState;

/// Configuration for health monitoring thresholds
#[derive(Debug, Clone)]
pub struct HealthConfig {
    /// Seconds of no data before marking stream as stalled (default: 3)
    pub stall_detection_secs: u64,
    /// Seconds of stall before triggering failover (default: 5)
    pub failover_trigger_secs: u64,
    /// Milliseconds between health checks (default: 1000)
    pub health_check_interval_ms: u64,
}

impl Default for HealthConfig {
    fn default() -> Self {
        Self {
            stall_detection_secs: 3,
            failover_trigger_secs: 5,
            health_check_interval_ms: 1000,
        }
    }
}

/// Health monitoring status for a stream
#[derive(Debug, Clone, PartialEq)]
pub enum HealthStatus {
    /// Stream is healthy, receiving data normally
    Healthy,
    /// Stream is stalled but not yet triggering failover
    Stalled {
        duration: Duration,
        since: Instant,
    },
    /// Stall has exceeded threshold, failover should be triggered
    FailoverNeeded {
        stall_duration: Duration,
    },
    /// Stream has ended (finished or error)
    Ended,
}

/// Monitors the health of a BufferedStream and signals when failover is needed
pub struct StreamHealthMonitor {
    /// Shared buffer state to monitor
    state: Arc<Mutex<BufferState>>,
    /// Configuration for thresholds
    config: HealthConfig,
    /// Channel to signal failover needed
    failover_tx: watch::Sender<bool>,
    /// Receiver for failover signal (clone for handler)
    failover_rx: watch::Receiver<bool>,
    /// Session ID for logging
    session_id: String,
}

impl StreamHealthMonitor {
    /// Create a new health monitor for a buffer state
    pub(crate) fn new(state: Arc<Mutex<BufferState>>, session_id: String) -> Self {
        Self::with_config(state, session_id, HealthConfig::default())
    }

    /// Create a new health monitor with custom configuration
    pub(crate) fn with_config(
        state: Arc<Mutex<BufferState>>,
        session_id: String,
        config: HealthConfig,
    ) -> Self {
        let (failover_tx, failover_rx) = watch::channel(false);
        Self {
            state,
            config,
            failover_tx,
            failover_rx,
            session_id,
        }
    }

    /// Get a receiver for failover signals
    ///
    /// The handler can use this to be notified when failover is needed.
    pub fn failover_receiver(&self) -> watch::Receiver<bool> {
        self.failover_rx.clone()
    }

    /// Check the current health status
    pub async fn check_health(&self) -> HealthStatus {
        let guard = self.state.lock().await;

        // Check if stream has ended
        if guard.finished {
            return HealthStatus::Ended;
        }

        // Check if we have received any data
        let last_data_time = match guard.last_data_time {
            Some(t) => t,
            None => {
                // No data yet - if prefill not done, still healthy (startup)
                if !guard.prefill_done {
                    return HealthStatus::Healthy;
                }
                // Prefill done but no data timestamp - treat as ended
                return HealthStatus::Ended;
            }
        };

        // Calculate stall duration
        let stall_duration = last_data_time.elapsed();
        let stall_secs = stall_duration.as_secs();

        if stall_secs >= self.config.failover_trigger_secs {
            // Stall exceeded failover threshold
            HealthStatus::FailoverNeeded { stall_duration }
        } else if stall_secs >= self.config.stall_detection_secs {
            // Stall detected but not yet at failover threshold
            HealthStatus::Stalled {
                duration: stall_duration,
                since: last_data_time,
            }
        } else {
            HealthStatus::Healthy
        }
    }

    /// Start the health monitoring loop
    ///
    /// This spawns a background task that periodically checks stream health
    /// and signals when failover is needed. Returns the task handle.
    pub fn start_monitoring(self) -> tokio::task::JoinHandle<()> {
        let session_id = self.session_id.clone();
        tokio::spawn(async move {
            self.monitor_loop(session_id).await;
        })
    }

    /// Internal monitoring loop
    async fn monitor_loop(self, session_id: String) {
        let interval_duration = Duration::from_millis(self.config.health_check_interval_ms);
        let mut interval = tokio::time::interval(interval_duration);
        let mut stall_logged = false;

        loop {
            interval.tick().await;

            let status = self.check_health().await;

            match status {
                HealthStatus::Healthy => {
                    if stall_logged {
                        eprintln!(
                            "[INFO] stream:{} health recovered, data flowing normally",
                            session_id
                        );
                        stall_logged = false;
                    }
                }
                HealthStatus::Stalled { duration, .. } => {
                    if !stall_logged {
                        eprintln!(
                            "[WARN] stream:{} stall detected, no data for {:.1}s",
                            session_id,
                            duration.as_secs_f64()
                        );
                        stall_logged = true;
                    }
                }
                HealthStatus::FailoverNeeded { stall_duration } => {
                    eprintln!(
                        "[INFO] stream:{} stall exceeded threshold ({:.1}s), initiating failover",
                        session_id,
                        stall_duration.as_secs_f64()
                    );
                    // Signal failover needed
                    let _ = self.failover_tx.send(true);
                    // Continue monitoring in case failover succeeds and data resumes
                }
                HealthStatus::Ended => {
                    eprintln!("[INFO] stream:{} ended, stopping health monitor", session_id);
                    break;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::Bytes;
    use std::collections::VecDeque;
    use std::task::Waker;

    /// Create a test BufferState with specified parameters
    fn create_test_state(
        last_data_time: Option<Instant>,
        finished: bool,
        prefill_done: bool,
    ) -> Arc<Mutex<BufferState>> {
        Arc::new(Mutex::new(BufferState {
            buffer: VecDeque::new(),
            total_bytes: 0,
            bytes_received: 0,
            bytes_sent: 0,
            start_time: Some(Instant::now()),
            finished,
            prefill_done,
            error: None,
            waker: None,
            last_data_time,
            stall_detected: false,
            stall_start_time: None,
        }))
    }

    #[test]
    fn test_health_config_defaults() {
        let config = HealthConfig::default();
        assert_eq!(config.stall_detection_secs, 3);
        assert_eq!(config.failover_trigger_secs, 5);
        assert_eq!(config.health_check_interval_ms, 1000);
    }

    #[tokio::test]
    async fn test_health_status_healthy() {
        // Stream with recent data
        let state = create_test_state(Some(Instant::now()), false, true);
        let monitor = StreamHealthMonitor::new(state, "test-session".to_string());

        let status = monitor.check_health().await;
        assert_eq!(status, HealthStatus::Healthy);
    }

    #[tokio::test]
    async fn test_health_status_ended() {
        // Finished stream
        let state = create_test_state(Some(Instant::now()), true, true);
        let monitor = StreamHealthMonitor::new(state, "test-session".to_string());

        let status = monitor.check_health().await;
        assert_eq!(status, HealthStatus::Ended);
    }

    #[tokio::test]
    async fn test_health_status_stalled() {
        // Stream with data 4 seconds ago (stall_detection_secs = 3)
        let four_secs_ago = Instant::now() - Duration::from_secs(4);
        let state = create_test_state(Some(four_secs_ago), false, true);
        let monitor = StreamHealthMonitor::new(state, "test-session".to_string());

        let status = monitor.check_health().await;
        match status {
            HealthStatus::Stalled { duration, .. } => {
                assert!(duration.as_secs() >= 4);
            }
            _ => panic!("Expected Stalled status, got {:?}", status),
        }
    }

    #[tokio::test]
    async fn test_health_status_failover_needed() {
        // Stream with data 6 seconds ago (failover_trigger_secs = 5)
        let six_secs_ago = Instant::now() - Duration::from_secs(6);
        let state = create_test_state(Some(six_secs_ago), false, true);
        let monitor = StreamHealthMonitor::new(state, "test-session".to_string());

        let status = monitor.check_health().await;
        match status {
            HealthStatus::FailoverNeeded { stall_duration } => {
                assert!(stall_duration.as_secs() >= 6);
            }
            _ => panic!("Expected FailoverNeeded status, got {:?}", status),
        }
    }

    #[tokio::test]
    async fn test_health_status_prefill_not_done() {
        // Stream still in prefill (no last_data_time yet)
        let state = create_test_state(None, false, false);
        let monitor = StreamHealthMonitor::new(state, "test-session".to_string());

        let status = monitor.check_health().await;
        assert_eq!(status, HealthStatus::Healthy);
    }

    #[tokio::test]
    async fn test_failover_receiver() {
        let state = create_test_state(Some(Instant::now()), false, true);
        let monitor = StreamHealthMonitor::new(state, "test-session".to_string());

        let rx = monitor.failover_receiver();
        // Initial value should be false
        assert!(!*rx.borrow());
    }

    #[test]
    fn test_custom_health_config() {
        let config = HealthConfig {
            stall_detection_secs: 2,
            failover_trigger_secs: 4,
            health_check_interval_ms: 500,
        };

        assert_eq!(config.stall_detection_secs, 2);
        assert_eq!(config.failover_trigger_secs, 4);
        assert_eq!(config.health_check_interval_ms, 500);
    }
}
