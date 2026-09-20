/**
 * #430 — referral.ts servis sözleşmesi.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '../../services/api';
import { getMyReferralCode, applyReferralCode } from '../../services/referral';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('referral servis sözleşmesi', () => {
  it('getMyReferralCode /referral/my-code çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { code: 'ABC123', usageCount: 2, earnedStars: 10 } });
    const result = await getMyReferralCode();
    expect(mockedApi.get).toHaveBeenCalledWith('/referral/my-code');
    expect(result.code).toBe('ABC123');
  });

  it('applyReferralCode code ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { message: 'ok', earnedStars: 5, referrerName: 'Ali' } });
    await applyReferralCode('ABC123');
    expect(mockedApi.post).toHaveBeenCalledWith('/referral/apply', { code: 'ABC123' });
  });
});
