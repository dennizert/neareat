import { create } from 'zustand';
import type { UserProfile, StarEvent } from '../types';
import { getLevel } from '../services/social';

interface UserProfileState {
  profile: UserProfile | null;
  starEvents: StarEvent[];
  setProfile: (profile: UserProfile) => void;
  setStarEvents: (events: StarEvent[]) => void;
  updateProfile: (fields: Partial<UserProfile>) => void;
  addStarEvent: (event: StarEvent) => void;
  clear: () => void;
}

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  profile: null,
  starEvents: [],
  setProfile: (profile) => set({ profile }),
  setStarEvents: (events) => set({ starEvents: events }),
  updateProfile: (fields) => {
    const p = get().profile;
    if (!p) return;
    const newStars = fields.starCount ?? p.starCount;
    const levelData = getLevel(newStars);
    set({ profile: { ...p, ...fields, ...levelData } });
  },
  addStarEvent: (event) => {
    const p = get().profile;
    if (!p) return;
    const newStarCount = p.starCount + event.amount;
    const levelData = getLevel(newStarCount);
    set({
      profile: { ...p, starCount: newStarCount, ...levelData },
      starEvents: [event, ...get().starEvents],
    });
  },
  clear: () => set({ profile: null, starEvents: [] }),
}));
