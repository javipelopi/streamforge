//! EPG Scheduler Module
//!
//! This module provides scheduled background refresh of EPG data from XMLTV sources.
//! Uses tokio-cron-scheduler for robust cron-based job scheduling.
//!
//! Story 2-6: Implement Scheduled EPG Refresh

use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler, JobSchedulerError};
use uuid::Uuid;

use crate::db::DbPool;

/// Error types for scheduler operations
#[derive(Debug, thiserror::Error)]
pub enum SchedulerError {
    #[error("Scheduler error: {0}")]
    SchedulerError(String),

    #[error("Invalid schedule: {0}")]
    InvalidSchedule(String),

    #[error("Database error: {0}")]
    DatabaseError(String),
}

impl From<JobSchedulerError> for SchedulerError {
    fn from(err: JobSchedulerError) -> Self {
        SchedulerError::SchedulerError(err.to_string())
    }
}

/// EPG Scheduler that manages scheduled refresh jobs
///
/// The scheduler maintains a single cron job that triggers EPG refresh
/// at the configured time each day.
#[derive(Clone)]
pub struct EpgScheduler {
    scheduler: Arc<RwLock<Option<JobScheduler>>>,
    job_uuid: Arc<RwLock<Option<Uuid>>>,
    db_pool: Arc<RwLock<Option<DbPool>>>,
    enabled: Arc<RwLock<bool>>,
}

impl EpgScheduler {
    /// Create a new EpgScheduler instance
    ///
    /// The scheduler is created in an uninitialized state. Call `start()` to
    /// initialize the underlying job scheduler.
    pub fn new() -> Self {
        Self {
            scheduler: Arc::new(RwLock::new(None)),
            job_uuid: Arc::new(RwLock::new(None)),
            db_pool: Arc::new(RwLock::new(None)),
            enabled: Arc::new(RwLock::new(true)),
        }
    }

    /// Set the database pool for refresh operations
    pub async fn set_db_pool(&self, pool: DbPool) {
        let mut db = self.db_pool.write().await;
        *db = Some(pool);
    }

    /// Start the scheduler
    ///
    /// Initializes the underlying JobScheduler and starts processing jobs.
    /// Must be called before scheduling any refresh jobs.
    pub async fn start(&self) -> Result<(), SchedulerError> {
        let sched = JobScheduler::new().await?;
        sched.start().await?;

        let mut scheduler = self.scheduler.write().await;
        *scheduler = Some(sched);

        tracing::info!("EPG Scheduler started");
        Ok(())
    }

    /// Stop the scheduler gracefully
    ///
    /// Stops all scheduled jobs and shuts down the scheduler.
    pub async fn stop(&self) -> Result<(), SchedulerError> {
        // Remove the job first
        if let Some(uuid) = *self.job_uuid.read().await {
            if let Some(ref sched) = *self.scheduler.read().await {
                let _ = sched.remove(&uuid).await;
            }
        }

        // Shutdown the scheduler
        if let Some(ref mut sched) = *self.scheduler.write().await {
            sched.shutdown().await?;
        }

        // Clear state
        {
            let mut scheduler = self.scheduler.write().await;
            *scheduler = None;
        }
        {
            let mut job_uuid = self.job_uuid.write().await;
            *job_uuid = None;
        }

        tracing::info!("EPG Scheduler stopped");
        Ok(())
    }

