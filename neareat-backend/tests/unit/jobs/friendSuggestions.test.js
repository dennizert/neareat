'use strict';

/**
 * #429 — runFriendSuggestionsJob daha önce hiç test edilmemişti. Bu dosya
 * `computeAllSuggestions`'ı mock'layarak yalnızca job wrapper'ın sözleşmesini
 * (dönüş şekli, hata yutma) test eder; `computeAllSuggestions`'ın kendi mantığı
 * zaten tests/unit/services/friendSuggestionsJob.test.js içinde kapsanıyor.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const mockComputeAllSuggestions = jest.fn();
jest.mock('../../../src/services/friendSuggestionService', () => ({
  computeAllSuggestions: (...a) => mockComputeAllSuggestions(...a),
}));
jest.mock('../../../src/services/cronLock', () => ({ withCronLock: jest.fn() }));

const { runFriendSuggestionsJob } = require('../../../src/jobs/friendSuggestions');

beforeEach(() => jest.clearAllMocks());

describe('runFriendSuggestionsJob', () => {
  it('computeAllSuggestions sonucunu olduğu gibi döner', async () => {
    mockComputeAllSuggestions.mockResolvedValue({ processed: 10, stored: 4 });

    const result = await runFriendSuggestionsJob();

    expect(result).toEqual({ processed: 10, stored: 4 });
  });

  it('hata durumunda throw etmez, sıfırlanmış sonuç + error mesajı döner', async () => {
    mockComputeAllSuggestions.mockRejectedValue(new Error('db down'));

    const result = await runFriendSuggestionsJob();

    expect(result).toEqual({ processed: 0, stored: 0, error: 'db down' });
  });
});
