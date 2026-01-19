/**
 * Application State Store using Zustand
 * Story 1.3: Create React GUI Shell with Routing
 */
import { create } from 'zustand';

export type ServerStatus = 'running' | 'stopped' | 'error';

export interface AppState {
  sidebarOpen: boolean;
  serverStatus: ServerStatus;
  unreadLogCount: number;
  toggleSidebar: () => void;
  setServerStatus: (status: ServerStatus) => void;
  setUnreadLogCount: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  serverStatus: 'stopped',
  unreadLogCount: 0,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setServerStatus: (status) => set({ serverStatus: status }),
  setUnreadLogCount: (count) => set({ unreadLogCount: count }),
}));

// Expose store for testing - extend window interface
declare global {
  interface Window {
    __ZUSTAND_STORE__?: typeof useAppStore;
    __ZUSTAND_STORE_STATE__?: AppState;
  }
}

// Expose store for testing
if (typeof window !== 'undefined') {
  window.__ZUSTAND_STORE__ = useAppStore;
  window.__ZUSTAND_STORE_STATE__ = useAppStore.getState();

  // Keep the state reference updated
  useAppStore.subscribe((state) => {
    window.__ZUSTAND_STORE_STATE__ = state;
  });
}