    /// Update the refresh schedule
    ///
    /// Creates or updates the cron job with the new schedule.
    /// The job will trigger at the specified hour and minute each day.
    ///
    /// # Arguments
    /// * `hour` - Hour of the day (0-23)
    /// * `minute` - Minute of the hour (0-59)
    ///
    /// # Errors
    /// Returns error if scheduler is not started or schedule is invalid
    pub async fn update_schedule(&self, hour: u8, minute: u8) -> Result<(), SchedulerError> {
        // Validate inputs
        if hour > 23 {
            return Err(SchedulerError::InvalidSchedule(format!(
                "Hour must be 0-23, got {}",
                hour
            )));
        }
        if minute > 59 {
            return Err(SchedulerError::InvalidSchedule(format!(
                "Minute must be 0-59, got {}",
                minute
            )));
        }

        let scheduler_guard = self.scheduler.read().await;
        let sched = scheduler_guard.as_ref().ok_or_else(|| {
            SchedulerError::SchedulerError("Scheduler not started".to_string())
        })?;

        // Remove existing job if any
        if let Some(uuid) = *self.job_uuid.read().await {
            let _ = sched.remove(&uuid).await;
            tracing::info!("Removed existing EPG refresh job");
        }

        // Check if scheduler is enabled
        if !*self.enabled.read().await {
            tracing::info!("EPG scheduler is disabled, not creating job");
            let mut job_uuid = self.job_uuid.write().await;
            *job_uuid = None;
            return Ok(());
        }

        // Create cron expression
        // Format: "sec min hour day-of-month month day-of-week"
        let cron_expr = build_cron_expression(hour, minute);
        tracing::info!("Creating EPG refresh job with cron: {}", cron_expr);

        // Clone pool for the job closure
        let db_pool = self.db_pool.clone();

        // Create the job
        let job = Job::new_async(cron_expr.as_str(), move |_uuid, _lock| {
            let pool = db_pool.clone();
            Box::pin(async move {
                tracing::info!("Scheduled EPG refresh triggered");
                run_scheduled_refresh(pool).await;
            })
        })
        .map_err(|e| SchedulerError::SchedulerError(e.to_string()))?;

        // Add job to scheduler
        let uuid = sched.add(job).await?;

        // Store job UUID
        {
            let mut job_uuid = self.job_uuid.write().await;
            *job_uuid = Some(uuid);
        }

        tracing::info!(
            "EPG refresh scheduled for {:02}:{:02} daily (job: {})",
            hour,
            minute,
            uuid
        );

        Ok(())
    }

    /// Set whether the scheduler is enabled
    ///
    /// When disabled, the current job is removed and no new jobs are scheduled.
    pub async fn set_enabled(&self, enabled: bool) -> Result<(), SchedulerError> {
        {
            let mut self_enabled = self.enabled.write().await;
            *self_enabled = enabled;
        }

        if !enabled {
            // Remove existing job
            if let Some(uuid) = *self.job_uuid.read().await {
                if let Some(ref sched) = *self.scheduler.read().await {
                    let _ = sched.remove(&uuid).await;
                }
            }
            let mut job_uuid = self.job_uuid.write().await;
            *job_uuid = None;
            tracing::info!("EPG scheduler disabled, job removed");
        }

        Ok(())
    }

    /// Check if the scheduler is enabled
    pub async fn is_enabled(&self) -> bool {
        *self.enabled.read().await
    }

    /// Check if the scheduler has a job scheduled
    pub async fn has_job(&self) -> bool {
        self.job_uuid.read().await.is_some()
    }

    /// Get a connection from the database pool
    ///
    /// Returns None if the pool is not set or connection fails
    pub async fn get_db_connection(&self) -> Option<diesel::r2d2::PooledConnection<diesel::r2d2::ConnectionManager<diesel::SqliteConnection>>> {
        let pool_guard = self.db_pool.read().await;
        pool_guard.as_ref()?.get().ok()
    }
}

impl Default for EpgScheduler {
    fn default() -> Self {
        Self::new()
    }
}

/// Build cron expression from hour and minute
///
/// Format: "sec min hour day-of-month month day-of-week"
/// For daily execution at the specified time: "0 {min} {hour} * * *"
pub fn build_cron_expression(hour: u8, minute: u8) -> String {
    format!("0 {} {} * * *", minute, hour)
}

