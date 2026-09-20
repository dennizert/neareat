/**
 * #430 — photoAnalysis.ts servis sözleşmesi.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import api from '../../services/api';
import { analyzePhoto } from '../../services/photoAnalysis';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('analyzePhoto', () => {
  it('params’ı olduğu gibi POST eder ve backend yanıtını döner', async () => {
    const params = { imageUrl: 'https://x.jpg', placeId: 'p1' };
    const payload = { analysis: 'test', model: 'claude', fallback: false, remainingToday: 1, resetAt: null };
    mockedApi.post.mockResolvedValueOnce({ data: payload });

    const result = await analyzePhoto(params);

    expect(mockedApi.post).toHaveBeenCalledWith('/recommendations/analyze-photo', params);
    expect(result).toEqual(payload);
  });
});
