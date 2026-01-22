# UX Design: TV-Style EPG Guide

**Component**: EPG View (Electronic Program Guide)
**Design Pattern**: TV-centric lean-back interface
**Status**: Design specification for developer implementation
**Created**: 2026-01-22

---

## Overview

This document describes a TV-style EPG interface that replaces the traditional horizontal timeline grid with a more television-friendly vertical channel list and schedule view. The design optimizes for the "lean-back" experience common in smart TV interfaces.

### Key Differences from Current Implementation

| Aspect | Current (Grid) | New (TV-Style) |
|--------|---------------|----------------|
| Layout | Horizontal timeline with all channels | Vertical channel list + selected channel schedule |
| Navigation | Scroll horizontally through time | Scroll vertically through channels, view schedule for selected |
| Focus | Time-centric (what's on at X time?) | Channel-centric (what's on this channel?) |
| Visual style | Light background, compact cells | Dark overlay, cinematic background |
| Information density | Shows many channels × time slots | Shows one channel's full schedule in detail |

---

## Layout Structure

The interface consists of **three content panels over a background layer**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [🔍 Search...]                              [◀ Prev] Today [Next ▶] [📅]   │  ← Top Bar
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────────┐│
│  │                 │  │                 │  │                              ││
│  │  CHANNEL LIST   │  │  SCHEDULE LIST  │  │  PROGRAM DETAILS             ││
│  │  (Left Panel)   │  │  (Center Panel) │  │  (Right Panel)               ││
│  │                 │  │                 │  │                              ││
│  │  ~30% width     │  │  ~30% width     │  │  ~40% width                  ││
│  │                 │  │                 │  │                              ││
│  └─────────────────┘  └─────────────────┘  └──────────────────────────────┘│
│                                                                             │
│                           [ GRADIENT BACKGROUND ]                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Panel States

The layout adapts based on user selection:

**State 1: No Program Selected** (default)
- Left panel: Channel list (active)
- Center panel: Schedule for selected channel
- Right panel: Shows only gradient background (details panel hidden or minimized)

**State 2: Program Selected**
- Left panel: Channel list
- Center panel: Schedule (selected program highlighted)
- Right panel: Full program details displayed over gradient

### Top Bar - Search & Day Navigation

**Position**: Fixed at top, full width, above all panels
**Height**: ~56px
**Background**: Semi-transparent dark `rgba(0, 0, 0, 0.7)` with subtle bottom border

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [🔍] Search programs...          │    [◀] [Today] [Tonight] [▶]    [📅]   │
│       (expandable input)          │         Day Navigation                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Left Side - Search**:

| Element | Specification |
|---------|---------------|
| Search Icon | Magnifying glass, 20px, clickable to expand input |
| Search Input | Expands on focus, ~300px max width, placeholder: "Search programs..." |
| Clear Button | X icon appears when input has text |
| Results Dropdown | Appears below input when searching, max 8 results, semi-transparent dark background |

**Search Behavior**:
- Debounced search (300ms delay)
- Results show: Program title, channel name, date/time
- Clicking a result: navigates to that day, selects the channel, highlights the program, shows details

**Right Side - Day Navigation**:

| Element | Specification |
|---------|---------------|
| Prev Arrow (◀) | Navigates to previous day |
| Day Chips | Horizontally scrollable: "Today", "Tonight", "Tomorrow", then day names (Wed, Thu, Fri...) |
| Next Arrow (▶) | Navigates to next day |
| Calendar Icon (📅) | Opens date picker overlay for jumping to specific date |