/// Run the scheduled refresh job
///
/// This function is called by the cron job and performs the actual EPG refresh.
async fn run_scheduled_refresh(db_pool: Arc<RwLock<Option<DbPool>>>) {
    use crate::commands::epg::{preserve_channel_data, restore_channel_data};
    use crate::db::schema::{xmltv_channels, xmltv_sources};
    use crate::db::{NewProgram, NewXmltvChannel, XmltvSource};
    use crate::xmltv::{fetch_xmltv, parse_xmltv_data};
    use diesel::prelude::*;
    use std::collections::HashMap;

    const BATCH_SIZE: usize = 500;

    let pool_guard = db_pool.read().await;
    let pool = match pool_guard.as_ref() {
        Some(p) => p,
        None => {
            tracing::error!("Database pool not available for scheduled refresh");
            return;
        }
    };

    let mut conn = match pool.get() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to get database connection: {}", e);
            return;
        }
    };

    // Get all active sources
    let sources: Vec<XmltvSource> = match xmltv_sources::table
        .filter(xmltv_sources::is_active.eq(1))
        .load(&mut conn)
    {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to load XMLTV sources: {}", e);
            return;
        }
    };

    if sources.is_empty() {
        tracing::info!("No active XMLTV sources to refresh");
        update_last_scheduled_refresh(&mut conn);
        return;
    }

    tracing::info!("Starting scheduled refresh of {} active sources", sources.len());

    let mut success_count = 0;
    let mut failed_count = 0;

    for source in sources {
        let source_id = source.id.unwrap_or(0);
        let source_name = source.name.clone();

        tracing::info!("Refreshing source: {} (id: {})", source_name, source_id);

        // Fetch and parse XMLTV data
        let data = match fetch_xmltv(&source.url, &source.format).await {
            Ok(d) => d,
            Err(e) => {
                tracing::error!("Failed to fetch source {}: {}", source_name, e);
                failed_count += 1;
                continue;
            }
        };

        let (parsed_channels, parsed_programs) = match parse_xmltv_data(&data) {
            Ok(p) => p,
            Err(e) => {
                tracing::error!("Failed to parse source {}: {}", source_name, e);
                failed_count += 1;
                continue;
            }
        };

        // Wrap each source refresh in a transaction for atomicity
        // If the refresh fails mid-way, the old data remains intact
        let tx_result = conn.transaction::<_, diesel::result::Error, _>(|tx_conn| {
            // Preserve manual mappings and channel settings before deletion
            let preserved = preserve_channel_data(tx_conn, source_id)?;

            // Clear existing data for this source (CASCADE deletes mappings/settings)
            diesel::delete(
                xmltv_channels::table.filter(xmltv_channels::source_id.eq(source_id)),
            )
            .execute(tx_conn)?;

            // Insert channels
            let mut channel_id_map: HashMap<String, i32> = HashMap::new();

            for parsed_channel in &parsed_channels {
                let new_channel = NewXmltvChannel::new(
                    source_id,
                    &parsed_channel.channel_id,
                    &parsed_channel.display_name,
                    parsed_channel.icon.clone(),
                );

                match diesel::insert_into(xmltv_channels::table)
                    .values(&new_channel)
                    .get_result::<crate::db::XmltvChannel>(tx_conn)
                {
                    Ok(inserted) => {
                        if let Some(id) = inserted.id {
                            channel_id_map.insert(parsed_channel.channel_id.clone(), id);
                        }
                    }
                    Err(e) => {
                        tracing::warn!(
                            "Failed to insert channel {} for source {}: {}",
                            parsed_channel.channel_id,
                            source_name,
                            e
                        );
                        // Don't fail the whole transaction for one channel
                    }
                }
            }

            // Insert programs in batches
            use crate::db::schema::programs;
            let mut programs_to_insert: Vec<NewProgram> = Vec::with_capacity(BATCH_SIZE);

            for parsed_program in &parsed_programs {
                if let Some(&channel_db_id) = channel_id_map.get(&parsed_program.channel_id) {
                    let mut new_program = NewProgram::new(
                        channel_db_id,
                        &parsed_program.title,
                        &parsed_program.start_time,
                        &parsed_program.end_time,
                    );

                    if let Some(ref desc) = parsed_program.description {
                        new_program = new_program.with_description(desc);
                    }
                    if let Some(ref cat) = parsed_program.category {
                        new_program = new_program.with_category(cat);
                    }
                    if let Some(ref ep) = parsed_program.episode_info {
                        new_program = new_program.with_episode_info(ep);
                    }

                    programs_to_insert.push(new_program);

                    if programs_to_insert.len() >= BATCH_SIZE {
                        diesel::insert_into(programs::table)
                            .values(&programs_to_insert)
                            .execute(tx_conn)?;
                        programs_to_insert.clear();
                    }
                }
            }

            // Insert remaining programs
            if !programs_to_insert.is_empty() {
                diesel::insert_into(programs::table)
                    .values(&programs_to_insert)
                    .execute(tx_conn)?;
            }

            // Restore manual mappings and channel settings
            restore_channel_data(tx_conn, &preserved, &channel_id_map)?;

            // Update last_refresh timestamp on the source
            let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            diesel::update(xmltv_sources::table.filter(xmltv_sources::id.eq(source_id)))
                .set(xmltv_sources::last_refresh.eq(&now))
                .execute(tx_conn)?;

            Ok(())
        });

        match tx_result {
            Ok(_) => {
                success_count += 1;
                tracing::info!(
                    "Completed refresh for source: {} ({} channels, {} programs)",
                    source_name,
                    parsed_channels.len(),
                    parsed_programs.len()
                );
            }
            Err(e) => {
                tracing::error!(
                    "Transaction failed for source {}: {}. Old data preserved.",
                    source_name,
                    e
                );
                failed_count += 1;
            }
        }
    }

    // Update the last scheduled refresh timestamp
    update_last_scheduled_refresh(&mut conn);

    tracing::info!(
        "Scheduled EPG refresh completed: {} succeeded, {} failed",
        success_count,
        failed_count
    );
}

