# ATDD Checklist - Epic 3, Story 8: Manage Orphan Xtream Channels

**Date:** 2026-01-20
**Author:** Javier
**Primary Test Level:** E2E

---

## Story Summary

As a user, I want to see Xtream channels that don't match any XMLTV channel, so that I can decide whether to add them to my Plex lineup with placeholder EPG.

**As a** user
**I want** to see Xtream channels that don't match any XMLTV channel
**So that** I can decide whether to add them to my Plex lineup with placeholder EPG

---

## Acceptance Criteria

1. **Given** the Channels view **When** I scroll to the "Unmatched Xtream Streams" section **Then** I see all Xtream channels not matched to any XMLTV channel **And** each shows: stream name, quality tier, category

2. **Given** an orphan Xtream channel **When** I click "Promote to Plex" **Then** a dialog appears with fields: Display name (pre-filled from Xtream name), Channel icon URL (pre-filled from Xtream if available) **And** I can confirm to create a synthetic channel entry

3. **Given** I promote an orphan Xtream channel **When** the promotion completes **Then** a synthetic `xmltv_channels` entry is created with `is_synthetic = true` **And** a `channel_mappings` entry links it to the Xtream stream **And** placeholder EPG is generated (2-hour looping blocks) **And** the channel moves to the main XMLTV channel list

4. **Given** a synthetic channel exists **When** EPG refresh runs **Then** placeholder EPG is regenerated for the next 7 days **And** each block shows: "{Channel Name} - Live Programming"

5. **Given** a synthetic channel **When** I view it in the Channels list **Then** it shows a "Synthetic" badge to distinguish from real XMLTV channels **And** I can edit its display name and icon

---

## Failing Tests Created (RED Phase)

### E2E Tests (17 tests)

**File:** `tests/e2e/orphan-channels.spec.ts` (720 lines)

#### AC #1: Display Unmatched Xtream Streams Section

- ✅ **Test:** should display orphan section when unmatched streams exist
  - **Status:** RED - OrphanXtreamSection component not implemented
  - **Verifies:** Orphan section is visible when orphan streams exist

- ✅ **Test:** should show orphan stream name in section
  - **Status:** RED - Orphan stream names not rendered
  - **Verifies:** Each orphan stream displays its name

- ✅ **Test:** should show quality tier badges for orphan streams
  - **Status:** RED - Quality badges not implemented
  - **Verifies:** Quality tiers (HD, FHD, SD) are displayed as badges

- ✅ **Test:** should show category name for orphan streams
  - **Status:** RED - Category display not implemented
  - **Verifies:** Category name is shown for each orphan stream

- ✅ **Test:** should hide orphan section when no unmatched streams exist
  - **Status:** RED - Section visibility logic not implemented
  - **Verifies:** Section is hidden when orphan list is empty

#### AC #2: Promote to Plex Dialog

- ✅ **Test:** should open promote dialog when clicking promote button
  - **Status:** RED - PromoteToPlexDialog component not implemented
  - **Verifies:** Dialog opens on button click

- ✅ **Test:** should pre-fill display name from Xtream name
  - **Status:** RED - Pre-fill logic not implemented
  - **Verifies:** Display name field is populated with stream name

- ✅ **Test:** should pre-fill icon URL from Xtream icon if available
  - **Status:** RED - Icon URL pre-fill not implemented
  - **Verifies:** Icon URL field is populated when stream has icon

- ✅ **Test:** should allow editing display name in dialog
  - **Status:** RED - Input editing not implemented
  - **Verifies:** User can modify pre-filled display name

- ✅ **Test:** should close dialog when clicking cancel
  - **Status:** RED - Cancel button logic not implemented
  - **Verifies:** Dialog closes without making changes

#### AC #3: Promote to Synthetic Channel

- ✅ **Test:** should create synthetic channel when confirming promotion
  - **Status:** RED - promote_orphan_to_plex command not implemented
  - **Verifies:** Backend API is called with correct data

- ✅ **Test:** should display success message after promotion
  - **Status:** RED - Success toast notification not implemented
  - **Verifies:** User receives confirmation of successful promotion

