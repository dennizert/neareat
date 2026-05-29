'use strict';

/**
 * Sprint-5 Task #6 — businessReport (Claude haftalık rapor) unit testleri.
 * Anthropic SDK mock'lu; başarı + boş yanıt + hata fallback.
 */

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
);

const { generateWeeklyReport, fallbackReport, REPORT_MODEL } = require('../../../src/services/businessReport');

const analytics = {
  reservations: {
    totalReservations: 12,
    busiestHours: [{ hour: '19', count: 5 }],
    statusBreakdown: { PENDING: 1, CONFIRMED: 8, REJECTED: 0, CANCELLED: 2, COMPLETED: 1 },
    attendanceRate: 0.8,
    trend: [],
  },
  reviews: { reviewCount: 4, avgRating: 4.5, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 2 } },
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
});

describe('generateWeeklyReport', () => {
  it('başarılı Claude yanıtında metni döner (fallback: false)', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Bu hafta 12 rezervasyon ve 4 yorum aldınız.' }],
    });

    const result = await generateWeeklyReport(analytics, [{ rating: 5, body: 'Harika' }]);

    expect(result.fallback).toBe(false);
    expect(result.model).toBe(REPORT_MODEL);
    expect(result.report).toContain('12 rezervasyon');
    // Doğru model + system prompt ile çağrıldı
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.model).toBe(REPORT_MODEL);
    expect(typeof arg.system).toBe('string');
  });

  it('Anthropic hatasında fallback şablona düşer (throw etmez)', async () => {
    mockCreate.mockRejectedValue(new Error('overloaded'));

    const result = await generateWeeklyReport(analytics, []);

    expect(result.fallback).toBe(true);
    expect(result.model).toBeNull();
    expect(result.report).toContain('12 rezervasyon');
  });

  it('boş metin yanıtında fallback döner', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '   ' }] });

    const result = await generateWeeklyReport(analytics, []);

    expect(result.fallback).toBe(true);
  });

  it('yorum snippetlerini kırpar ve max 8 ile sınırlar', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    const manyReviews = Array.from({ length: 12 }, (_, i) => ({ rating: 4, body: 'x'.repeat(500) + i }));

    await generateWeeklyReport(analytics, manyReviews);

    const userContent = mockCreate.mock.calls[0][0].messages[0].content;
    const parsed = JSON.parse(userContent.match(/```json\n([\s\S]*)\n```/)[1]);
    expect(parsed.recentReviews).toHaveLength(8);
    expect(parsed.recentReviews[0].body.length).toBeLessThanOrEqual(200);
  });
});

describe('fallbackReport', () => {
  it('analitikten deterministik özet kurar', () => {
    const text = fallbackReport(analytics);
    expect(text).toContain('12 rezervasyon');
    expect(text).toContain('19:00');
    expect(text).toContain('4 yorum');
  });

  it('boş analitikte çökmeden özet döner', () => {
    expect(typeof fallbackReport({})).toBe('string');
    expect(typeof fallbackReport(null)).toBe('string');
  });
});
