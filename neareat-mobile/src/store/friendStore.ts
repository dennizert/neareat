import { create } from 'zustand';
import type { Friend, FriendRequest } from '../types';

interface FriendState {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  setFriends: (friends: Friend[]) => void;
  addFriend: (friend: Friend) => void;
  removeFriend: (friendId: string) => void;
  setPendingRequests: (requests: FriendRequest[]) => void;
  removeRequest: (requestId: string) => void;
  clear: () => void;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  setFriends: (friends) => set({ friends }),
  addFriend: (friend) => set({ friends: [friend, ...get().friends] }),
  removeFriend: (friendId) =>
    set({ friends: get().friends.filter(f => f.id !== friendId) }),
  setPendingRequests: (requests) => set({ pendingRequests: requests }),
  removeRequest: (requestId) =>
    set({ pendingRequests: get().pendingRequests.filter(r => r.id !== requestId) }),
  clear: () => set({ friends: [], pendingRequests: [] }),
}));