- ✅ **Test:** should remove promoted stream from orphan section
  - **Status:** RED - Query invalidation logic not implemented
  - **Verifies:** Orphan list refreshes and removes promoted stream

- ✅ **Test:** should display error message when promotion fails
  - **Status:** RED - Error handling not implemented
  - **Verifies:** User sees error message on API failure

#### AC #5: Synthetic Channel Badge and Edit

- ✅ **Test:** should display synthetic badge on promoted channels
  - **Status:** RED - Synthetic badge rendering not implemented
  - **Verifies:** Badge appears on synthetic channels in main list

- ✅ **Test:** should show edit button on synthetic channel rows
  - **Status:** RED - Edit button conditional rendering not implemented
  - **Verifies:** Edit button only appears for synthetic channels

- ✅ **Test:** should open edit dialog when clicking edit button
  - **Status:** RED - Edit dialog not implemented
  - **Verifies:** Dialog opens in edit mode with current values

- ✅ **Test:** should update synthetic channel display name when editing
  - **Status:** RED - update_synthetic_channel command not implemented
  - **Verifies:** Channel updates persist to database

---

## Data Factories Created

### Orphan Xtream Stream Factory

**File:** `tests/support/factories/orphan-stream.factory.ts`

**Exports:**
- `createOrphanStream(overrides?)` - Create single orphan stream with optional overrides
- `createOrphanStreams(count)` - Create array of orphan streams

**Example Usage:**

```typescript
import { createOrphanStream } from '../support/factories/orphan-stream.factory';

const orphan = createOrphanStream({
  name: 'HBO Max HD',
  qualities: 'HD,FHD',
  categoryName: 'Movies'
});

const orphans = createOrphanStreams(5); // Generate 5 random orphan streams
```

**Implementation:**

```typescript
// tests/support/factories/orphan-stream.factory.ts
import { faker } from '@faker-js/faker';

export type OrphanXtreamStream = {
  id: number;
  streamId: number;
  name: string;
  streamIcon: string | null;
  qualities: string;
  categoryName: string;
};

export const createOrphanStream = (overrides: Partial<OrphanXtreamStream> = {}): OrphanXtreamStream => ({
  id: faker.number.int({ min: 1, max: 10000 }),
  streamId: faker.number.int({ min: 100, max: 99999 }),
  name: faker.company.name() + ' ' + faker.helpers.arrayElement(['HD', 'FHD', 'SD', '4K']),
  streamIcon: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }) ?? null,
  qualities: faker.helpers.arrayElement(['HD', 'FHD', 'SD,HD', 'HD,FHD', '4K,FHD,HD']),
  categoryName: faker.helpers.arrayElement(['Movies', 'Sports', 'News', 'Entertainment', 'Kids', 'Documentary']),
  ...overrides,
});

export const createOrphanStreams = (count: number): OrphanXtreamStream[] =>
  Array.from({ length: count }, () => createOrphanStream());
```

### Synthetic Channel Factory

**File:** `tests/support/factories/synthetic-channel.factory.ts`

**Exports:**
- `createSyntheticChannel(overrides?)` - Create synthetic XMLTV channel
- `createSyntheticChannels(count)` - Create array of synthetic channels

**Example Usage:**

```typescript
import { createSyntheticChannel } from '../support/factories/synthetic-channel.factory';

const channel = createSyntheticChannel({
  displayName: 'HBO Max HD',
  isSynthetic: true
});
```

**Implementation:**

```typescript
// tests/support/factories/synthetic-channel.factory.ts
import { faker } from '@faker-js/faker';

export type SyntheticChannel = {
  id: number;
  channelId: string;
  displayName: string;
  icon: string | null;
  isSynthetic: boolean;
  isEnabled: boolean;
  streamMatches: any[];
};

export const createSyntheticChannel = (overrides: Partial<SyntheticChannel> = {}): SyntheticChannel => ({
  id: faker.number.int({ min: 1, max: 10000 }),
  channelId: `synthetic-${faker.string.uuid()}`,
  displayName: faker.company.name(),
  icon: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }) ?? null,
  isSynthetic: true,
  isEnabled: false,
  streamMatches: [],
  ...overrides,
});

export const createSyntheticChannels = (count: number): SyntheticChannel[] =>
  Array.from({ length: count }, () => createSyntheticChannel());
```

