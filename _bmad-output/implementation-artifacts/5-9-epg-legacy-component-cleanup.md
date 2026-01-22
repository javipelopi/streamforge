# Story 5.9: EPG Legacy Component Cleanup

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to remove superseded EPG components and adapt reusable ones,
So that the codebase is clean and doesn't contain dead code.

## Acceptance Criteria

1. **Given** the new TV-style EPG is fully implemented (Stories 5.4-5.8 complete) **When** cleanup is performed **Then** the following components are DELETED:
   - `src/components/epg/EpgGrid.tsx`
   - `src/components/epg/EpgCell.tsx`
   - `src/components/epg/TimeNavigationBar.tsx`
   - Any associated test files for above components
   - Any unused styles specific to grid layout

2. **Given** the cleanup is complete **When** reviewing adapted components **Then** these components have been refactored for new design:
   - `ProgramDetailsPanel.tsx` → adapted to inline right panel
   - `EpgSearchInput.tsx` → moved to top bar context
   - `EpgSearchResults.tsx` → updated dropdown styling for dark theme

3. **Given** all cleanup is complete **When** running the build **Then** no unused imports or dead code warnings exist **And** no references to deleted components remain **And** all tests pass

## Tasks / Subtasks

- [ ] Task 1: Identify and audit legacy EPG components (AC: #1)
  - [ ] 1.1 Audit `src/components/epg/EpgGrid.tsx` for any dependencies or imports
  - [ ] 1.2 Audit `src/components/epg/EpgCell.tsx` for any dependencies or imports
  - [ ] 1.3 Audit `src/components/epg/TimeNavigationBar.tsx` for any dependencies or imports
  - [ ] 1.4 Run `grep -r "EpgGrid\|EpgCell\|TimeNavigationBar" src/` to find all references
  - [ ] 1.5 Document all files that import these components

- [ ] Task 2: Remove legacy test files (AC: #1)
  - [ ] 2.1 Delete `tests/e2e/epg-grid.spec.ts` if it only tests superseded grid component
  - [ ] 2.2 Review `tests/e2e/epg-search.spec.ts` - keep if it tests current search, delete if grid-specific
  - [ ] 2.3 Verify no other test files reference deleted components
  - [ ] 2.4 Run test suite to ensure no import errors from deleted files

- [ ] Task 3: Delete legacy component files (AC: #1)
  - [ ] 3.1 Delete `src/components/epg/EpgGrid.tsx`
  - [ ] 3.2 Delete `src/components/epg/EpgCell.tsx`
  - [ ] 3.3 Delete `src/components/epg/TimeNavigationBar.tsx`
  - [ ] 3.4 Delete `src/components/epg/tv-style/EpgChannelListPlaceholder.tsx` (placeholder replaced by real component)
  - [ ] 3.5 Delete `src/components/epg/tv-style/EpgSchedulePanelPlaceholder.tsx` (placeholder replaced by real component)
  - [ ] 3.6 Delete `src/components/epg/tv-style/EpgDetailsPanelPlaceholder.tsx` (placeholder replaced by real component)

- [ ] Task 4: Update component index exports (AC: #1, #3)
  - [ ] 4.1 Remove `EpgGrid` export from `src/components/epg/index.ts`
  - [ ] 4.2 Remove `EpgCell` export from `src/components/epg/index.ts`
  - [ ] 4.3 Remove `TimeNavigationBar` export from `src/components/epg/index.ts`
  - [ ] 4.4 Remove `EpgChannelListPlaceholder` export from `src/components/epg/tv-style/index.ts`
  - [ ] 4.5 Keep `EpgSearchInput` and `EpgSearchResults` exports in `src/components/epg/index.ts` (may still be used)

- [ ] Task 5: Verify/Update ProgramDetailsPanel adaptation (AC: #2)
  - [ ] 5.1 Check if `src/components/epg/ProgramDetailsPanel.tsx` is still used anywhere
  - [ ] 5.2 If unused, delete the old `ProgramDetailsPanel.tsx` (replaced by `EpgProgramDetails.tsx` in tv-style)
  - [ ] 5.3 If used elsewhere, document what needs adaptation
  - [ ] 5.4 Remove `ProgramDetailsPanel` export from index if deleted

- [ ] Task 6: Verify EpgSearchInput and EpgSearchResults (AC: #2)
  - [ ] 6.1 Confirm `src/components/epg/EpgSearchInput.tsx` is superseded by `tv-style/EpgSearchInput.tsx`
  - [ ] 6.2 Confirm `src/components/epg/EpgSearchResults.tsx` is superseded by `tv-style/EpgSearchResults.tsx`
  - [ ] 6.3 If old versions are unused, delete them
  - [ ] 6.4 Update exports in `src/components/epg/index.ts` to only export tv-style versions or remove entirely

- [ ] Task 7: Clean up any remaining imports (AC: #3)
  - [ ] 7.1 Search codebase for imports from deleted files
  - [ ] 7.2 Update any files that still import deleted components
  - [ ] 7.3 Run TypeScript compiler to catch type errors (`npx tsc --noEmit`)

- [ ] Task 8: Verify build and tests pass (AC: #3)
  - [ ] 8.1 Run `npm run build` or `pnpm build` to verify no compilation errors
  - [ ] 8.2 Run `npm run lint` or `pnpm lint` to check for dead code warnings
  - [ ] 8.3 Run `npm run test` or `pnpm test` to verify all tests pass
  - [ ] 8.4 Run `npx playwright test` to verify E2E tests pass

- [ ] Task 9: Final verification (AC: #1, #2, #3)
  - [ ] 9.1 Run `grep -r "EpgGrid\|EpgCell\|TimeNavigationBar\|ProgramDetailsPanel" src/` to confirm no references
  - [ ] 9.2 Verify `src/views/EpgTv.tsx` only uses tv-style components
  - [ ] 9.3 Document any remaining legacy components that were kept and why

## Dev Notes

### Architecture Compliance

This story performs cleanup after the TV-style EPG redesign (Stories 5.4-5.8). Per the UX spec (`ux-epg-tv-guide.md`), the following components are marked for retirement:

**Components to DELETE (per UX spec "Migration Notes"):**
- `EpgGrid.tsx` - Horizontal timeline grid (replaced by vertical channel list)
- `EpgCell.tsx` - Grid cells (replaced by EpgChannelRow and ScheduleRow)
- `TimeNavigationBar.tsx` - Time navigation (replaced by DayNavigationBar in top bar)

**Components to VERIFY for deletion:**
- `ProgramDetailsPanel.tsx` - Old slide-in overlay (replaced by `EpgProgramDetails.tsx`)
- Old `EpgSearchInput.tsx` and `EpgSearchResults.tsx` (replaced by tv-style versions)
- Placeholder components (replaced by real implementations)

**Components to KEEP:**
- `EpgSourcesList.tsx` - Used for XMLTV source management (Account settings)
- `EpgSourceDialog.tsx` - Dialog for adding/editing EPG sources (Account settings)

### Current Component Structure

**Legacy Components (to be deleted):**
```
src/components/epg/
├── EpgGrid.tsx              # DELETE - superseded by tv-style
├── EpgCell.tsx              # DELETE - superseded by tv-style
├── TimeNavigationBar.tsx    # DELETE - superseded by DayNavigationBar
├── ProgramDetailsPanel.tsx  # VERIFY - may be superseded by EpgProgramDetails
├── EpgSearchInput.tsx       # VERIFY - may be superseded by tv-style version
├── EpgSearchResults.tsx     # VERIFY - may be superseded by tv-style version
├── EpgSourcesList.tsx       # KEEP - used in Accounts view
├── EpgSourceDialog.tsx      # KEEP - used in Accounts view
└── index.ts                 # UPDATE exports
```

**TV-Style Components (to keep):**
```
src/components/epg/tv-style/
├── EpgBackground.tsx              # KEEP
├── EpgMainContent.tsx             # KEEP
├── EpgChannelList.tsx             # KEEP (Story 5.5)
├── EpgChannelRow.tsx              # KEEP
├── EpgProgressBar.tsx             # KEEP
├── EpgSchedulePanel.tsx           # KEEP (Story 5.6)
├── ScheduleHeader.tsx             # KEEP
├── ScheduleRow.tsx                # KEEP
├── EpgTopBar.tsx                  # KEEP (Story 5.7)
├── EpgSearchInput.tsx             # KEEP (Story 5.7)
├── EpgSearchResults.tsx           # KEEP (Story 5.7)
├── DayNavigationBar.tsx           # KEEP (Story 5.7)
├── DayChip.tsx                    # KEEP
├── DatePickerButton.tsx           # KEEP
├── EpgProgramDetails.tsx          # KEEP (Story 5.8)
├── EpgChannelListPlaceholder.tsx  # DELETE - replaced by EpgChannelList
├── EpgSchedulePanelPlaceholder.tsx # DELETE - replaced by EpgSchedulePanel
├── EpgDetailsPanelPlaceholder.tsx  # DELETE - replaced by EpgProgramDetails
└── index.ts                       # UPDATE exports
```

### Test Files to Review

```
tests/e2e/
├── epg-grid.spec.ts               # DELETE if only tests legacy grid
├── epg-search.spec.ts             # REVIEW - may test current search
├── epg-tv-layout.spec.ts          # KEEP (Story 5.4)
├── epg-channel-list-panel.spec.ts # KEEP (Story 5.5)
├── epg-schedule-panel.spec.ts     # KEEP (Story 5.6)
├── epg-top-bar.spec.ts            # KEEP (Story 5.7)
├── epg-program-details-panel.spec.ts # KEEP (Story 5.8)
├── epg-sources.spec.ts            # KEEP - tests EPG source management
└── epg-schedule.spec.ts           # KEEP - may test backend EPG
```

### Current Index Exports

**`src/components/epg/index.ts` (Current):**
```typescript
export { EpgSourcesList } from './EpgSourcesList';
export { EpgSourceDialog } from './EpgSourceDialog';
export { EpgGrid } from './EpgGrid';                    // DELETE
export { EpgCell } from './EpgCell';                    // DELETE
export { TimeNavigationBar } from './TimeNavigationBar'; // DELETE
export { EpgSearchInput } from './EpgSearchInput';      // VERIFY
export { EpgSearchResults } from './EpgSearchResults';  // VERIFY
export { ProgramDetailsPanel, createProgramDetailsData } from './ProgramDetailsPanel'; // VERIFY
export type { ProgramDetailsData, ProgramDetailsPanelProps } from './ProgramDetailsPanel';

// Story 5.4: TV-style EPG components
export * from './tv-style';
```

**Target `src/components/epg/index.ts` (After Cleanup):**
```typescript
export { EpgSourcesList } from './EpgSourcesList';
export { EpgSourceDialog } from './EpgSourceDialog';

// Story 5.4+: TV-style EPG components
export * from './tv-style';
```

### Commands to Run Before Cleanup

```bash
# Find all references to components being deleted
grep -r "EpgGrid\|EpgCell\|TimeNavigationBar" src/ --include="*.tsx" --include="*.ts"
grep -r "ProgramDetailsPanel" src/ --include="*.tsx" --include="*.ts"
grep -r "EpgChannelListPlaceholder\|EpgSchedulePanelPlaceholder\|EpgDetailsPanelPlaceholder" src/

# Check test file references
grep -r "EpgGrid\|EpgCell\|TimeNavigationBar" tests/ --include="*.ts"
```

### Verification Commands After Cleanup

```bash
# TypeScript compilation check
npx tsc --noEmit

# Build verification
pnpm build

# Lint check (should catch dead exports)
pnpm lint

# Run all tests
pnpm test

# Run E2E tests specifically for EPG
npx playwright test epg
```

### Previous Story Learnings (Story 5.8)

From Story 5.8 code review:
1. Always verify exports are updated in index files after component changes
2. Check for TypeScript compilation success before declaring done
3. Run full test suite to catch import errors from deleted files
4. Use grep to find all references before deleting files

### Git Context (Recent Commits)

From recent commits on `feature/epic-5`:
- `21a4401` - Code review fixes for Story 5.8 EPG program details panel
- `007093d` - Implement Story 5.8 EPG program details panel
- `b5d9a7e` - Code review fixes for Story 5.7 EPG top bar with search and day navigation
- All TV-style components are now implemented in `src/components/epg/tv-style/`

### What NOT to Do in This Story

- Do NOT delete `EpgSourcesList.tsx` or `EpgSourceDialog.tsx` - these are used for EPG source management in Accounts view
- Do NOT modify functional TV-style components (Stories 5.4-5.8)
- Do NOT change any component logic, only delete/cleanup
- Do NOT delete test files for non-superseded functionality
- Do NOT add new features or refactor existing functionality

### Risk Mitigation

1. **Before deleting any file**: Run grep to confirm it's not imported elsewhere
2. **After each deletion**: Run TypeScript compilation to catch errors immediately
3. **Incremental approach**: Delete one component at a time, verify build after each
4. **Test file review**: Read test file content before deleting to ensure tests are truly obsolete

### Edge Cases to Handle

1. **Shared utilities**: If EpgGrid/EpgCell have utility functions used elsewhere, extract them first
2. **Type exports**: If deleted components export types used elsewhere, preserve types in a separate file
3. **CSS/styles**: Check for component-specific CSS that should also be deleted
4. **Re-exports**: The main index re-exports tv-style, so verify no circular dependencies

### References

- [Source: _bmad-output/planning-artifacts/ux-epg-tv-guide.md#Migration-Notes]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.9-EPG-Legacy-Component-Cleanup]
- [Source: _bmad-output/implementation-artifacts/5-8-epg-program-details-panel.md - Previous story patterns]
- [Source: src/components/epg/index.ts - Current exports to update]
- [Source: src/components/epg/tv-style/index.ts - TV-style exports]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