/// Update the last scheduled refresh timestamp in settings
fn update_last_scheduled_refresh(conn: &mut diesel::SqliteConnection) {
    use crate::db::schema::settings;
    use diesel::prelude::*;

    let now = chrono::Utc::now().to_rfc3339();

    let result = diesel::insert_into(settings::table)
        .values((
            settings::key.eq("epg_last_scheduled_refresh"),
            settings::value.eq(&now),
        ))
        .on_conflict(settings::key)
        .do_update()
        .set(settings::value.eq(&now))
        .execute(conn);

    if let Err(e) = result {
        tracing::error!("Failed to update epg_last_scheduled_refresh: {}", e);
    }
}

// ============================================================================
// EPG Schedule Settings Helper Functions
// ============================================================================

/// EPG Schedule configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EpgScheduleConfig {
    pub hour: u8,
    pub minute: u8,
    pub enabled: bool,
}

impl Default for EpgScheduleConfig {
    fn default() -> Self {
        Self {
            hour: 4,
            minute: 0,
            enabled: true,
        }
    }
}

/// Get EPG schedule settings from database
///
/// Returns the stored schedule or defaults if not found.
pub fn get_epg_schedule(conn: &mut diesel::SqliteConnection) -> EpgScheduleConfig {
    use crate::db::schema::settings;
    use diesel::prelude::*;

    let hour: u8 = settings::table
        .filter(settings::key.eq("epg_refresh_hour"))
        .select(settings::value)
        .first::<String>(conn)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(4);

    let minute: u8 = settings::table
        .filter(settings::key.eq("epg_refresh_minute"))
        .select(settings::value)
        .first::<String>(conn)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let enabled: bool = settings::table
        .filter(settings::key.eq("epg_refresh_enabled"))
        .select(settings::value)
        .first::<String>(conn)
        .ok()
        .map(|s| s == "true")
        .unwrap_or(true);

    EpgScheduleConfig {
        hour,
        minute,
        enabled,
    }
}

/// Set EPG schedule settings in database
///
/// Persists the schedule configuration to the settings table.
pub fn set_epg_schedule(
    conn: &mut diesel::SqliteConnection,
    config: &EpgScheduleConfig,
) -> Result<(), diesel::result::Error> {
    use crate::db::schema::settings;
    use diesel::prelude::*;

    // Update hour
    diesel::insert_into(settings::table)
        .values((
            settings::key.eq("epg_refresh_hour"),
            settings::value.eq(config.hour.to_string()),
        ))
        .on_conflict(settings::key)
        .do_update()
        .set(settings::value.eq(config.hour.to_string()))
        .execute(conn)?;

    // Update minute
    diesel::insert_into(settings::table)
        .values((
            settings::key.eq("epg_refresh_minute"),
            settings::value.eq(config.minute.to_string()),
        ))
        .on_conflict(settings::key)
        .do_update()
        .set(settings::value.eq(config.minute.to_string()))
        .execute(conn)?;

    // Update enabled
    diesel::insert_into(settings::table)
        .values((
            settings::key.eq("epg_refresh_enabled"),
            settings::value.eq(if config.enabled { "true" } else { "false" }),
        ))
        .on_conflict(settings::key)
        .do_update()
        .set(settings::value.eq(if config.enabled { "true" } else { "false" }))
        .execute(conn)?;

    Ok(())
}

