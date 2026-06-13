'use strict';

/**
 * S16-3 — Anthropic harcama loglama. logUsage tahmini maliyeti metrik sayacına
 * yazmalı (S16-2 evaluateAlarms.aiDailyUsd bunu kullanır).
 */

jest.mock('../../../src/services/metrics', () => ({
  recordExternalCall: jest.fn(),
  // recommendationService yalnızca recordExternalCall kullanır; diğerleri gerekmez.
}));

const { recordExternalCall } = require('../../../src/services/metrics');
const { logUsage, summarizeUsage } = require('../../../src/services/recommendationService');

beforeEach(() => jest.clearAllMocks());

describe('summarizeUsage — maliyet hesabı', () => {
  it('Haiku 1M input → ~$1.00', () => {
    const s = summarizeUsage('claude-haiku-4-5-20251001', { input_tokens: 1_000_000, output_tokens: 0 });
    expect(s.estimatedCostUsd).toBeCloseTo(1.0, 5);
  });
  it('Sonnet output 1M → ~$15.00', () => {
    const s = summarizeUsage('claude-sonnet-4-6', { input_tokens: 0, output_tokens: 1_000_000 });
    expect(s.estimatedCostUsd).toBeCloseTo(15.0, 5);
  });
});

describe('logUsage — metrik harcama', () => {
  it('Anthropic harcamasını recordExternalCall ile yazar', () => {
    logUsage({ userId: 'u1', model: 'claude-haiku-4-5-20251001', usage: { input_tokens: 1000, output_tokens: 500 }, latencyMs: 10 });
    expect(recordExternalCall).toHaveBeenCalledTimes(1);
    const [provider, cost] = recordExternalCall.mock.calls[0];
    expect(provider).toBe('anthropic');
    expect(cost).toBeGreaterThan(0);
  });
});
