# ATDD Complete - Story 4-4: Stream Proxy with Quality Selection

## Summary

**Story:** 4-4: Stream Proxy with Quality Selection
**Primary Test Level:** Integration (API/Backend)
**Status:** RED Phase Complete ✅

---

## Failing Tests Created

### Integration Tests
- **File:** `tests/integration/stream-proxy.spec.ts` (658 lines)
- **Test groups:** 9 major groups
- **Individual tests:** 36 tests
- **Current status:** All failing as expected (RED phase verified)

**Test Groups:**
1. ✅ Basic Functionality (5 tests) - Route not registered, 404 errors
2. ✅ Quality Selection (5 tests) - Quality logic not implemented
3. ✅ Connection Limit (4 tests) - StreamManager not implemented
4. ✅ Streaming Performance (3 tests) - Streaming response not implemented
5. ✅ Error Handling (6 tests) - Error handling not implemented
6. ✅ XMLTV-First Architecture (3 tests) - Primary mapping lookup not implemented
7. ✅ URL Format and Parameters (4 tests) - URL construction not implemented
8. ✅ Password Decryption (3 tests) - Password decryption not implemented
9. ✅ Session Tracking (4 tests) - Session management not implemented

---

## Supporting Infrastructure

### Data Factories
- **File:** `tests/support/factories/stream-session.factory.ts` (228 lines)
- **Exports:** 17 factory functions and helpers
- **Coverage:**
  - Stream session generation with metadata
  - Xtream stream quality configurations (4K, HD, SD, no quality)
  - Stream request metadata
  - Multi-quality stream sets
  - URL generation with special character handling
  - Quality selection test scenarios

### Fixtures
- Using existing fixtures: `server.fixture.ts`, `accounts.fixture.ts`
- No new fixtures required

### Mock Requirements
- Optional: Xtream server mock for isolated unit tests
- Integration tests use real HTTP server and database

---

## Implementation Checklist

**Total Task Groups:** 11
**Estimated Total Effort:** 24.5 hours

### Task Breakdown:
1. Basic Stream Proxy Functionality - 4 hours
2. Quality Selection Logic - 2 hours
3. Xtream Stream URL Generation - 2 hours
4. Streaming Proxy Implementation - 3 hours
5. Connection Limit Enforcement - 3 hours
6. Password Decryption - 2 hours
7. Error Handling - 2 hours
8. Session Tracking and Cleanup - 2 hours
9. XMLTV-First Architecture Verification - 1 hour
10. Unit Tests for Stream Logic - 3 hours
11. Build Verification - 0.5 hours

---

## Test Execution Evidence (RED Phase Verified)

**Command:** `TAURI_DEV=true npm run test -- tests/integration/stream-proxy.spec.ts`

**Results:**
```
Running 36 tests using 4 workers

✘  30 tests failed
✓   6 tests passed (negative tests expecting 404)

Total: 36 tests, 30 failed, 6 passed
Status: ✅ RED phase verified
```

**Sample Failure Messages:**
```
Error: expect(received).toBe(expected)
Expected: 200
Received: 404
```

**Failure Analysis:**
- ✅ All failures due to missing implementation (route /stream/:id not registered)
- ✅ No test bugs detected
- ✅ Tests fail with clear, actionable error messages
- ✅ Negative tests pass correctly (expecting 404 for invalid inputs)

---

## Next Steps for DEV Team

1. **Review failing tests** to understand expected behavior
2. **Start with Task Group 1:** Basic Stream Proxy Functionality
   - Create `src-tauri/src/server/stream.rs` module
   - Implement StreamManager with DashMap
   - Add stream_proxy handler
   - Register route: `/stream/:channel_id`
3. **Run tests after each task group** to verify progress
4. **Follow RED → GREEN workflow:** One task group at a time
5. **Use implementation checklist** in `atdd-checklist-4-4.md` as roadmap
6. **When all tests pass:** Proceed to refactor phase
7. **Update story status** to 'done' in sprint-status.yaml

---

## Files Created

### Test Files
- `tests/integration/stream-proxy.spec.ts` - 36 failing integration tests

### Factory Files
- `tests/support/factories/stream-session.factory.ts` - Stream test data factories

### Documentation Files
- `_bmad-output/atdd-checklist-4-4.md` - Complete implementation checklist (11 task groups)
- `_bmad-output/atdd-summary-4-4.md` - This summary

---

## Key Technical Requirements

### Performance (NFRs)
- NFR1: Stream start time < 3 seconds
- NFR7: CPU usage < 15% during streaming

### Architecture
- XMLTV-first: Stream URLs use XMLTV channel IDs
- Primary mapping: Use is_primary = 1 from channel_mappings
- Quality priority: 4K > FHD > HD > SD

### Implementation Patterns
- Streaming response: Use Axum's Body::from_stream() (no full buffering)
- Connection limit: DashMap for thread-safe session tracking
- Error handling: eprintln! for logging, opaque errors to client
- Password: Keyring with AES-256-GCM fallback

---

## Knowledge Base References

- **test-quality.md** - Given-When-Then format, atomic tests, deterministic data
- **test-levels-framework.md** - Integration test level selection for API functionality
- **data-factories.md** - Factory patterns with faker, overrides support
- **Project patterns** - Followed existing patterns from Stories 4-1, 4-2, 4-3

---

## Manual Handoff

**Share with dev workflow (not auto-consumed):**
- `_bmad-output/atdd-checklist-4-4.md` - Implementation guide
- `tests/integration/stream-proxy.spec.ts` - Failing tests
- `tests/support/factories/stream-session.factory.ts` - Test data generators

**Implementation starts with:** Task Group 1 in atdd-checklist-4-4.md

---

**Generated by BMad TEA Agent (YOLO mode)** - 2026-01-20

All tests verified in RED phase. Ready for DEV team implementation (GREEN phase). 🔴
