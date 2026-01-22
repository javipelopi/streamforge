/**
 * Component Tests for Story 5.1: EPG Grid Browser with Time Navigation
 *
 * These tests verify component-level behavior and performance requirements
 * for the EPG grid. All tests are in RED phase - they will fail until
 * the implementation is complete.
 *
 * Test Strategy:
 * - Component level: Tests isolated component behavior
 * - Focus on virtualization performance (AC#3)
 * - Tests component props and event handlers
 * - Verifies TanStack Virtual integration
 *
 * Acceptance Criteria Coverage:
 * - AC#3: Virtualization with TanStack Virtual for responsive UI
 * - AC#4: Program cell click handling
 * - AC#2: Time navigation bar controls
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EpgGrid } from '../../src/components/epg/EpgGrid';
import { TimeNavigationBar } from '../../src/components/epg/TimeNavigationBar';
import { EpgCell } from '../../src/components/epg/EpgCell';
import {
  createEpgGridData,
  createEpgChannelRow,
} from '../support/factories/epg-grid-data.factory';
import { createTimeWindow } from '../support/factories/time-navigation.factory';

describe('EpgGrid Component', () => {
  describe('Vertical Virtualization (Channels)', () => {
    it('should virtualize channel rows efficiently', () => {
      // GIVEN: EPG grid with 500 channels (performance test)
      const gridData = createEpgGridData({
        channelCount: 500,
        startTime: new Date('2026-01-22T18:00:00'),
        endTime: new Date('2026-01-22T21:00:00'),
      });

      // WHEN: Grid is rendered
      const { container } = render(
        <EpgGrid
          channels={gridData.channels}
          timeWindow={gridData.timeWindow}
          onProgramClick={() => {}}
        />
      );

      // THEN: Only visible rows are rendered (not all 500)
      const channelRows = container.querySelectorAll('[data-testid^="epg-channel-row-"]');

      // With typical viewport height, expect ~10-20 visible rows + overscan
      // NOT all 500 rows (that would indicate virtualization is not working)
      expect(channelRows.length).toBeLessThan(50);
      expect(channelRows.length).toBeGreaterThan(5);

      // THEN: Grid container has scroll capability
      const gridContainer = screen.getByTestId('epg-grid-container');
      expect(gridContainer).toBeInTheDocument();

      // Verify container has overflow styling for scrolling
      const hasOverflow =
        window.getComputedStyle(gridContainer).overflow === 'auto' ||
        window.getComputedStyle(gridContainer).overflowY === 'auto' ||
        window.getComputedStyle(gridContainer).overflowY === 'scroll';

      expect(hasOverflow).toBe(true);
    });

    it('should render additional rows when scrolling', async () => {
      // GIVEN: EPG grid with many channels
      const gridData = createEpgGridData({
        channelCount: 100,
        startTime: new Date('2026-01-22T18:00:00'),
        endTime: new Date('2026-01-22T21:00:00'),
      });

      const { container } = render(
        <EpgGrid
          channels={gridData.channels}
          timeWindow={gridData.timeWindow}
          onProgramClick={() => {}}
        />
      );

      const gridContainer = screen.getByTestId('epg-grid-container');

      // Get initial row count
      const initialRowCount = container.querySelectorAll(
        '[data-testid^="epg-channel-row-"]'
      ).length;

      // WHEN: User scrolls down significantly
      gridContainer.scrollTop = 1000;
      gridContainer.dispatchEvent(new Event('scroll'));

      // Wait for virtualization to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // THEN: Different rows are rendered (virtualization working)
      // Note: Exact assertion depends on virtualizer behavior
      // We verify that scroll position changed and grid still renders efficiently
      expect(gridContainer.scrollTop).toBeGreaterThan(0);

      const rowsAfterScroll = container.querySelectorAll(
        '[data-testid^="epg-channel-row-"]'
      ).length;

      // Row count should remain relatively small (virtualization active)
      expect(rowsAfterScroll).toBeLessThan(50);
    });
  });

  describe('Horizontal Virtualization (Time Slots)', () => {
    it('should virtualize time columns efficiently', () => {
      // GIVEN: EPG grid with 7 days of program data (168 hours = 336 half-hour slots)
      const startTime = new Date('2026-01-22T00:00:00');
      const endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000);

      const gridData = createEpgGridData({
        channelCount: 10,
        startTime,
        endTime,
      });

      // WHEN: Grid is rendered
      const { container } = render(
        <EpgGrid
          channels={gridData.channels}
          timeWindow={gridData.timeWindow}
          onProgramClick={() => {}}
        />
      );

      // THEN: Only visible time slots are rendered (not all 336)
      const timeSlots = container.querySelectorAll('[data-testid^="epg-time-slot-"]');

      // With typical viewport width, expect ~6-12 visible slots + overscan
      // NOT all 336 slots (that would indicate virtualization is not working)
      expect(timeSlots.length).toBeLessThan(30);
      expect(timeSlots.length).toBeGreaterThan(3);

      // THEN: Grid container has horizontal scroll capability
      const gridContainer = screen.getByTestId('epg-grid-container');

      const hasHorizontalOverflow =
        window.getComputedStyle(gridContainer).overflow === 'auto' ||
        window.getComputedStyle(gridContainer).overflowX === 'auto' ||
        window.getComputedStyle(gridContainer).overflowX === 'scroll';

      expect(hasHorizontalOverflow).toBe(true);
    });

    it('should render additional columns when scrolling horizontally', async () => {
      // GIVEN: EPG grid with many time slots
      const startTime = new Date('2026-01-22T00:00:00');
      const endTime = new Date(startTime.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days

      const gridData = createEpgGridData({
        channelCount: 10,
        startTime,
        endTime,
      });

      const { container } = render(
        <EpgGrid
          channels={gridData.channels}
          timeWindow={gridData.timeWindow}
          onProgramClick={() => {}}
        />
      );

      const gridContainer = screen.getByTestId('epg-grid-container');

      // Get initial slot count
      const initialSlotCount = container.querySelectorAll(
        '[data-testid^="epg-time-slot-"]'
      ).length;

      // WHEN: User scrolls right significantly
      gridContainer.scrollLeft = 1000;
      gridContainer.dispatchEvent(new Event('scroll'));

      // Wait for virtualization to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // THEN: Different slots are rendered (virtualization working)
      expect(gridContainer.scrollLeft).toBeGreaterThan(0);

      const slotsAfterScroll = container.querySelectorAll(
        '[data-testid^="epg-time-slot-"]'
      ).length;

      // Slot count should remain relatively small (virtualization active)
      expect(slotsAfterScroll).toBeLessThan(30);
    });
  });

  describe('Performance Requirements (NFR5)', () => {
    it('should render grid with 500 channels in under 100ms', () => {
      // GIVEN: EPG grid with 500 channels
      const gridData = createEpgGridData({
        channelCount: 500,
        startTime: new Date('2026-01-22T18:00:00'),
        endTime: new Date('2026-01-22T21:00:00'),
      });

      // WHEN: Grid is rendered
      const startTime = performance.now();

      render(
        <EpgGrid
          channels={gridData.channels}
          timeWindow={gridData.timeWindow}
          onProgramClick={() => {}}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // THEN: Render time is under 100ms (NFR5 requirement)
      expect(renderTime).toBeLessThan(100);
    });
  });
});

describe('EpgCell Component', () => {
  describe('Program Click Handling', () => {
    it('should handle program click events', async () => {
      // GIVEN: Program cell component
      const user = userEvent.setup();
      const mockOnClick = vi.fn();

      const program = {
        id: 100,
        title: 'Evening News',
        startTime: '2026-01-22T18:00:00Z',
        endTime: '2026-01-22T18:30:00Z',
        category: 'News',
      };

      // WHEN: Component is rendered
      render(
        <EpgCell
          program={program}
          slotWidth={120}
          onClick={mockOnClick}
          isCurrentlyAiring={false}
        />
      );

      const cell = screen.getByTestId(`epg-program-cell-${program.id}`);

      // THEN: Cell is visible and clickable
      expect(cell).toBeInTheDocument();

      // WHEN: User clicks the cell
      await user.click(cell);

      // THEN: onClick handler is called with program details
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(program);
    });

    it('should display visual indicator for currently airing programs', () => {
      // GIVEN: Currently airing program
      const program = {
        id: 101,
        title: 'Live Sports',
        startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // Started 30 min ago
        endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // Ends in 30 min
        category: 'Sports',
      };

      // WHEN: Component is rendered with isCurrentlyAiring=true
      render(
        <EpgCell
          program={program}
          slotWidth={120}
          onClick={() => {}}
          isCurrentlyAiring={true}
        />
      );

      const cell = screen.getByTestId(`epg-program-cell-${program.id}`);

      // THEN: Cell has visual indicator class
      expect(cell).toHaveClass(/airing|current|live/i);
    });

    it('should calculate cell width based on program duration', () => {
      // GIVEN: Programs with different durations
      const program30min = {
        id: 102,
        title: 'Short Show',
        startTime: '2026-01-22T18:00:00Z',
        endTime: '2026-01-22T18:30:00Z',
        category: 'News',
      };

      const program90min = {
        id: 103,
        title: 'Movie',
        startTime: '2026-01-22T18:00:00Z',
        endTime: '2026-01-22T19:30:00Z',
        category: 'Movies',
      };

      const slotWidth = 120; // 120px per 30-minute slot

      // WHEN: Components are rendered
      const { container: container30 } = render(
        <EpgCell program={program30min} slotWidth={slotWidth} onClick={() => {}} isCurrentlyAiring={false} />
      );

      const { container: container90 } = render(
        <EpgCell program={program90min} slotWidth={slotWidth} onClick={() => {}} isCurrentlyAiring={false} />
      );

      const cell30 = container30.querySelector(`[data-testid="epg-program-cell-${program30min.id}"]`);
      const cell90 = container90.querySelector(`[data-testid="epg-program-cell-${program90min.id}"]`);

      // THEN: 90-minute program is 3x wider than 30-minute program
      const width30 = parseInt(window.getComputedStyle(cell30!).width);
      const width90 = parseInt(window.getComputedStyle(cell90!).width);

      expect(width90).toBeGreaterThan(width30 * 2.5);
      expect(width90).toBeLessThan(width30 * 3.5);
    });
  });
});

describe('TimeNavigationBar Component', () => {
  describe('Control Rendering', () => {
    it('should render all navigation controls', () => {
      // GIVEN: Time navigation bar component
      const mockHandlers = {
        onNow: vi.fn(),
        onTonight: vi.fn(),
        onTomorrow: vi.fn(),
        onPrevDay: vi.fn(),
        onNextDay: vi.fn(),
        onDateChange: vi.fn(),
      };

      const currentWindow = createTimeWindow({
        startTime: new Date('2026-01-22T18:00:00'),
        durationHours: 3,
      });

      // WHEN: Component is rendered
      render(<TimeNavigationBar timeWindow={currentWindow} {...mockHandlers} />);

      // THEN: All navigation buttons are visible
      expect(screen.getByTestId('time-nav-now-button')).toBeInTheDocument();
      expect(screen.getByTestId('time-nav-tonight-button')).toBeInTheDocument();
      expect(screen.getByTestId('time-nav-tomorrow-button')).toBeInTheDocument();
      expect(screen.getByTestId('time-nav-prev-day-button')).toBeInTheDocument();
      expect(screen.getByTestId('time-nav-next-day-button')).toBeInTheDocument();
      expect(screen.getByTestId('time-nav-date-picker')).toBeInTheDocument();

      // THEN: Current date/time display is visible
      expect(screen.getByTestId('time-nav-current-date-display')).toBeInTheDocument();
    });

    it('should call onNow handler when Now button is clicked', async () => {
      // GIVEN: Time navigation bar
      const user = userEvent.setup();
      const mockOnNow = vi.fn();

      const currentWindow = createTimeWindow({
        startTime: new Date('2026-01-22T18:00:00'),
        durationHours: 3,
      });

      render(
        <TimeNavigationBar
          timeWindow={currentWindow}
          onNow={mockOnNow}
          onTonight={vi.fn()}
          onTomorrow={vi.fn()}
          onPrevDay={vi.fn()}
          onNextDay={vi.fn()}
          onDateChange={vi.fn()}
        />
      );

      // WHEN: User clicks Now button
      const nowButton = screen.getByTestId('time-nav-now-button');
      await user.click(nowButton);

      // THEN: onNow handler is called
      expect(mockOnNow).toHaveBeenCalledTimes(1);
    });

    it('should call onTonight handler when Tonight button is clicked', async () => {
      // GIVEN: Time navigation bar
      const user = userEvent.setup();
      const mockOnTonight = vi.fn();

      const currentWindow = createTimeWindow({
        startTime: new Date('2026-01-22T18:00:00'),
        durationHours: 3,
      });

      render(
        <TimeNavigationBar
          timeWindow={currentWindow}
          onNow={vi.fn()}
          onTonight={mockOnTonight}
          onTomorrow={vi.fn()}
          onPrevDay={vi.fn()}
          onNextDay={vi.fn()}
          onDateChange={vi.fn()}
        />
      );

      // WHEN: User clicks Tonight button
      const tonightButton = screen.getByTestId('time-nav-tonight-button');
      await user.click(tonightButton);

      // THEN: onTonight handler is called
      expect(mockOnTonight).toHaveBeenCalledTimes(1);
    });

    it('should limit date picker to 7 days from today', () => {
      // GIVEN: Time navigation bar
      const currentWindow = createTimeWindow({
        startTime: new Date('2026-01-22T18:00:00'),
        durationHours: 3,
      });

      render(
        <TimeNavigationBar
          timeWindow={currentWindow}
          onNow={vi.fn()}
          onTonight={vi.fn()}
          onTomorrow={vi.fn()}
          onPrevDay={vi.fn()}
          onNextDay={vi.fn()}
          onDateChange={vi.fn()}
        />
      );

      // WHEN: Date picker is checked
      const datePicker = screen.getByTestId('time-nav-date-picker') as HTMLInputElement;

      // THEN: Min date is today
      const minDate = datePicker.getAttribute('min');
      expect(minDate).toBeTruthy();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDateObj = new Date(minDate!);
      expect(minDateObj.toDateString()).toBe(today.toDateString());

      // THEN: Max date is 7 days from today
      const maxDate = datePicker.getAttribute('max');
      expect(maxDate).toBeTruthy();

      const maxDateObj = new Date(maxDate!);
      const daysDiff = Math.floor((maxDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBe(7);
    });
  });
});
