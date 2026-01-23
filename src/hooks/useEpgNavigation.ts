/**
 * EPG Navigation Hook
 * Manages keyboard navigation for remote-control friendly EPG interface.
 *
 * Navigation model:
 * - Header: Left/Right between search, day chips, date picker
 * - Header → Down/Tab → Channel list
 * - Channel list: Up/Down to navigate, Right/Enter → Schedule panel
 * - Channel list: Up at top → Header
 * - Channel list: Left → Close details panel
 * - Schedule panel: Up/Down to navigate, Left → Channel list, Right/Enter → Details
 * - Details panel: Escape/Left → back to schedule
 */

import { useRef, useCallback } from 'react';

export type EpgPanelId = 'header' | 'channels' | 'schedule' | 'details';

interface UseEpgNavigationReturn {
  headerRef: React.RefObject<HTMLDivElement>;
  channelsRef: React.RefObject<HTMLDivElement>;
  scheduleRef: React.RefObject<HTMLDivElement>;
  detailsRef: React.RefObject<HTMLDivElement>;
  focusPanel: (panelId: EpgPanelId) => void;
  navigateFromHeader: (direction: 'down') => void;
  navigateFromChannels: (direction: 'up' | 'right' | 'left') => void;
  navigateFromSchedule: (direction: 'left' | 'right') => void;
  navigateFromDetails: (direction: 'left') => void;
}

/**
 * Hook for managing EPG panel navigation
 * Returns refs to attach to panels and navigation functions
 */
export function useEpgNavigation(): UseEpgNavigationReturn {
  const headerRef = useRef<HTMLDivElement>(null);
  const channelsRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  const focusPanel = useCallback((panelId: EpgPanelId) => {
    let ref: React.RefObject<HTMLDivElement>;
    switch (panelId) {
      case 'header':
        ref = headerRef;
        break;
      case 'channels':
        ref = channelsRef;
        break;
      case 'schedule':
        ref = scheduleRef;
        break;
      case 'details':
        ref = detailsRef;
        break;
    }


    if (ref.current) {
      // Find the first focusable element or the panel itself
      const focusable = ref.current.querySelector<HTMLElement>(
        '[tabindex="0"], button:not([disabled]), input:not([disabled])'
      );
      if (focusable) {
        focusable.focus();
      } else {
        ref.current.focus();
      }
    }
  }, []);

  const navigateFromHeader = useCallback(
    (direction: 'down') => {
      if (direction === 'down') {
        focusPanel('channels');
      }
    },
    [focusPanel]
  );

  const navigateFromChannels = useCallback(
    (direction: 'up' | 'right' | 'left') => {
      if (direction === 'up') {
        focusPanel('header');
      } else if (direction === 'right') {
        focusPanel('schedule');
      }
      // 'left' is handled by the parent to close details
    },
    [focusPanel]
  );

  const navigateFromSchedule = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left') {
        focusPanel('channels');
      } else if (direction === 'right') {
        focusPanel('details');
      }
    },
    [focusPanel]
  );

  const navigateFromDetails = useCallback(
    (direction: 'left') => {
      if (direction === 'left') {
        focusPanel('schedule');
      }
    },
    [focusPanel]
  );

  return {
    headerRef,
    channelsRef,
    scheduleRef,
    detailsRef,
    focusPanel,
    navigateFromHeader,
    navigateFromChannels,
    navigateFromSchedule,
    navigateFromDetails,
  };
}
