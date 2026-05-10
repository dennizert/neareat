import api from './api';
import type { Message, Conversation } from '../types';

export async function getConversations(): Promise<Conversation[]> {
  const res = await api.get('/messages/conversations');
  return res.data;
}

export async function getMessages(
  userId: string,
  cursor?: string,
): Promise<{ messages: Message[]; otherUser: any; hasMore: boolean; nextCursor: string | null }> {
  const params: Record<string, string> = { limit: '30' };
  if (cursor) params.cursor = cursor;
  const res = await api.get(`/messages/${userId}`, { params });
  return res.data;
}

export async function sendMessage(userId: string, content: string): Promise<Message> {
  const res = await api.post(`/messages/${userId}`, { content });
  return res.data;
}

export async function getUnreadMessageCount(): Promise<number> {
  const res = await api.get('/messages/unread-count');
  return res.data.count;
}

export async function reportUser(userId: string, reason: string): Promise<void> {
  await api.post(`/social/users/${userId}/report`, { reason });
}
