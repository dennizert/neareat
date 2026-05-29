/**
 * getRestaurantAnalytics / getWeeklyReport servis testleri (Sprint-5 Task #7).
 */

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '../../services/api';
import { getRestaurantAnalytics, getWeeklyReport } from '../../services/restaurantAccount';

const mockedGet = (api as any).get as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('getRestaurantAnalytics', () => {
  it('analytics endpointini çağırır ve veriyi döner', async () => {
    const payload = { reservations: { totalReservations: 3 }, reviews: { reviewCount: 1 } };
    mockedGet.mockResolvedValueOnce({ data: payload });

    const result = await getRestaurantAnalytics();

    expect(mockedGet).toHaveBeenCalledWith('/restaurant-account/analytics');
    expect(result).toEqual(payload);
  });
});

describe('getWeeklyReport', () => {
  it('report endpointini çağırır ve veriyi döner', async () => {
    const payload = { report: 'Özet', model: 'claude-haiku-4-5-20251001', fallback: false, generatedAt: '2026-05-29T00:00:00Z' };
    mockedGet.mockResolvedValueOnce({ data: payload });

    const result = await getWeeklyReport();

    expect(mockedGet).toHaveBeenCalledWith('/restaurant-account/report');
    expect(result.fallback).toBe(false);
  });
});