---

## Fixtures Created

### Network Interception Fixtures

**File:** `tests/support/fixtures/orphan-channels.fixture.ts`

**Fixtures:**
- `mockOrphanStreams` - Mock API responses for orphan streams
  - **Setup:** Registers route handlers for orphan stream API
  - **Provides:** Function to set mock orphan stream data
  - **Cleanup:** Removes route handlers after test

**Example Usage:**

```typescript
import { test } from './fixtures/orphan-channels.fixture';

test('should display orphan streams', async ({ page, mockOrphanStreams }) => {
  // Setup mock data
  await mockOrphanStreams([
    { id: 1, name: 'HBO Max HD', qualities: 'HD,FHD', categoryName: 'Movies' }
  ]);

  await page.goto('/channels');
  // Test continues...
});
```

**Implementation:**

```typescript
// tests/support/fixtures/orphan-channels.fixture.ts
import { test as base } from '@playwright/test';
import { OrphanXtreamStream } from '../factories/orphan-stream.factory';

type OrphanChannelsFixture = {
  mockOrphanStreams: (streams: OrphanXtreamStream[]) => Promise<void>;
};

export const test = base.extend<OrphanChannelsFixture>({
  mockOrphanStreams: async ({ page }, use) => {
    const mockOrphanStreams = async (streams: OrphanXtreamStream[]) => {
      await page.route('**/api/orphan-streams', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(streams),
        })
      );
    };

    await use(mockOrphanStreams);

    // Cleanup: Clear all routes
    await page.unroute('**/api/orphan-streams');
  },
});
```

---

## Mock Requirements

### Backend API Endpoints

#### Get Orphan Xtream Streams

**Endpoint:** `GET /api/orphan-streams` (Tauri command: `get_orphan_xtream_streams`)

**Success Response:**

```json
[
  {
    "id": 1,
    "streamId": 101,
    "name": "HBO Max HD",
    "streamIcon": "http://example.com/hbo.png",
    "qualities": "HD,FHD",
    "categoryName": "Movies"
  }
]
```

**Notes:** Returns array of Xtream channels not matched to any XMLTV channel

#### Promote Orphan to Plex

**Endpoint:** `POST /api/promote-orphan` (Tauri command: `promote_orphan_to_plex`)

**Request Body:**

```json
{
  "xtreamChannelId": 1,
  "displayName": "HBO Max HD",
  "iconUrl": "http://example.com/hbo.png"
}
```

**Success Response:**

```json
{
  "id": 999,
  "channelId": "synthetic-1",
  "displayName": "HBO Max HD",
  "icon": "http://example.com/hbo.png",
  "isSynthetic": true,
  "isEnabled": false,
  "streamMatches": [
    {
      "xtreamChannelId": 1,
      "streamId": 101,
      "name": "HBO Max HD",
      "qualities": "HD,FHD"
    }
  ]
}
```

**Failure Response:**

```json
{
  "error": "Database error"
}
```

**Notes:** Creates synthetic XMLTV channel, channel mapping, and placeholder EPG

#### Update Synthetic Channel

**Endpoint:** `PUT /api/update-synthetic-channel` (Tauri command: `update_synthetic_channel`)

**Request Body:**

```json
{
  "channelId": 999,
  "displayName": "HBO Max Updated",
  "iconUrl": "http://example.com/new-hbo.png"
}
```

**Success Response:**

```json
{
  "id": 999,
  "channelId": "synthetic-1",
  "displayName": "HBO Max Updated",
  "icon": "http://example.com/new-hbo.png",
  "isSynthetic": true,
  "isEnabled": false,
  "streamMatches": []
}
```

---

## Required data-testid Attributes

### OrphanXtreamSection Component

- `orphan-xtream-section` - Container for orphan streams section
- `promote-button-{id}` - Promote button for each orphan stream (e.g., `promote-button-1`)

### PromoteToPlexDialog Component

- `promote-dialog` - Dialog container
- `display-name-input` - Display name text input
- `icon-url-input` - Icon URL text input
- `cancel-button` - Cancel button
- `confirm-promote-button` - Confirm promotion button