/// Get the last scheduled refresh timestamp
///
/// Returns None if no scheduled refresh has occurred yet.
pub fn get_last_scheduled_refresh(
    conn: &mut diesel::SqliteConnection,
) -> Option<chrono::DateTime<chrono::Utc>> {
    use crate::db::schema::settings;
    use diesel::prelude::*;

    settings::table
        .filter(settings::key.eq("epg_last_scheduled_refresh"))
        .select(settings::value)
        .first::<String>(conn)
        .ok()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc))
}

// ============================================================================
// Missed Refresh Detection
// ============================================================================

/// Check if a scheduled refresh was missed and should be triggered
///
/// A refresh is considered missed if:
/// 1. Schedule is enabled
/// 2. The most recent scheduled time has passed
/// 3. The last scheduled refresh timestamp is before the most recent scheduled time
///    OR no scheduled refresh has ever occurred
///
/// # Arguments
/// * `schedule` - The current schedule configuration
/// * `last_scheduled_refresh` - The timestamp of the last scheduled refresh (if any)
///
/// # Returns
/// `true` if a refresh should be triggered, `false` otherwise
pub fn should_trigger_missed_refresh(
    schedule: &EpgScheduleConfig,
    last_scheduled_refresh: Option<chrono::DateTime<chrono::Utc>>,
) -> bool {
    use chrono::{Local, NaiveTime};

    // If scheduling is disabled, no need to trigger
    if !schedule.enabled {
        return false;
    }

    // Validate schedule time before proceeding
    // This should never fail due to validation in update_schedule() and set_epg_schedule()
    // but database could be manually edited or corrupted
    if schedule.hour > 23 || schedule.minute > 59 {
        tracing::error!(
            "CRITICAL: Invalid schedule time in database: hour={}, minute={}. Database may be corrupted. Scheduled refreshes will not work!",
            schedule.hour,
            schedule.minute
        );
        return false;
    }

    let now = Local::now();
    // Safe to unwrap after validation above
    let schedule_time = NaiveTime::from_hms_opt(
        schedule.hour as u32,
        schedule.minute as u32,
        0,
    )
    .expect("Schedule time validation passed but from_hms_opt still failed - this is a bug");

    // Calculate the most recent scheduled time
    let today_scheduled = now.date_naive().and_time(schedule_time);
    let most_recent_scheduled = if today_scheduled <= now.naive_local() {
        // Today's scheduled time has passed, use today
        today_scheduled
    } else {
        // Today's scheduled time hasn't arrived yet, use yesterday
        today_scheduled - chrono::Duration::days(1)
    };

    match last_scheduled_refresh {
        Some(last) => {
            // Convert to local for comparison
            let last_local = last.with_timezone(&Local).naive_local();
            // If last refresh is before most recent scheduled time, we missed one
            let missed = last_local < most_recent_scheduled;
            if missed {
                tracing::info!(
                    "Missed refresh detected: last refresh at {:?}, should have run at {:?}",
                    last_local,
                    most_recent_scheduled
                );
            }
            missed
        }
        None => {
            // Never refreshed, trigger one
            tracing::info!("No previous scheduled refresh found, triggering first refresh");
            true
        }
    }
}

