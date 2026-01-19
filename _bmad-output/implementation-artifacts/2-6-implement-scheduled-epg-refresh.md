# Story 2.6: Implement Scheduled EPG Refresh

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want EPG data to refresh automatically on a schedule,
So that my program guide stays up to date without manual intervention.

## Acceptance Criteria

1. **Given** the Settings view
   **When** I configure EPG refresh schedule
   **Then** I can set the daily refresh time (default: 4:00 AM)
   **And** the schedule is stored in settings

2. **Given** a refresh schedule is configured
   **When** the scheduled time arrives
   **Then** all active XMLTV sources are automatically refreshed
   **And** the refresh runs in the background without UI interruption
   **And** `last_refresh` timestamp is updated for each source

3. **Given** the app was not running at scheduled time
   **When** the app starts
   **Then** it checks if a refresh was missed and triggers one if needed

## Tasks / Subtasks

- [x] Task 1: Create scheduler module foundation (AC: #2)
  - [x] 1.1 Create `src-tauri/src/scheduler/mod.rs` module structure
  - [x] 1.2 Add `tokio-cron-scheduler` crate to Cargo.toml
  - [x] 1.3 Create `EpgScheduler` struct to manage scheduled refresh jobs
  - [x] 1.4 Implement `start()` method to initialize scheduler
  - [x] 1.5 Implement `stop()` method for graceful shutdown
  - [x] 1.6 Implement `update_schedule(hour: u8, minute: u8)` to reschedule jobs

- [x] Task 2: Add EPG schedule settings to database (AC: #1)
  - [x] 2.1 Add migration for `epg_refresh_hour` setting (default: 4)
  - [x] 2.2 Add migration for `epg_refresh_minute` setting (default: 0)
  - [x] 2.3 Add migration for `epg_last_scheduled_refresh` setting (timestamp of last auto-refresh)
  - [x] 2.4 Create helper functions in settings module: `get_epg_schedule()`, `set_epg_schedule()`

- [x] Task 3: Implement scheduled refresh job (AC: #2)
  - [x] 3.1 Create cron expression from hour/minute settings (e.g., "0 4 * * *" for 4:00 AM daily)
  - [x] 3.2 Implement refresh job that calls `refresh_all_epg_sources()`
  - [x] 3.3 Update `epg_last_scheduled_refresh` after successful refresh
  - [x] 3.4 Log refresh start and completion to event_log
  - [x] 3.5 Handle errors gracefully (log but don't crash scheduler)

- [x] Task 4: Implement missed refresh detection on startup (AC: #3)
  - [x] 4.1 Calculate when last scheduled refresh should have occurred
  - [x] 4.2 Compare with `epg_last_scheduled_refresh` timestamp
  - [x] 4.3 If missed (last_scheduled < expected), trigger immediate refresh
  - [x] 4.4 Log missed refresh detection and trigger
  - [x] 4.5 Add 7-second delay after app startup before check (ensures scheduler fully initialized)

- [x] Task 5: Integrate scheduler with Tauri app lifecycle (AC: #2, #3)
  - [x] 5.1 Start scheduler in `lib.rs` after database initialization
  - [x] 5.2 Store scheduler handle in Tauri managed state
  - [x] 5.3 Graceful shutdown via scheduler stop method
  - [x] 5.4 Run missed refresh check after scheduler starts (with 7s delay)

- [x] Task 6: Create Tauri commands for schedule management (AC: #1)
  - [x] 6.1 Create `get_epg_schedule()` command - returns { hour, minute, enabled, lastScheduledRefresh }
  - [x] 6.2 Create `set_epg_schedule(hour, minute, enabled)` command
  - [x] 6.3 When schedule changes, update scheduler job dynamically
  - [x] 6.4 Register commands in lib.rs

- [x] Task 7: Add UI for EPG schedule configuration (AC: #1)
  - [x] 7.1 Add EPG Schedule section to Settings view
  - [x] 7.2 Create time picker component (hour dropdown 0-23, minute dropdown 0/15/30/45)
  - [x] 7.3 Add "Enable automatic EPG refresh" toggle
  - [x] 7.4 Show next scheduled refresh time (calculated from schedule)
  - [x] 7.5 Show last automatic refresh time (from `epg_last_scheduled_refresh`)
  - [x] 7.6 Save changes on form submit with success toast

- [x] Task 8: Add TypeScript types and API functions (AC: #1)
  - [x] 8.1 Add `EpgSchedule` interface: { hour: number, minute: number, enabled: boolean }
  - [x] 8.2 Add `getEpgSchedule()` function in tauri.ts
  - [x] 8.3 Add `setEpgSchedule(hour, minute, enabled)` function
  - [x] 8.4 Add helper functions: formatScheduleTime, getNextScheduledRefresh, formatRelativeTime

- [x] Task 9: Testing and verification (AC: #1, #2, #3)
  - [x] 9.1 Run `cargo check` - verify no errors
  - [x] 9.2 Run `pnpm exec tsc --noEmit` - verify TypeScript compiles
  - [x] 9.3 Add unit tests for cron expression generation (5 tests)
  - [x] 9.4 Add unit tests for missed refresh calculation (4 tests)
  - [x] 9.5 Add integration test for scheduler start/stop (1 test)
  - [x] 9.6 Verify schedule persists via settings table
  - [x] 9.7 Build verification: `pnpm tauri build --debug`

## Dev Notes

### Architecture Compliance

This story implements FR11 and FR12 from the PRD:

**From PRD:**
> FR11: User can configure scheduled EPG refresh time (daily)
> FR12: System can refresh EPG data automatically at scheduled time

[Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements - XMLTV/EPG Management]

**From Architecture - Technology Stack:**
> **Scheduling** | tokio-cron-scheduler | EPG refresh scheduling

[Source: _bmad-output/planning-artifacts/architecture.md#Technology Stack - Backend (Rust)]

**From Architecture - Project Structure:**
```
src-tauri/
└── src/
    └── scheduler/           # Background tasks
```

[Source: _bmad-output/planning-artifacts/architecture.md#Project Structure]

**From Architecture - Database Schema (settings table):**
```sql
-- Application settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

Settings are stored as key-value pairs. For EPG schedule, use:
- `epg_refresh_hour` (string "4" for 4 AM)
- `epg_refresh_minute` (string "0")
- `epg_refresh_enabled` (string "true"/"false")
- `epg_last_scheduled_refresh` (ISO 8601 timestamp)

[Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Database Schema]

### Scheduler Implementation Pattern

Use `tokio-cron-scheduler` for robust job scheduling:

```rust
use tokio_cron_scheduler::{JobScheduler, Job};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct EpgScheduler {
    scheduler: Arc<RwLock<JobScheduler>>,
    job_uuid: Arc<RwLock<Option<uuid::Uuid>>>,
}

impl EpgScheduler {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let scheduler = JobScheduler::new().await?;
        Ok(Self {
            scheduler: Arc::new(RwLock::new(scheduler)),
            job_uuid: Arc::new(RwLock::new(None)),
        })
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        let scheduler = self.scheduler.read().await;
        scheduler.start().await?;
        Ok(())
    }

    pub async fn update_schedule(&self, hour: u8, minute: u8) -> Result<(), Box<dyn std::error::Error>> {
        // Remove existing job if any
        if let Some(uuid) = *self.job_uuid.read().await {
            let scheduler = self.scheduler.write().await;
            scheduler.remove(&uuid).await?;
        }

        // Create new job with updated schedule
        // Cron format: "sec min hour day-of-month month day-of-week"
        let cron_expr = format!("0 {} {} * * *", minute, hour);
        let job = Job::new_async(cron_expr.as_str(), |_uuid, _lock| {
            Box::pin(async move {
                // Call refresh_all_epg_sources
                tracing::info!("Running scheduled EPG refresh");
                // ... implementation
            })
        })?;

        let scheduler = self.scheduler.write().await;
        let uuid = scheduler.add(job).await?;
        *self.job_uuid.write().await = Some(uuid);

        Ok(())
    }
}
```

### Cron Expression Format

`tokio-cron-scheduler` uses 6-field cron expressions:
```
┌───────────── second (0 - 59)
│ ┌───────────── minute (0 - 59)
│ │ ┌───────────── hour (0 - 23)
│ │ │ ┌───────────── day of month (1 - 31)
│ │ │ │ ┌───────────── month (1 - 12)
│ │ │ │ │ ┌───────────── day of week (0 - 6, Sunday = 0)
│ │ │ │ │ │
* * * * * *
```

For daily refresh at 4:00 AM: `"0 0 4 * * *"`
For daily refresh at 2:30 AM: `"0 30 2 * * *"`

### Missed Refresh Detection Algorithm

```rust
use chrono::{Local, NaiveTime, Duration, Timelike};

fn should_trigger_missed_refresh(
    schedule_hour: u8,
    schedule_minute: u8,
    last_scheduled_refresh: Option<DateTime<Utc>>,
) -> bool {
    let now = Local::now();
    let schedule_time = NaiveTime::from_hms_opt(schedule_hour as u32, schedule_minute as u32, 0)
        .expect("Invalid schedule time");

    // Calculate the most recent scheduled time
    let today_scheduled = now.date_naive().and_time(schedule_time);
    let most_recent_scheduled = if today_scheduled <= now.naive_local() {
        today_scheduled
    } else {
        today_scheduled - Duration::days(1)
    };

    match last_scheduled_refresh {
        Some(last) => {
            // Convert to local for comparison
            let last_local = last.with_timezone(&Local).naive_local();
            // If last refresh is before most recent scheduled time, we missed one
            last_local < most_recent_scheduled
        }
        None => {
            // Never refreshed, trigger one
            true
        }
    }
}
```

### Tauri State Management

Store scheduler in Tauri managed state for access from commands:

```rust
// main.rs
use tauri::Manager;

#[tokio::main]
async fn main() {
    let scheduler = EpgScheduler::new().await.expect("Failed to create scheduler");

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();

            // Initialize scheduler with saved schedule
            let scheduler_clone = scheduler.clone();
            tauri::async_runtime::spawn(async move {
                // Load schedule from settings
                // scheduler_clone.update_schedule(hour, minute).await
                // scheduler_clone.start().await
                // Check for missed refresh
            });

            app.manage(scheduler);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ... commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Settings Storage Pattern

Follow pattern from existing settings usage:

```rust
// Get setting
pub fn get_setting(conn: &mut SqliteConnection, key: &str) -> Option<String> {
    use crate::db::schema::settings::dsl::*;
    settings
        .filter(key.eq(key))
        .select(value)
        .first::<String>(conn)
        .ok()
}

// Set setting (upsert)
pub fn set_setting(conn: &mut SqliteConnection, setting_key: &str, setting_value: &str) -> Result<(), diesel::result::Error> {
    use crate::db::schema::settings::dsl::*;
    diesel::insert_into(settings)
        .values((key.eq(setting_key), value.eq(setting_value)))
        .on_conflict(key)
        .do_update()
        .set(value.eq(setting_value))
        .execute(conn)?;
    Ok(())
}
```

### UI Component Pattern

Time picker for Settings view:

```tsx
interface EpgScheduleSettingsProps {
  schedule: EpgSchedule;
  onSave: (schedule: EpgSchedule) => void;
}

function EpgScheduleSettings({ schedule, onSave }: EpgScheduleSettingsProps) {
  const [hour, setHour] = useState(schedule.hour);
  const [minute, setMinute] = useState(schedule.minute);
  const [enabled, setEnabled] = useState(schedule.enabled);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Enable automatic EPG refresh</Label>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <div className="flex gap-4">
          <div>
            <Label>Hour</Label>
            <Select value={hour.toString()} onValueChange={(v) => setHour(parseInt(v))}>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {i.toString().padStart(2, '0')}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div>
            <Label>Minute</Label>
            <Select value={minute.toString()} onValueChange={(v) => setMinute(parseInt(v))}>
              {[0, 15, 30, 45].map((m) => (
                <SelectItem key={m} value={m.toString()}>
                  {m.toString().padStart(2, '0')}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>
      )}

      <Button onClick={() => onSave({ hour, minute, enabled })}>
        Save Schedule
      </Button>
    </div>
  );
}
```

### Previous Story Intelligence

**From Story 2-5 Implementation:**
- `refresh_all_epg_sources()` already exists in `src-tauri/src/commands/epg.rs`
- Returns detailed error reporting if sources fail
- Uses transaction wrapping for atomicity
- Updates `last_refresh` on each source

**Key Functions to Reuse:**
- `refresh_all_epg_sources()` - Call this from scheduler job
- `get_active_xmltv_sources()` - Check if any sources exist
- Event logging pattern established

**Files from 2-5 to Build On:**
- `src-tauri/src/commands/epg.rs` - Add schedule commands here
- `src-tauri/src/db/models.rs` - Settings already exists
- `src/lib/tauri.ts` - Add schedule types/functions
- `src/views/Settings.tsx` - Add schedule UI section

### Dependencies to Add

**Cargo.toml additions:**
```toml
# Scheduling
tokio-cron-scheduler = "0.13"
uuid = { version = "1.0", features = ["v4"] }
```

Note: `uuid` may already be present via other dependencies.

### Project Structure Notes

**Files to Create:**
- `src-tauri/src/scheduler/mod.rs` - Main scheduler module
- `src-tauri/migrations/YYYY-MM-DD-HHMMSS_add_epg_schedule_settings/up.sql`
- `src-tauri/migrations/YYYY-MM-DD-HHMMSS_add_epg_schedule_settings/down.sql`
- `src/components/settings/EpgScheduleSettings.tsx` - Schedule config UI

**Files to Modify:**
- `src-tauri/Cargo.toml` - Add tokio-cron-scheduler
- `src-tauri/src/main.rs` - Initialize and start scheduler
- `src-tauri/src/lib.rs` - Add scheduler module, register commands
- `src-tauri/src/commands/epg.rs` - Add get/set schedule commands
- `src/lib/tauri.ts` - Add EpgSchedule interface and functions
- `src/views/Settings.tsx` - Add EPG schedule section

### Error Handling

The scheduler should be resilient:
- If refresh fails, log the error but don't stop the scheduler
- If database unavailable, retry on next scheduled time
- If app crashes during refresh, missed refresh detection handles it on restart

```rust
// In scheduler job
async fn run_scheduled_refresh(db: Arc<DbPool>) {
    tracing::info!("Starting scheduled EPG refresh");

    match refresh_all_sources(&db).await {
        Ok(stats) => {
            tracing::info!("Scheduled EPG refresh completed: {} sources refreshed", stats.success_count);
            // Update last scheduled refresh timestamp
            if let Err(e) = update_last_scheduled_refresh(&db).await {
                tracing::error!("Failed to update last scheduled refresh: {}", e);
            }
        }
        Err(e) => {
            tracing::error!("Scheduled EPG refresh failed: {}", e);
            // Log to event_log for UI visibility
        }
    }
}
```

### Testing Strategy

**Unit Tests:**
- Cron expression generation from hour/minute
- Missed refresh detection logic (various scenarios)
- Settings get/set functions

**Integration Tests:**
- Scheduler creates job correctly
- Schedule changes update job
- Scheduler survives error in job

**Manual Testing:**
- Set schedule to 1 minute in future, verify refresh triggers
- Close app before scheduled time, reopen after, verify missed refresh detected
- Change schedule in UI, verify next run time updates

### Security Considerations

- Schedule changes only via authenticated Tauri commands (local trust model)
- No external network access for scheduling logic
- Refresh itself uses existing SSRF protections from Story 2-5

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Technology Stack]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Database Schema]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6]
- [Source: _bmad-output/planning-artifacts/prd.md#XMLTV/EPG Management]
- [Previous Story 2-5](_bmad-output/implementation-artifacts/2-5-parse-and-store-xmltv-epg-data.md)
- [tokio-cron-scheduler documentation](https://docs.rs/tokio-cron-scheduler/)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All Rust tests passed (63 tests total, including 10 scheduler-specific tests)
- TypeScript compilation successful
- Tauri build successful in debug mode

### Completion Notes List

1. Created comprehensive scheduler module with EpgScheduler struct using tokio-cron-scheduler
2. Added database migration for EPG schedule settings (hour, minute, enabled)
3. Implemented scheduled refresh job with full EPG data refresh capability
4. Implemented missed refresh detection on app startup with 7-second delay
5. Integrated scheduler with Tauri app lifecycle (start on app init, stored in managed state)
6. Created Tauri commands: get_epg_schedule, set_epg_schedule
7. Added EPG Schedule section to Settings view with enable toggle, time selectors, and status displays
   - Note: UI restricts minute selection to [0, 15, 30, 45] for user convenience, but backend accepts any minute 0-59 via Tauri command
8. Added TypeScript types and helper functions for schedule management
9. All unit tests pass, including cron expression generation and missed refresh detection tests
10. Code review fixes applied: race condition fixed, transaction wrapping added, error logging improved

### Code Review Summary (Auto-Applied in YOLO Mode)

**Review Date:** 2026-01-19
**Review Mode:** Adversarial YOLO (auto-fix enabled)
**Issues Found:** 10 total (2 CRITICAL, 5 MEDIUM, 3 LOW)
**Issues Fixed:** 7 (all CRITICAL and MEDIUM issues)

#### Critical Issues Fixed:
1. **Race Condition in Scheduler Initialization** - Fixed by moving missed refresh check inside the scheduler initialization block to ensure schedule is fully configured before checking
   - Location: `src-tauri/src/lib.rs:93-119`
   - Impact: Prevented missed refresh detection failures on slow systems

2. **Unsafe Validation in schedule_time** - Added explicit validation before unwrap with better error messaging
   - Location: `src-tauri/src/scheduler/mod.rs:624-643`
   - Impact: Prevents silent failures from corrupt database data

#### Medium Issues Fixed:
3. **Incomplete Error Handling** - Enhanced logging with tracing::error! and detailed messages for all scheduler initialization failures
   - Location: `src-tauri/src/lib.rs:72-124`
   - Impact: Scheduler failures now visible in logs for debugging

4. **Data Loss Risk** - Wrapped each source refresh in a diesel transaction for atomicity
   - Location: `src-tauri/src/scheduler/mod.rs:327-436`
   - Impact: If refresh fails mid-way, old data is preserved instead of partial/corrupt state

5. **Minute Constraint Documentation** - Documented that UI restricts minutes to [0,15,30,45] but backend accepts 0-59
   - Location: Story completion notes
   - Impact: Clarified intentional design decision

6. **Flaky Test** - Fixed `test_missed_refresh_recent_refresh` to use 30 seconds ago instead of 1 minute to avoid boundary conditions
   - Location: `src-tauri/src/scheduler/mod.rs:826-852`
   - Impact: Test now reliable regardless of system time

7. **Documentation Accuracy** - Updated Task 4.5 description to reflect actual 7-second delay
   - Location: Story Task 4.5
   - Impact: Documentation now matches implementation

#### Low Issues (Not Fixed - Minor):
8. Redundant database connection retrieval in `set_epg_schedule` command
9. Naming inconsistency (snake_case vs camelCase) - correct per language conventions
10. Missing edge case test for schedule time = current time

**AC Validation Post-Fix:**
- AC#1: ✅ IMPLEMENTED (configure schedule in Settings)
- AC#2: ✅ IMPLEMENTED (automatic refresh at scheduled time)
- AC#3: ✅ IMPLEMENTED (missed refresh detection - race condition fixed)

All Acceptance Criteria now fully implemented and verified.

### File List

**Created:**
- `src-tauri/src/scheduler/mod.rs` - Main scheduler module with EpgScheduler, cron job management, missed refresh detection
- `src-tauri/migrations/2026-01-19-200000-0000_add_epg_schedule_settings/up.sql` - Migration to add default EPG schedule settings
- `src-tauri/migrations/2026-01-19-200000-0000_add_epg_schedule_settings/down.sql` - Rollback migration

**Modified:**
- `src-tauri/Cargo.toml` - Added tokio-cron-scheduler, uuid, tracing dependencies
- `src-tauri/src/lib.rs` - Added scheduler module, integrated scheduler with app lifecycle, registered new commands
- `src-tauri/src/commands/epg.rs` - Added get_epg_schedule and set_epg_schedule Tauri commands
- `src/lib/tauri.ts` - Added EpgSchedule interface, getEpgSchedule, setEpgSchedule, formatScheduleTime, getNextScheduledRefresh, formatRelativeTime
- `src/views/Settings.tsx` - Added EPG Schedule configuration section with full UI
- `tests/support/fixtures/epg-schedule.fixture.ts` - Fixed fixture to pass arguments correctly to Tauri command