### Edit Synthetic Channel

- `edit-synthetic-dialog` - Edit dialog container
- `edit-synthetic-button-{id}` - Edit button on channel row (e.g., `edit-synthetic-button-999`)
- `save-edit-button` - Save changes button

### Synthetic Badge

- `synthetic-badge-{id}` - Badge element on channel row (e.g., `synthetic-badge-999`)

**Implementation Example:**

```tsx
// OrphanXtreamSection.tsx
<div data-testid="orphan-xtream-section">
  <h2>Unmatched Xtream Streams</h2>
  {orphans.map((orphan) => (
    <div key={orphan.id}>
      <span>{orphan.name}</span>
      <button data-testid={`promote-button-${orphan.id}`}>
        Promote to Plex
      </button>
    </div>
  ))}
</div>

// PromoteToPlexDialog.tsx
<Dialog data-testid="promote-dialog">
  <input data-testid="display-name-input" type="text" />
  <input data-testid="icon-url-input" type="text" />
  <button data-testid="cancel-button">Cancel</button>
  <button data-testid="confirm-promote-button">Promote to Plex</button>
</Dialog>

// DraggableChannelRow.tsx (synthetic badge)
{channel.isSynthetic && (
  <span
    data-testid={`synthetic-badge-${channel.id}`}
    className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full"
  >
    Synthetic
  </span>
)}
```

---

## Implementation Checklist

### Test: Display orphan section when unmatched streams exist

**File:** `tests/e2e/orphan-channels.spec.ts:14`

**Tasks to make this test pass:**

- [ ] Create `src-tauri/src/commands/xmltv_channels.rs::get_orphan_xtream_streams` command
- [ ] Implement SQL query: SELECT from xtream_channels WHERE id NOT IN (SELECT DISTINCT xtream_channel_id FROM channel_mappings)
- [ ] Register command in `src-tauri/src/lib.rs`
- [ ] Create `OrphanXtreamSection` component in `src/components/channels/OrphanXtreamSection.tsx`
- [ ] Add TypeScript binding in `src/lib/tauri.ts`: `getOrphanXtreamStreams(): Promise<OrphanXtreamStream[]>`
- [ ] Add useQuery for orphan streams in `src/views/Channels.tsx`
- [ ] Render OrphanXtreamSection in Channels view
- [ ] Add required data-testid: `orphan-xtream-section`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:14`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Show orphan stream name in section

**File:** `tests/e2e/orphan-channels.spec.ts:47`

**Tasks to make this test pass:**

- [ ] Render orphan stream name in OrphanXtreamSection component
- [ ] Map through orphans array and display `orphan.name` for each item
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:47`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Show quality tier badges for orphan streams

**File:** `tests/e2e/orphan-channels.spec.ts:81`

**Tasks to make this test pass:**

- [ ] Parse `qualities` string (comma-separated) into array
- [ ] Render quality badge for each quality tier
- [ ] Style badges using Tailwind classes
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:81`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: Show category name for orphan streams

**File:** `tests/e2e/orphan-channels.spec.ts:112`

**Tasks to make this test pass:**

- [ ] Display `categoryName` field in orphan stream row
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:112`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Hide orphan section when no unmatched streams exist

**File:** `tests/e2e/orphan-channels.spec.ts:143`

**Tasks to make this test pass:**

- [ ] Add conditional rendering: only show section if `orphans.length > 0`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:143`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Open promote dialog when clicking promote button

**File:** `tests/e2e/orphan-channels.spec.ts:167`

**Tasks to make this test pass:**

- [ ] Create `PromoteToPlexDialog` component in `src/components/channels/PromoteToPlexDialog.tsx`
- [ ] Use Radix Dialog primitive for accessible modal
- [ ] Add state management for dialog open/close
- [ ] Add onClick handler to promote button that opens dialog
- [ ] Add required data-testid: `promote-dialog`, `promote-button-{id}`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:167`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: Pre-fill display name from Xtream name

**File:** `tests/e2e/orphan-channels.spec.ts:196`

**Tasks to make this test pass:**