/// Check for missed refresh and trigger if needed
///
/// This should be called after app startup with a delay (5-10 seconds).
/// It checks if a scheduled refresh was missed while the app wasn't running
/// and triggers an immediate refresh if so.
pub async fn check_and_trigger_missed_refresh(scheduler: &EpgScheduler) {
    let pool_guard = scheduler.db_pool.read().await;
    let pool = match pool_guard.as_ref() {
        Some(p) => p,
        None => {
            tracing::warn!("Database pool not available for missed refresh check");
            return;
        }
    };

    let mut conn = match pool.get() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to get database connection for missed refresh check: {}", e);
            return;
        }
    };

    // Get current schedule config
    let schedule = get_epg_schedule(&mut conn);

    // Check if enabled
    if !schedule.enabled {
        tracing::info!("EPG scheduler is disabled, skipping missed refresh check");
        return;
    }

    // Get last scheduled refresh timestamp
    let last_refresh = get_last_scheduled_refresh(&mut conn);

    // Check if refresh was missed
    if should_trigger_missed_refresh(&schedule, last_refresh) {
        tracing::info!("Triggering missed EPG refresh");
        // Drop the connection before running refresh (it needs its own connection)
        drop(conn);
        drop(pool_guard);

        // Trigger the refresh
        run_scheduled_refresh(scheduler.db_pool.clone()).await;
    } else {
        tracing::info!("No missed EPG refresh detected");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_cron_expression() {
        // 4:00 AM daily
        assert_eq!(build_cron_expression(4, 0), "0 0 4 * * *");

        // 2:30 AM daily
        assert_eq!(build_cron_expression(2, 30), "0 30 2 * * *");

        // 14:45 (2:45 PM) daily
        assert_eq!(build_cron_expression(14, 45), "0 45 14 * * *");

        // Midnight
        assert_eq!(build_cron_expression(0, 0), "0 0 0 * * *");

        // 23:59
        assert_eq!(build_cron_expression(23, 59), "0 59 23 * * *");
    }

    #[tokio::test]
    async fn test_scheduler_creation() {
        let scheduler = EpgScheduler::new();
        assert!(!scheduler.has_job().await);
        assert!(scheduler.is_enabled().await);
    }

    #[tokio::test]
    async fn test_scheduler_enable_disable() {
        let scheduler = EpgScheduler::new();

        // Start enabled by default
        assert!(scheduler.is_enabled().await);

        // Disable
        scheduler.set_enabled(false).await.unwrap();
        assert!(!scheduler.is_enabled().await);

        // Re-enable
        scheduler.set_enabled(true).await.unwrap();
        assert!(scheduler.is_enabled().await);
    }

    #[tokio::test]
    async fn test_update_schedule_validation() {
        let scheduler = EpgScheduler::new();
        scheduler.start().await.unwrap();

        // Invalid hour (24+)
        let result = scheduler.update_schedule(24, 0).await;
        assert!(result.is_err());

        // Invalid minute (60+)
        let result = scheduler.update_schedule(4, 60).await;
        assert!(result.is_err());

        scheduler.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_scheduler_start_stop() {
        let scheduler = EpgScheduler::new();

        // Start
        let result = scheduler.start().await;
        assert!(result.is_ok());

        // Stop
        let result = scheduler.stop().await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_missed_refresh_disabled_schedule() {
        // Disabled schedule should never trigger missed refresh
        let schedule = EpgScheduleConfig {
            hour: 4,
            minute: 0,
            enabled: false,
        };

        // Even with no last refresh, should not trigger
        assert!(!should_trigger_missed_refresh(&schedule, None));
    }

    #[test]
    fn test_missed_refresh_never_run() {
        // Enabled schedule with no last refresh should trigger
        let schedule = EpgScheduleConfig {
            hour: 4,
            minute: 0,
            enabled: true,
        };

        assert!(should_trigger_missed_refresh(&schedule, None));
    }

    #[test]
    fn test_missed_refresh_recent_refresh() {
        use chrono::{Local, Timelike, Utc};

        // Use current time to determine if we're before or after 04:00
        let now = Local::now();
        let current_hour = now.hour();

        // If it's currently before 04:00, the most recent schedule was yesterday at 04:00
        // If it's currently 04:00 or later, the most recent schedule was today at 04:00
        // We want to test "recent refresh" - so set last refresh to NOW (definitely after most recent schedule)
        let very_recent = Utc::now() - chrono::Duration::seconds(30);

        let schedule = EpgScheduleConfig {
            hour: 4,
            minute: 0,
            enabled: true,
        };

        // A refresh 30 seconds ago should NOT trigger missed refresh
        // (it's after the most recent scheduled time regardless of current hour)
        assert!(
            !should_trigger_missed_refresh(&schedule, Some(very_recent)),
            "A refresh 30 seconds ago should not trigger missed refresh (current hour: {})",
            current_hour
        );
    }

    #[test]
    fn test_missed_refresh_old_refresh() {
        use chrono::Utc;

        // Old refresh (2 days ago) should trigger
        let schedule = EpgScheduleConfig {
            hour: 4,
            minute: 0,
            enabled: true,
        };

        let two_days_ago = Utc::now() - chrono::Duration::days(2);
        assert!(should_trigger_missed_refresh(&schedule, Some(two_days_ago)));
    }

    #[test]
    fn test_epg_schedule_config_default() {
        let config = EpgScheduleConfig::default();
        assert_eq!(config.hour, 4);
        assert_eq!(config.minute, 0);
        assert!(config.enabled);
    }
}
