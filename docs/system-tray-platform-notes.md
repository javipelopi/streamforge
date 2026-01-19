# System Tray Platform-Specific Notes

## Overview

The IPTV application uses Tauri 2.0's system tray integration to provide background operation. This document describes platform-specific behavior and limitations.

## Platform Support

### macOS ✅
**Fully Supported**
- Tray icon appears in menu bar
- Left-click toggles window visibility
- Right-click shows context menu
- All features work as expected

### Windows ✅
**Fully Supported**
- Tray icon appears in system tray (notification area)
- Left-click toggles window visibility
- Right-click shows context menu
- All features work as expected

### Linux ⚠️
**Partially Supported**
- Tray icon appears in system tray
- **LIMITATION**: Left-click events are NOT supported on Linux
  - This is a known limitation of the underlying system tray implementation
  - Users must right-click and select "Show Window" to restore the app
- Right-click context menu works correctly
- "Show Window" and "Quit" menu items work as expected

## Graceful Degradation

If system tray creation fails for any reason:
1. Error is logged to stderr
2. Application continues to run normally
3. Window can still be minimized/closed using OS window controls
4. Application will not have system tray presence but remains functional

## Testing Strategy

### Automated Testing
**Not Feasible** - System tray interactions cannot be reliably automated with Playwright or similar E2E frameworks because:
- Tray icons are OS-level UI elements outside the webview
- Click events on tray icons require OS-specific automation tools
- Context menu interactions vary by platform
- No standard cross-platform API for tray testing

### Manual Testing Protocol
For each release, manually verify on target platforms:

#### Test Case 1: Tray Icon Appearance
1. Launch application
2. Verify tray icon appears in system tray/menu bar
3. Verify icon is visible and recognizable

#### Test Case 2: Window Hide on Close
1. With window visible, click window close button (X)
2. Verify window disappears
3. Verify app process still running
4. Verify tray icon still present

#### Test Case 3: Left-Click Toggle (macOS/Windows only)
1. Left-click tray icon
2. Verify window appears and receives focus
3. Left-click tray icon again
4. Verify window hides

#### Test Case 4: Right-Click Menu
1. Right-click tray icon (all platforms)
2. Verify context menu appears
3. Verify menu shows "Show Window" and "Quit" options

#### Test Case 5: Show Window Menu Action
1. With window hidden, right-click tray icon
2. Select "Show Window"
3. Verify window appears and receives focus

#### Test Case 6: Quit Menu Action
1. Right-click tray icon
2. Select "Quit"
3. Verify application exits completely
4. Verify process terminates

## Error Handling

All tray-related operations include error handling:
- Window operations (show, hide, focus) log errors but don't crash
- Tray icon creation failure doesn't prevent app launch
- Visibility state checks distinguish between hidden state and errors
- All errors are logged to stderr for debugging

## Known Issues

1. **Linux**: Left-click tray icon does nothing (limitation of tray-icon library)
2. **All Platforms**: Screen reader accessibility for tray icon is limited by OS

## Future Improvements

- [ ] Add proper structured logging instead of eprintln!
- [ ] Implement notification system for tray-related errors
- [ ] Add user preference for tray icon behavior
- [ ] Investigate Linux left-click alternatives (notification on hide, etc.)