- [ ] Add display name input field to PromoteToPlexDialog
- [ ] Set input defaultValue or value to `orphanStream.name`
- [ ] Add required data-testid: `display-name-input`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:196`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Pre-fill icon URL from Xtream icon if available

**File:** `tests/e2e/orphan-channels.spec.ts:226`

**Tasks to make this test pass:**

- [ ] Add icon URL input field to PromoteToPlexDialog
- [ ] Set input defaultValue to `orphanStream.streamIcon ?? ''`
- [ ] Add icon preview if URL is valid
- [ ] Add required data-testid: `icon-url-input`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:226`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: Allow editing display name in dialog

**File:** `tests/e2e/orphan-channels.spec.ts:256`

**Tasks to make this test pass:**

- [ ] Ensure display name input is not disabled/readonly
- [ ] Add onChange handler to capture user input
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:256`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Close dialog when clicking cancel

**File:** `tests/e2e/orphan-channels.spec.ts:288`

**Tasks to make this test pass:**

- [ ] Add Cancel button to dialog
- [ ] Add onClick handler that sets dialog open state to false
- [ ] Add required data-testid: `cancel-button`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:288`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Create synthetic channel when confirming promotion

**File:** `tests/e2e/orphan-channels.spec.ts:318`

**Tasks to make this test pass:**

- [ ] Create database migration: `2026XXXXXX_add_synthetic_flag/up.sql`
- [ ] Add column: `ALTER TABLE xmltv_channels ADD COLUMN is_synthetic INTEGER DEFAULT 0`
- [ ] Run migration: `diesel migration run`
- [ ] Update `src-tauri/src/db/schema.rs` (regenerate with diesel)
- [ ] Update `src-tauri/src/db/models.rs`: add `is_synthetic: Option<i32>` to XmltvChannel
- [ ] Create `promote_orphan_to_plex` command in `src-tauri/src/commands/xmltv_channels.rs`
- [ ] Command logic: Create synthetic xmltv_channels entry with is_synthetic=1
- [ ] Command logic: Create channel_mappings entry linking synthetic to Xtream stream
- [ ] Command logic: Create xmltv_channel_settings entry with is_enabled=0
- [ ] Command logic: Call generate_placeholder_epg function
- [ ] Register command in `src-tauri/src/lib.rs`
- [ ] Add TypeScript binding: `promoteOrphanToPlex(xtreamChannelId, displayName, iconUrl): Promise<XmltvChannelWithMappings>`
- [ ] Add useMutation in Channels.tsx for promote operation
- [ ] Wire up dialog confirm button to mutation
- [ ] Add required data-testid: `confirm-promote-button`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:318`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 4 hours

---

### Test: Display success message after promotion

**File:** `tests/e2e/orphan-channels.spec.ts:366`

**Tasks to make this test pass:**

- [ ] Add success toast notification on mutation success
- [ ] Use existing toast system from Channels.tsx
- [ ] Add ARIA live region for accessibility
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:366`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Remove promoted stream from orphan section

**File:** `tests/e2e/orphan-channels.spec.ts:403`

**Tasks to make this test pass:**

- [ ] Add query invalidation on promotion success: `queryClient.invalidateQueries(['orphan-streams'])`
- [ ] Add query invalidation for XMLTV channels: `queryClient.invalidateQueries(['xmltv-channels'])`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:403`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Display error message when promotion fails

**File:** `tests/e2e/orphan-channels.spec.ts:460`

**Tasks to make this test pass:**

- [ ] Add error toast notification on mutation error
- [ ] Display error message from API response
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:460`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Display synthetic badge on promoted channels

**File:** `tests/e2e/orphan-channels.spec.ts:507`

**Tasks to make this test pass:**

