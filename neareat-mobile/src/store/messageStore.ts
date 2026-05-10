import { create } from 'zustand';
import type { Conversation, Message } from '../types';
import { getConversations, getUnreadMessageCount } from '../services/messages';

interface MessageStore {
  conversations: Conversation[];
  unreadCount: number;
  fetchConversations: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  updateConversationAfterSend: (userId: string, profile: any, message: Message) => void;
  markConversationRead: (userId: string) => void;
  clear: () => void;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  conversations: [],
  unreadCount: 0,

  fetchConversations: async () => {
    try {
      const conversations = await getConversations();
      const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
      set({ conversations, unreadCount });
    } catch {}
  },

  fetchUnreadCount: async () => {
    try {
      const count = await getUnreadMessageCount();
      set({ unreadCount: count });
    } catch {}
  },

  updateConversationAfterSend: (userId, profile, message) => {
    set(state => {
      const existing = state.conversations.find(c => c.userId === userId);
      const updated: Conversation = {
        userId,
        profile,
        lastMessage: { content: message.content, createdAt: message.createdAt, isRead: true, isMine: true },
        unreadCount: existing?.unreadCount ?? 0,
      };
      const others = state.conversations.filter(c => c.userId !== userId);
      return { conversations: [updated, ...others] };
    });
  },

  markConversationRead: (userId) => {
    set(state => {
      const conv = state.conversations.find(c => c.userId === userId);
      if (!conv || conv.unreadCount === 0) return state;
      const delta = conv.unreadCount;
      return {
        conversations: state.conversations.map(c =>
          c.userId === userId ? { ...c, unreadCount: 0 } : c,
        ),
        unreadCount: Math.max(0, state.unreadCount - delta),
      };
    });
  },

  clear: () => set({ conversations: [], unreadCount: 0 }),
}));
