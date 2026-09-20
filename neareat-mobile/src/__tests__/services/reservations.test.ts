/**
 * #430 — reservations.ts servis sözleşmesi: endpoint/param/payload doğruluğu
 * ve getRestaurantReservations'ın opsiyonel filtre parametrelerini koşullu kurma
 * mantığı.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

import api from '../../services/api';
import * as reservations from '../../services/reservations';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('reservations servis sözleşmesi', () => {
  it('createReservation params’ı olduğu gibi POST eder', async () => {
    const params = { placeId: 'p1', date: '2026-06-01', time: '19:00', guestCount: 2 };
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'res1', ...params, status: 'PENDING' } });
    const result = await reservations.createReservation(params);
    expect(mockedApi.post).toHaveBeenCalledWith('/reservations', params);
    expect(result.status).toBe('PENDING');
  });

  it('getMyReservations /reservations/me çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await reservations.getMyReservations();
    expect(mockedApi.get).toHaveBeenCalledWith('/reservations/me');
  });

  it('getReservationDetail id ile path kurar', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { id: 'res1' } });
    await reservations.getReservationDetail('res1');
    expect(mockedApi.get).toHaveBeenCalledWith('/reservations/res1');
  });

  it('cancelReservation doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await reservations.cancelReservation('res1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/reservations/res1');
  });

  it('updateReservation params’ı olduğu gibi PUT eder', async () => {
    const params = { date: '2026-06-02', time: '20:00', guestCount: 3 };
    mockedApi.put.mockResolvedValueOnce({ data: { id: 'res1', ...params } });
    await reservations.updateReservation('res1', params);
    expect(mockedApi.put).toHaveBeenCalledWith('/reservations/res1', params);
  });

  it('getRestaurantReservations hiçbir filtre verilmezse boş params gönderir', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await reservations.getRestaurantReservations();
    expect(mockedApi.get).toHaveBeenCalledWith('/reservations/restaurant', { params: {} });
  });

  it('getRestaurantReservations sadece status verilirse sadece status’ü ekler', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await reservations.getRestaurantReservations('CONFIRMED');
    expect(mockedApi.get).toHaveBeenCalledWith('/reservations/restaurant', { params: { status: 'CONFIRMED' } });
  });

  it('getRestaurantReservations status+date ikisi de verilirse ikisini de ekler', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await reservations.getRestaurantReservations('CONFIRMED', '2026-06-01');
    expect(mockedApi.get).toHaveBeenCalledWith('/reservations/restaurant', { params: { status: 'CONFIRMED', date: '2026-06-01' } });
  });

  it('updateReservationStatus status/rejectionReason/reservedSeats gönderir', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: { id: 'res1', status: 'REJECTED' } });
    await reservations.updateReservationStatus('res1', 'REJECTED', 'dolu', undefined);
    expect(mockedApi.put).toHaveBeenCalledWith('/reservations/res1/status', { status: 'REJECTED', rejectionReason: 'dolu', reservedSeats: undefined });
  });

  it('getOccupancy date param’ı ile çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { date: '2026-06-01', seatCapacity: 40, slots: [] } });
    await reservations.getOccupancy('2026-06-01');
    expect(mockedApi.get).toHaveBeenCalledWith('/restaurant-account/occupancy', { params: { date: '2026-06-01' } });
  });

  it('getAvailability tüm parametreleri gönderir', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { known: true, band: 'medium', enough: true } });
    await reservations.getAvailability('p1', '2026-06-01', '19:00', 4);
    expect(mockedApi.get).toHaveBeenCalledWith('/reservations/availability', { params: { placeId: 'p1', date: '2026-06-01', time: '19:00', guestCount: 4 } });
  });

  it('markAttendance attended alanını gönderir', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: { id: 'res1' } });
    await reservations.markAttendance('res1', true);
    expect(mockedApi.put).toHaveBeenCalledWith('/reservations/res1/attendance', { attended: true });
  });

  it('sendReservationMessage content ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'm1', content: 'merhaba' } });
    await reservations.sendReservationMessage('res1', 'merhaba');
    expect(mockedApi.post).toHaveBeenCalledWith('/reservations/res1/messages', { content: 'merhaba' });
  });

  it('getReservationMessages doğru path ile çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await reservations.getReservationMessages('res1');
    expect(mockedApi.get).toHaveBeenCalledWith('/reservations/res1/messages');
  });
});