**Day Chip States**:
- Default: Semi-transparent background, white text
- Selected/Active: Solid purple background (#6366f1), white text
- Hover: Lighter purple background

**Navigation Behavior**:
- "Today" loads schedule starting from current time
- "Tonight" loads primetime (6 PM onwards)
- "Tomorrow" and day names load full day schedule (starting 6 AM or midnight)
- The schedule panel date header updates to reflect selected day

---

### Background Layer (Full-Screen)

- **Current implementation**: Use a gradient background (purple to dark blue, diagonal)
- **Future enhancement**: Can display artwork from selected program or live video preview
- **CSS**: Fixed position, covers entire viewport, `z-index: 0`

**Gradient specification** (placeholder):
```css
background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
```

---

### Left Panel - Channel List with Now Playing

**Dimensions**: ~40% viewport width, full height with vertical padding

**Visual Style**:
- Semi-transparent dark background: `rgba(0, 0, 0, 0.6)`
- Rounded corners on panel edges (optional, subtle)
- Vertical scroll when channels exceed viewport

**Each Channel Row Contains**:

```
┌─────────────────────────────────────────────────┐
│  ┌────────┐                                     │
│  │  LOGO  │   Channel Name  HH:MM - HH:MM AM    │
│  │  80×60 │   Program Title                     │
│  │        │   ══════════════════────── (progress)│
│  └────────┘                                     │
└─────────────────────────────────────────────────┘
```

| Element | Specification |
|---------|---------------|
| Channel Logo | 80×60px, object-fit: contain, rounded corners (4px) |
| Channel Name | Bold, white, 14-16px |
| Time Range | Regular weight, lighter gray (#a0a0a0), same line as channel name |
| Program Title | Regular, white, 14px, single line with ellipsis overflow |
| Progress Bar | Height: 3px, background: rgba(255,255,255,0.2), fill: gradient (purple #6366f1 to cyan #22d3ee), rounded ends |

**Selected/Focused State**:
- Entire row wrapped in a pill-shaped highlight
- Border: 2px solid rgba(255, 255, 255, 0.3)
- Background: rgba(99, 102, 241, 0.2) (subtle purple tint)
- Border-radius: 12px

**Row Spacing**:
- Gap between rows: 8px
- Padding inside row: 12px vertical, 16px horizontal

### Layer 3: Center Panel - Schedule List

**Dimensions**: ~35% viewport width, positioned after left panel

**Visual Style**:
- Semi-transparent dark background: `rgba(0, 0, 0, 0.5)`
- Slightly less opaque than left panel to create depth

**Header**:
```
┌─────────────────────────────────┐
│         TUE 11 Apr              │  (Day of week + date)
├─────────────────────────────────┤
│  6:00 AM    Bluey               │
│  6:30 AM    Last Hero           │
│  7:00 AM    Kingdom of the...   │
│  ...                            │
└─────────────────────────────────┘
```

| Element | Specification |
|---------|---------------|
| Date Header | Bold, white, 16px, center-aligned, padding 16px vertical |
| Time Column | Fixed width ~80px, lighter gray (#a0a0a0), 14px |
| Program Title | White, 14px, flex-grow, ellipsis on overflow |
| Row Height | ~40px minimum, allow multi-line for long titles |
| Row Hover | Subtle highlight rgba(255,255,255,0.05) |

**Scrolling**: Independent vertical scroll for the schedule list

---

### Right Panel - Program Details

**Dimensions**: ~40% viewport width, full height (below top bar)
**Position**: Right side of screen, overlays gradient background
**Visibility**: Only visible when a program is selected from the schedule

**Visual Style**:
- Semi-transparent dark background: `rgba(0, 0, 0, 0.5)`
- Padding: 32px
- Content vertically centered or top-aligned with generous top padding

**Layout when a program is selected**:

```
┌────────────────────────────────────────┐
│                                        │
│  PROGRAM TITLE                         │  ← Bold, 28-32px, white
│  Season X, Episode Y (if applicable)   │  ← 16px, gray
│                                        │
│  ┌────────┐                            │
│  │ Channel│  Channel Name              │  ← Channel logo + name
│  │  Logo  │  Live Now / Starts at X    │  ← Status indicator
│  └────────┘                            │
│                                        │
│  ────────────────────────────────────  │  ← Divider line
│                                        │
│  🕐 10:00 AM - 11:30 AM               │  ← Time range
│  📅 Tuesday, April 11                  │  ← Full date
│  🏷️ Drama, Action                      │  ← Category/genre tags
│                                        │
│  ────────────────────────────────────  │
│                                        │
│  Program description goes here. This   │  ← 14-16px, light gray
│  can be multiple lines and should      │     Max ~150 words, scrollable
│  wrap naturally within the panel.      │     if longer
│                                        │
│  ────────────────────────────────────  │
│                                        │
│  [ ▶ Watch Now ]  [ 🔴 Record ]       │  ← Action buttons (future)
│                                        │
└────────────────────────────────────────┘
```

**Elements**:

| Element | Specification |
|---------|---------------|
| Program Title | Bold, 28-32px, white, max 2 lines with ellipsis |
| Episode Info | Regular, 16px, gray (#a0a0a0), optional |
| Channel Logo | 48×36px, rounded corners |
| Channel Name | Bold, 16px, white |
| Status | "Live Now" (green) or "Starts in X min" or "Aired at X" |
| Time Range | 14px, white, clock icon prefix |
| Date | 14px, gray, calendar icon prefix |
| Categories | Tag chips, small rounded rectangles, muted colors |
| Description | 14-16px, light gray (#c0c0c0), line-height 1.5 |
| Action Buttons | Primary button style, 44px height (touch-friendly) |

**Empty State** (no program selected):
- Panel either hidden completely OR
- Shows subtle prompt: "Select a program to see details"
- Gradient background fully visible in this area

**Close/Deselect**:
- Clicking outside the details panel (on schedule or channels) deselects
- Optional: Small X button in top-right corner of details panel
- ESC key clears selection

---

## Interaction Patterns

### User Flow Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Select    │───▶│   Select    │───▶│    View     │
│   Channel   │    │   Program   │    │   Details   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
  Schedule panel    Details panel      Action buttons
    updates           appears            (future)
```

### Channel Navigation (Left Panel)

1. **Keyboard/Remote**: Up/Down arrows move selection between channels
2. **Mouse**: Click to select channel, scroll to browse
3. **Touch**: Tap to select, swipe to scroll

When a channel is selected:
- That row receives the focused/selected visual treatment
- Center panel updates to show that channel's schedule for the selected day
- Any previously selected program is deselected
- Schedule auto-scrolls to current time (or start of day if viewing future)

### Schedule Navigation (Center Panel)

1. **Scroll**: The schedule list scrolls independently
2. **Click/Select Program**: Highlights the row and shows details in right panel
3. **Current Program Indicator**: "NOW" badge or highlighted row for currently-airing program
4. **Keyboard**: Up/Down to move through programs, Enter to select

**Program Row States**:
- Default: Normal text
- Hover: Subtle background highlight
- Selected: Brighter background, left accent bar (purple)
- Now Playing: "NOW" badge or distinct styling

### Day Navigation (Top Bar)

1. **Day Chips**: Click to jump to that day's schedule
2. **Prev/Next Arrows**: Navigate one day at a time
3. **Date Picker**: Opens calendar overlay for arbitrary date selection

When day changes:
- Schedule panel reloads for new date
- Channel selection preserved
- Program selection cleared
- Schedule header updates to show new date

### Search Flow

1. **Activate**: Click search icon or press Ctrl/Cmd+F
2. **Type**: Results appear in dropdown as user types (debounced)
3. **Navigate Results**: Arrow keys or mouse
4. **Select Result**:
   - Day navigation jumps to program's date
   - Channel becomes selected
   - Schedule shows that day
   - Program becomes selected
   - Details panel shows program info
5. **Clear**: X button or Escape key

### Program Details (Right Panel)

- **Appears**: When a program is selected from schedule
- **Disappears**: When user selects a different channel (without selecting program) or presses Escape
- **Actions**: Watch Now, Record (future implementation)

### Time Context

- The schedule list should auto-scroll to show "now" at the top when a channel is selected
- A visual indicator (line, highlight, or "NOW" badge) marks the current time position
- Past programs shown in slightly muted styling
- Current program has distinct "LIVE" or "NOW" indicator

---

## Component Hierarchy (Suggested)

```
EPG.tsx (view)
├── EpgBackground (gradient layer, z-index: 0)
│
├── EpgTopBar (fixed top, z-index: 10)
│   ├── EpgSearchInput
│   │   └── EpgSearchResults (dropdown)
│   └── DayNavigationBar
│       ├── PrevDayButton
│       ├── DayChips (Today, Tonight, Tomorrow, Wed, Thu...)
│       ├── NextDayButton
│       └── DatePickerButton → DatePickerOverlay
│
├── EpgMainContent (flex row below top bar)
│   │
│   ├── EpgChannelList (left panel, ~30%)
│   │   ├── EpgChannelRow (repeated, virtualized)
│   │   │   ├── ChannelLogo
│   │   │   ├── ChannelInfo (name, time, title)
│   │   │   └── ProgressBar
│   │   └── (keyboard navigation support)
│   │
│   ├── EpgSchedulePanel (center panel, ~30%)
│   │   ├── ScheduleHeader (shows selected day)
│   │   ├── ScheduleList (virtualized)
│   │   │   └── ScheduleRow (time + title, selectable)
│   │   └── NowIndicator (marks current time)
│   │
│   └── EpgProgramDetails (right panel, ~40%)
│       ├── ProgramHeader (title, episode info)
│       ├── ChannelBadge (logo, name, status)
│       ├── ProgramMeta (time, date, categories)
│       ├── ProgramDescription (scrollable)
│       └── ActionButtons (Watch, Record - future)
│
└── SearchOverlay (modal for search results on mobile/expanded)
```

---

## Color Palette

| Use | Color | Hex/RGBA |
|-----|-------|----------|
| **Background** | | |
| Gradient start | Dark navy | #1a1a2e |
| Gradient mid | Deep blue | #16213e |
| Gradient end | Ocean blue | #0f3460 |
| **Panels** | | |
| Top bar background | Semi-transparent black | rgba(0,0,0,0.7) |
| Left panel overlay | Semi-transparent black | rgba(0,0,0,0.6) |
| Center panel overlay | Semi-transparent black | rgba(0,0,0,0.5) |
| Right panel overlay | Semi-transparent black | rgba(0,0,0,0.5) |
| **Text** | | |
| Primary text | White | #ffffff |
| Secondary text | Light gray | #a0a0a0 |
| Muted text (descriptions) | Lighter gray | #c0c0c0 |
| **Interactive Elements** | | |
| Progress bar background | Faint white | rgba(255,255,255,0.2) |
| Progress bar fill start | Purple | #6366f1 |
| Progress bar fill end | Cyan | #22d3ee |
| Selected row border | Faint white | rgba(255,255,255,0.3) |
| Selected row background | Purple tint | rgba(99,102,241,0.2) |
| **Day Chips** | | |
| Default background | Transparent | transparent |
| Default border | Faint white | rgba(255,255,255,0.2) |
| Selected background | Purple | #6366f1 |
| Hover background | Purple light | rgba(99,102,241,0.3) |
| **Status Indicators** | | |
| Live/Now | Green | #22c55e |
| Upcoming | Blue | #3b82f6 |
| Aired/Past | Gray | #6b7280 |

---

## Responsive Considerations

### Desktop (1280px+)
- Full three-panel layout: Left (~30%), Center (~30%), Right (~40%)
- Top bar with full search input and all day chips visible
- All three panels visible simultaneously
- Gradient background visible behind right panel when no program selected

### Large Tablet / Small Desktop (1024px - 1279px)
- Three-panel layout with tighter spacing
- Left (~30%), Center (~30%), Right (~40%)
- Day chips may scroll horizontally
- Search input collapsed to icon, expands on click

### Tablet (768px - 1023px)
- Two-panel mode + overlay
- Left panel (channels): 40%
- Center panel (schedule): 60%
- Right panel (details): Slides in as overlay from right when program selected
- Close button on details overlay

### Mobile (< 768px)
- Single panel with tab navigation
- Bottom tab bar: [Channels] [Schedule] [Details]
- Or: Stacked navigation with back buttons
- Search in header, always visible as icon
- Day navigation as horizontal scroll strip
- Details as full-screen overlay

### Panel Transitions
- Use CSS transitions (300ms ease) for panel show/hide
- Details panel slides in from right
- On mobile, use slide animations between views

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate channels (when channel list focused) or programs (when schedule focused) |
| `←` / `→` | Move focus between panels (Channels ↔ Schedule ↔ Details) |
| `Enter` | Select focused channel/program |
| `Escape` | Close details panel / Clear search / Deselect |
| `Tab` | Move between interactive elements |
| `Ctrl/Cmd + F` | Focus search input |
| `Page Up/Down` | Navigate days (previous/next) |
| `Home` | Jump to "Today" |

---

## Accessibility Notes

- Ensure sufficient color contrast (WCAG AA minimum)
- Keyboard navigation must work for all interactions
- Focus indicators must be clearly visible (2px outline minimum)
- Screen reader: Announce channel name and current program when focused
- Progress bar should have aria-label with time remaining
- Day chips should be in a navigation landmark
- Details panel should trap focus when open (modal behavior on tablet/mobile)
- Announce panel changes to screen readers (aria-live regions)

---

## Migration Notes (Current → New)

### Components to Retire
- `EpgGrid.tsx` - Horizontal timeline grid (replaced by vertical lists)
- `EpgCell.tsx` - Grid cells (replaced by ChannelRow and ScheduleRow)
- `TimeNavigationBar.tsx` - Current time nav (replaced by DayNavigationBar in top bar)

### Components to Adapt
- `ProgramDetailsPanel.tsx` - Adapt to be inline right panel instead of slide-in overlay
- `EpgSearchInput.tsx` - Move to top bar, keep search logic
- `EpgSearchResults.tsx` - Adapt dropdown styling to match dark theme

### New Components Needed
- `EpgBackground` - Gradient background layer
- `EpgTopBar` - Container for search and day navigation
- `DayNavigationBar` - Day chips and navigation arrows
- `EpgChannelList` - Vertical channel list container
- `EpgChannelRow` - Individual channel with now-playing info
- `EpgSchedulePanel` - Schedule list for selected channel
- `ScheduleRow` - Individual program in schedule
- `ProgressBar` - Reusable progress indicator

### Hooks to Update
- `useEpgGridData` - May need to fetch data differently (single channel at a time vs. all channels × time range)
- Consider new `useChannelSchedule(channelId, date)` hook

---

## Future Enhancements

1. **Live Video Preview**: Replace gradient background with a live video stream of the selected channel (picture-in-picture style)
2. **Program Artwork**: Display poster/thumbnail for selected program in background
3. **Category Filtering**: Allow filtering channels by category in the left panel
4. **Favorites**: Pin favorite channels to the top of the list
5. **Recording Integration**: Show recording status indicators on programs
6. **Mini Player**: Small video preview in corner while browsing
7. **Quick Actions**: Long-press or right-click context menu on programs

---

## Reference Image Analysis

The reference design (provided by stakeholder) demonstrates:

- Clean visual hierarchy with channel list taking focus
- Effective use of transparency and layering for depth
- Progress bars that immediately communicate "how much is left"
- Cinematic background that creates premium TV experience
- Date header that grounds the user in time context
- Generous spacing that works well for remote/lean-back interaction

This design trades horizontal time browsing for vertical channel browsing—better suited for users who think "what's on my favorite channels?" rather than "what's on at 8pm?"

**Additions beyond reference image** (documented in this spec):
- Top bar with search and day navigation (not shown in reference)
- Right panel for program details (reference shows this area as background)
- Full keyboard navigation support
- Responsive breakpoints for tablet/mobile
- Migration path from current grid-based implementation
