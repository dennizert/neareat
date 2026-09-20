/**
 * #430 — messages.ts servis sözleşmesi: getMessages'ın cursor'ı koşullu ekleme
 * mantığı ve endpoint/param doğruluğu.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '../../services/api';
import { getConversations, getMessages, sendMessage, getUnreadMessageCount, reportUser } from '../../services/messages';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('messages servis sözleşmesi', () => {
  it('getConversations /messages/conversations çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getConversations();
    expect(mockedApi.get).toHaveBeenCalledWith('/messages/conversations');
  });

  it('getMessages cursor verilmezse yalnızca limit gönderir', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [], otherUser: null, hasMore: false, nextCursor: null } });
    await getMessages('u2');
    expect(mockedApi.get).toHaveBeenCalledWith('/messages/u2', { params: { limit: '30' } });
  });

  it('getMessages cursor verilirse params’a eklenir', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { messages: [], otherUser: null, hasMore: true, nextCursor: 'c2' } });
    await getMessages('u2', 'c1');
    expect(mockedApi.get).toHaveBeenCalledWith('/messages/u2', { params: { limit: '30', cursor: 'c1' } });
  });

  it('sendMessage content ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'm1', content: 'selam' } });
    await sendMessage('u2', 'selam');
    expect(mockedApi.post).toHaveBeenCalledWith('/messages/u2', { content: 'selam' });
  });

  it('getUnreadMessageCount count alanını çıkarır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { count: 7 } });
    const result = await getUnreadMessageCount();
    expect(mockedApi.get).toHaveBeenCalledWith('/messages/unread-count');
    expect(result).toBe(7);
  });

  it('reportUser reason ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await reportUser('u3', 'spam');
    expect(mockedApi.post).toHaveBeenCalledWith('/social/users/u3/report', { reason: 'spam' });
  });
});