- [ ] Update `get_xmltv_channels_with_mappings` to read `is_synthetic` from database
- [ ] Remove TODO comment at line 187-188 of `xmltv_channels.rs`
- [ ] Handle NULL as false for backwards compatibility
- [ ] Modify `DraggableChannelRow.tsx` to check `channel.isSynthetic`
- [ ] Render badge: `<span data-testid={synthetic-badge-${channel.id}}>Synthetic</span>`
- [ ] Style badge with Tailwind: `px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full`
- [ ] Add required data-testid: `synthetic-badge-{id}`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:507`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: Show edit button on synthetic channel rows

**File:** `tests/e2e/orphan-channels.spec.ts:538`

**Tasks to make this test pass:**

- [ ] Add conditional edit button in DraggableChannelRow: `{channel.isSynthetic && <button>Edit</button>}`
- [ ] Add required data-testid: `edit-synthetic-button-{id}`
- [ ] Add aria-label for accessibility: `Edit synthetic channel {channel.displayName}`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:538`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Open edit dialog when clicking edit button

**File:** `tests/e2e/orphan-channels.spec.ts:569`

**Tasks to make this test pass:**

- [ ] Reuse PromoteToPlexDialog component with edit mode prop
- [ ] Add state management for edit dialog open/close
- [ ] Add onClick handler to edit button that opens dialog
- [ ] Add required data-testid: `edit-synthetic-dialog`
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:569`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: Update synthetic channel display name when editing

**File:** `tests/e2e/orphan-channels.spec.ts:600`

**Tasks to make this test pass:**

- [ ] Create `update_synthetic_channel` command in `src-tauri/src/commands/xmltv_channels.rs`
- [ ] Command logic: Validate channel exists and is_synthetic=true
- [ ] Command logic: Update display_name and icon in xmltv_channels table
- [ ] Command logic: Update placeholder EPG program titles with new channel name
- [ ] Register command in `src-tauri/src/lib.rs`
- [ ] Add TypeScript binding: `updateSyntheticChannel(channelId, displayName, iconUrl): Promise<XmltvChannelWithMappings>`
- [ ] Add useMutation for update operation
- [ ] Wire up dialog save button to mutation
- [ ] Add required data-testid: `save-edit-button`
- [ ] Invalidate queries on success
- [ ] Run test: `npx playwright test tests/e2e/orphan-channels.spec.ts:600`
- [ ] ✅ Test passes (green phase)

**Estimated Effort:** 2 hours

---

## Running Tests

```bash
# Run all failing tests for this story
npx playwright test tests/e2e/orphan-channels.spec.ts

# Run specific test file
npx playwright test tests/e2e/orphan-channels.spec.ts

# Run tests in headed mode (see browser)
npx playwright test tests/e2e/orphan-channels.spec.ts --headed

# Debug specific test
npx playwright test tests/e2e/orphan-channels.spec.ts --debug

# Run tests with coverage
TAURI_DEV=true npx playwright test tests/e2e/orphan-channels.spec.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

**TEA Agent Responsibilities:**

- ✅ All tests written and failing
- ✅ Fixtures and factories created with auto-cleanup
- ✅ Mock requirements documented
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

**Verification:**

- All tests run and fail as expected
- Failure messages are clear and actionable
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with highest priority)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

**Progress Tracking:**

- Check off tasks as you complete them
- Share progress in daily standup
- Mark story as IN PROGRESS in sprint-status.yaml

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Optimize performance** (if needed)
5. **Ensure tests still pass** after each refactor
6. **Update documentation** (if API contracts change)

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All tests pass
- Code quality meets team standards
- No duplications or code smells
- Ready for code review and story approval

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `npx playwright test tests/e2e/orphan-channels.spec.ts`
4. **Begin implementation** using implementation checklist as guide
5. **Work one test at a time** (red → green for each)
6. **Share progress** in daily standup
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation, explicit waits)
- **data-factories.md** - Factory patterns using `@faker-js/faker` for random test data generation with overrides support
- **network-first.md** - Route interception patterns (intercept BEFORE navigation to prevent race conditions)
- **test-levels-framework.md** - Test level selection framework (E2E for user-facing acceptance criteria)

See `_bmad/bmm/testarch/tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx playwright test tests/e2e/orphan-channels.spec.ts`

**Expected Results:**

All 17 tests should fail with clear error messages indicating missing implementation:

