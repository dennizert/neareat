'use strict';

/**
 * #486 — logController.js daha önce hiç test edilmemişti. Diğer controller'lardan
 * farklı olarak "ince controller" değil: gerçek filtre/tarih-aralığı kurma
 * mantığı içeriyor. Bu endpoint admin panelinin (AdminLogsScreen) tek veri
 * kaynağı — bir güvenlik olayı incelenirken admin'in güvendiği tam olarak bu
 * sorgu. Sessiz bir mantık hatası (ör. saat dilimi kayması) olayı yanlış/eksik
 * sonuçla kapatmaya yol açabilir, hiçbir hata fırlatmadan.
 */

const mockPrisma = {
  userLog: { findMany: jest.fn(), count: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const { getLogs } = require('../../../src/controllers/logController');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.userLog.findMany.mockResolvedValue([]);
  mockPrisma.userLog.count.mockResolvedValue(0);
});

describe('getLogs — filtre kurma', () => {
  it('hiçbir filtre verilmezse where={} ile sorgu atılır, varsayılan page=1/limit=50', async () => {
    const req = { query: {} };
    const res = mockRes();
    await getLogs(req, res, jest.fn());

    const call = mockPrisma.userLog.findMany.mock.calls[0][0];
    expect(call.where).toEqual({});
    expect(call.skip).toBe(0);
    expect(call.take).toBe(50);
    expect(res.json).toHaveBeenCalledWith({ logs: [], total: 0, page: 1, limit: 50 });
  });

  it('email verilirse case-insensitive contains ile kurulur, trim edilir', async () => {
    const req = { query: { email: '  Ali@Test.com  ' } };
    await getLogs(req, mockRes(), jest.fn());

    const where = mockPrisma.userLog.findMany.mock.calls[0][0].where;
    expect(where.email).toEqual({ contains: 'Ali@Test.com', mode: 'insensitive' });
  });

  it('yalnızca startDate verilirse gte kurulur, lte kurulmaz', async () => {
    const req = { query: { startDate: '2026-06-01' } };
    await getLogs(req, mockRes(), jest.fn());

    const where = mockPrisma.userLog.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte).toEqual(new Date('2026-06-01T00:00:00.000Z'));
    expect(where.createdAt.lte).toBeUndefined();
  });

  it('yalnızca endDate verilirse lte kurulur, gte kurulmaz', async () => {
    const req = { query: { endDate: '2026-06-01' } };
    await getLogs(req, mockRes(), jest.fn());

    const where = mockPrisma.userLog.findMany.mock.calls[0][0].where;
    expect(where.createdAt.lte).toEqual(new Date('2026-06-01T23:59:59.999Z'));
    expect(where.createdAt.gte).toBeUndefined();
  });

  it('startDate+startTime verilirse gte o saatle kurulur (varsayılan 00:00 kullanılmaz)', async () => {
    const req = { query: { startDate: '2026-06-01', startTime: '14:30' } };
    await getLogs(req, mockRes(), jest.fn());

    const where = mockPrisma.userLog.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte).toEqual(new Date('2026-06-01T14:30:00.000Z'));
  });

  it('endDate+endTime verilirse lte o saatle kurulur (gün sonu varsayılanı kullanılmaz)', async () => {
    const req = { query: { endDate: '2026-06-01', endTime: '09:15' } };
    await getLogs(req, mockRes(), jest.fn());

    const where = mockPrisma.userLog.findMany.mock.calls[0][0].where;
    expect(where.createdAt.lte).toEqual(new Date('2026-06-01T09:15:59.999Z'));
  });

  it('page/limit verilirse skip doğru hesaplanır ve take geçilir', async () => {
    const req = { query: { page: '3', limit: '10' } };
    await getLogs(req, mockRes(), jest.fn());

    const call = mockPrisma.userLog.findMany.mock.calls[0][0];
    expect(call.skip).toBe(20); // (3-1)*10
    expect(call.take).toBe(10);
  });

  it('findMany ve count AYNI where ile çağrılır (sayfalama meta tutarlılığı)', async () => {
    const req = { query: { email: 'ali' } };
    await getLogs(req, mockRes(), jest.fn());

    const findManyWhere = mockPrisma.userLog.findMany.mock.calls[0][0].where;
    const countWhere = mockPrisma.userLog.count.mock.calls[0][0].where;
    expect(findManyWhere).toEqual(countWhere);
  });

  it('yanıt gövdesi logs/total/page/limit şeklinde, total ayrı count sorgusundan gelir', async () => {
    mockPrisma.userLog.findMany.mockResolvedValueOnce([{ id: 'l1' }]);
    mockPrisma.userLog.count.mockResolvedValueOnce(42);
    const res = mockRes();

    await getLogs({ query: {} }, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ logs: [{ id: 'l1' }], total: 42, page: 1, limit: 50 });
  });

  it('Prisma hata fırlatırsa next(err) ile geçer, kendi patlamaz', async () => {
    const err = new Error('db down');
    mockPrisma.userLog.findMany.mockRejectedValueOnce(err);
    const next = jest.fn();

    await getLogs({ query: {} }, mockRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
