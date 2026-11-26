import { create } from 'zustand';
import type { AccountUser } from '@/lib/api';

type SessionState = {
  user: AccountUser | null;
  isReady: boolean;
  restoreError: string | null;
  setUser: (user: AccountUser | null) => void;
  setReady: (isReady: boolean) => void;
  setRestoreError: (message: string | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  isReady: false,
  restoreError: null,
  setUser: (user) => set({ user }),
  setReady: (isReady) => set({ isReady }),
  setRestoreError: (message) => set({ restoreError: message }),
}));