```
Running 17 tests using 1 worker

  ✗ should display orphan section when unmatched streams exist (500ms)
    Error: locator.toBeVisible: Target closed

  ✗ should show orphan stream name in section (500ms)
    Error: locator.toBeVisible: Target closed

  ✗ should show quality tier badges for orphan streams (500ms)
    Error: locator.toBeVisible: Target closed

  ✗ should show category name for orphan streams (500ms)
    Error: locator.toBeVisible: Target closed

  ✗ should hide orphan section when no unmatched streams exist (500ms)
    Error: expect(locator).not.toBeVisible()

  ✗ should open promote dialog when clicking promote button (500ms)
    Error: page.click: Target element not found

  ✗ should pre-fill display name from Xtream name (500ms)
    Error: page.click: Target element not found

  ✗ should pre-fill icon URL from Xtream icon if available (500ms)
    Error: page.click: Target element not found

  ✗ should allow editing display name in dialog (500ms)
    Error: page.click: Target element not found

  ✗ should close dialog when clicking cancel (500ms)
    Error: page.click: Target element not found

  ✗ should create synthetic channel when confirming promotion (500ms)
    Error: page.click: Target element not found

  ✗ should display success message after promotion (500ms)
    Error: page.click: Target element not found

  ✗ should remove promoted stream from orphan section (500ms)
    Error: page.click: Target element not found

  ✗ should display error message when promotion fails (500ms)
    Error: page.click: Target element not found

  ✗ should display synthetic badge on promoted channels (500ms)
    Error: locator.toBeVisible: Target closed

  ✗ should show edit button on synthetic channel rows (500ms)
    Error: locator.toBeVisible: Target closed

  ✗ should open edit dialog when clicking edit button (500ms)
    Error: page.click: Target element not found

  ✗ should update synthetic channel display name when editing (500ms)
    Error: page.click: Target element not found

  17 failed
    Orphan Xtream Channels Management › AC #1: Display Unmatched Xtream Streams Section › should display orphan section when unmatched streams exist
    [... all tests listed ...]
```

**Summary:**

- Total tests: 17
- Passing: 0 (expected)
- Failing: 17 (expected)
- Status: ✅ RED phase verified

**Expected Failure Messages:**

All failures are due to missing implementation:
- Components not created (OrphanXtreamSection, PromoteToPlexDialog)
- Commands not implemented (get_orphan_xtream_streams, promote_orphan_to_plex, update_synthetic_channel)
- Data-testid attributes not added
- Database migration not run (is_synthetic column missing)

---

## Notes

### Architecture Compliance

**XMLTV-First Design:** XMLTV channels are the PRIMARY channel list for Plex. "Orphan" Xtream streams are those not matched to any XMLTV channel. When promoted, they become "synthetic" XMLTV channels with placeholder EPG data.

### Database Migration Required

The `is_synthetic` column does NOT exist in the current schema. Must create and run migration before implementing promotion feature.

### Synthetic Source ID Strategy

**Recommendation:** Create a special "Synthetic" source record in `xmltv_sources` table and use its ID for all synthetic channels. This is more database-correct than using `-1`.

### Placeholder EPG Generation

Generate 7 days of 2-hour program blocks with title format: "{Channel Name} - Live Programming". Total of 84 programs per synthetic channel.

### Accessibility Requirements

- Promote button: `aria-label="Promote {stream name} to Plex lineup"`
- Dialog: Proper focus management via Radix Dialog
- Badge: Screen reader text for "Synthetic" status
- Edit button: `aria-label="Edit synthetic channel {channel name}"`
- ARIA live region for promotion success announcement

### Error Handling

- Check for duplicate promotions (stream already has mapping)
- Wrap promotion in database transaction
- Log EPG generation errors but don't fail promotion
- Allow empty/invalid icon URLs with fallback

### Performance Considerations

- Orphan query uses NOT IN subquery (consider LEFT JOIN for large datasets)
- Batch insert all 84 EPG programs in single transaction
- Collapse orphan section by default if > 20 orphans
- Consider virtualization for very large orphan lists

---

## Contact

**Questions or Issues?**

- Ask in team standup
- Tag @TEA agent in Slack/Discord
- Refer to `_bmad/bmm/testarch/README.md` for workflow documentation
- Consult `_bmad/bmm/testarch/knowledge` for testing best practices

---

**Generated by BMad TEA Agent** - 2026-01-20
