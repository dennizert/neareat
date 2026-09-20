/**
 * #430 — notificationPrefs.ts servis sözleşmesi.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));

import api from '../../services/api';
import { getNotificationPreferences, updateNotificationPreferences } from '../../services/notificationPrefs';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('notificationPrefs servis sözleşmesi', () => {
  it('getNotificationPreferences preferences alanını çıkarır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { preferences: [{ type: 'RESERVATION_REMINDER', enabled: true }] } });
    const result = await getNotificationPreferences();
    expect(mockedApi.get).toHaveBeenCalledWith('/notifications/type-preferences');
    expect(result).toEqual([{ type: 'RESERVATION_REMINDER', enabled: true }]);
  });

  it('updateNotificationPreferences preferences’ı PUT ile gönderir', async () => {
    const prefs = [{ type: 'WEEKLY_DIGEST' as any, enabled: false }];
    mockedApi.put.mockResolvedValueOnce({ data: { updated: 1 } });
    const result = await updateNotificationPreferences(prefs);
    expect(mockedApi.put).toHaveBeenCalledWith('/notifications/type-preferences', { preferences: prefs });
    expect(result).toEqual({ updated: 1 });
  });
});
