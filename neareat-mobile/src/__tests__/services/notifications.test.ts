/**
 * #430 — notifications.ts servis sözleşmesi.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));

import api from '../../services/api';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../../services/notifications';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('notifications servis sözleşmesi', () => {
  it('getNotifications varsayılan page/limit ile çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { notifications: [], total: 0, hasMore: false } });
    await getNotifications();
    expect(mockedApi.get).toHaveBeenCalledWith('/notifications', { params: { page: 1, limit: 20 } });
  });

  it('getUnreadCount count alanını çıkarır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { count: 4 } });
    const result = await getUnreadCount();
    expect(mockedApi.get).toHaveBeenCalledWith('/notifications/unread-count');
    expect(result).toBe(4);
  });

  it('markAsRead doğru path ile PUT atar', async () => {
    mockedApi.put.mockResolvedValueOnce({});
    await markAsRead('n1');
    expect(mockedApi.put).toHaveBeenCalledWith('/notifications/n1/read');
  });

  it('markAllAsRead doğru path ile PUT atar', async () => {
    mockedApi.put.mockResolvedValueOnce({});
    await markAllAsRead();
    expect(mockedApi.put).toHaveBeenCalledWith('/notifications/read-all');
  });
});
