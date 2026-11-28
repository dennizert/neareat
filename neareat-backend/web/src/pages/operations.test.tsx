// #529: genel bakış, rezervasyonlar, doluluk, bildirimler — ekran testleri.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axiosError, renderRoute, signIn } from '../test/render';
import type { Reservation } from '../types';

vi.mock('../services/reservations', () => ({
  getRestaurantReservations: vi.fn(),
  updateReservationStatus: vi.fn(),
  markAttendance: vi.fn(),
  getOccupancy: vi.fn(),
  getReservationDetail: vi.fn(),
  getReservationMessages: vi.fn(),
  sendReservationMessage: vi.fn(),
}));
vi.mock('../services/notifications', () => ({ getNotifications: vi.fn(), markAsRead: vi.fn(), markAllAsRead: vi.fn(), getUnreadCount: vi.fn() }));
vi.mock('../services/restaurantAccount', () => ({ getRestaurantStats: vi.fn() }));
vi.mock('../services/subscriptions', () => ({ getSubscription: vi.fn() }));

import * as svc from '../services/reservations';
import * as notif from '../services/notifications';
import * as ra from '../services/restaurantAccount';
import * as subs from '../services/subscriptions';
import ReservationsPage from './ReservationsPage';
import ReservationDetailPage from './ReservationDetailPage';
import OccupancyPage from './OccupancyPage';
import NotificationsPage, { notificationTarget } from './NotificationsPage';
import OverviewPage, { subscriptionBanner } from './OverviewPage';

const r = (p: Partial<Reservation>): Reservation => ({
  id: 'r1', userId: 'u', restaurantId: 'x', placeId: 'p', placeName: 'P', date: '2026-11-28', time: '19:00', guestCount: 4,
  occasion: null, specialRequests: null, status: 'PENDING', rejectionReason: null, attended: null, createdAt: '', updatedAt: '',
  user: { id: 'u', displayName: 'Zeynep Arslan', photoUrl: null }, ...p,
});

const pending = [r({ id: 'p1', isPriority: true, reservationPriority: 2, user: { id: 'a', displayName: 'Zeynep Arslan', photoUrl: null } }), r({ id: 'p2', user: { id: 'b', displayName: 'Burak Çelik', photoUrl: null } })];
const confirmed = r({ id: 'c1', status: 'CONFIRMED', reservedSeats: 4, user: { id: 'c', displayName: 'Mehmet Kaya', photoUrl: null } });

beforeEach(() => {
  vi.clearAllMocks();
  signIn();
  vi.mocked(svc.getRestaurantReservations).mockImplementation(async (status?: string) => (status === 'PENDING' ? pending : [...pending, confirmed]));
  vi.mocked(svc.getOccupancy).mockResolvedValue({ date: '2026-11-28', seatCapacity: 80, slots: [{ time: '19:00', reserved: 78, free: 2, percent: 98, band: 'limited' }] });
});

function rowOf(name: string) {
  return screen.getByText(name).closest('tr') as HTMLElement;
}

describe('Rezervasyonlar', () => {
  it('sekme sayıları, bekleyen sırası ve öncelik rozeti', async () => {
    renderRoute(<ReservationsPage />, { path: '/rezervasyonlar', initial: '/rezervasyonlar' });
    await screen.findByText('Zeynep Arslan');
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveTextContent('Bekleyen2');
    expect(tabs[1]).toHaveTextContent('Onaylı1');
    const names = screen.getAllByRole('row').slice(1).map((tr) => within(tr).getAllByRole('cell')[0].querySelector('.cell-title')?.textContent);
    expect(names).toEqual(['Zeynep Arslan', 'Burak Çelik']);
    expect(within(rowOf('Zeynep Arslan')).getByText('Öncelikli kullanıcı')).toBeInTheDocument();
  });

  it('onay: varsayılan kişi sayısı, aralık dışı gönderilmez, kapasite uyarısı, başarıda sekme değişir', async () => {
    vi.mocked(svc.updateReservationStatus).mockResolvedValue({ ...pending[0], status: 'CONFIRMED', reservedSeats: 4 });
    renderRoute(<ReservationsPage />, { path: '/rezervasyonlar', initial: '/rezervasyonlar' });
    await screen.findByText('Zeynep Arslan');
    fireEvent.click(within(rowOf('Zeynep Arslan')).getByRole('button', { name: 'Onayla' }));
    const seats = await screen.findByLabelText('Rezerve koltuk');
    expect(seats).toHaveValue(4);
    expect(await screen.findByText(/78\/80 koltuk dolu/)).toBeInTheDocument();
    fireEvent.change(seats, { target: { value: '6000' } });
    const dialog = seats.closest('dialog') as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Onayla' }));
    expect(within(dialog).getByText('Rezerve koltuk 1-5000 arasında olmalıdır.')).toBeInTheDocument();
    expect(svc.updateReservationStatus).not.toHaveBeenCalled();
    fireEvent.change(seats, { target: { value: '4' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Onayla' }));
    await waitFor(() => expect(svc.updateReservationStatus).toHaveBeenCalledWith('p1', 'CONFIRMED', undefined, 4));
    await waitFor(() => expect(screen.getAllByRole('tab')[0]).toHaveTextContent('Bekleyen1'));
    expect(screen.getAllByRole('tab')[1]).toHaveTextContent('Onaylı2');
  });

  it('red: neden boşsa gönderilmez', async () => {
    renderRoute(<ReservationsPage />, { path: '/rezervasyonlar', initial: '/rezervasyonlar' });
    await screen.findByText('Burak Çelik');
    fireEvent.click(within(rowOf('Burak Çelik')).getByRole('button', { name: 'Reddet' }));
    const reason = await screen.findByLabelText('Red nedeni');
    const dialog = reason.closest('dialog') as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reddet' }));
    expect(within(dialog).getByText('Red nedeni girilmesi zorunludur.')).toBeInTheDocument();
    expect(svc.updateReservationStatus).not.toHaveBeenCalled();
    vi.mocked(svc.updateReservationStatus).mockResolvedValue({ ...pending[1], status: 'REJECTED', rejectionReason: 'Dolu' });
    fireEvent.change(reason, { target: { value: 'Dolu' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reddet' }));
    await waitFor(() => expect(svc.updateReservationStatus).toHaveBeenCalledWith('p2', 'REJECTED', 'Dolu'));
  });

  it('yarış: "Yalnızca bekleyen…" → liste yenilenir', async () => {
    vi.mocked(svc.updateReservationStatus).mockRejectedValue(axiosError(400, { error: 'Yalnızca bekleyen rezervasyonlar güncellenebilir.' }));
    renderRoute(<ReservationsPage />, { path: '/rezervasyonlar', initial: '/rezervasyonlar' });
    await screen.findByText('Zeynep Arslan');
    expect(svc.getRestaurantReservations).toHaveBeenCalledTimes(2);
    fireEvent.click(within(rowOf('Zeynep Arslan')).getByRole('button', { name: 'Onayla' }));
    const dialog = (await screen.findByLabelText('Rezerve koltuk')).closest('dialog') as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Onayla' }));
    await waitFor(() => expect(svc.getRestaurantReservations).toHaveBeenCalledTimes(4));
  });

  it('SUBSCRIPTION_REQUIRED → onay düğmeleri kilitlenir', async () => {
    vi.mocked(svc.updateReservationStatus).mockRejectedValue(axiosError(403, { error: 'Rezervasyon yanıtlamak için aktif aboneliğiniz olmalı.', code: 'SUBSCRIPTION_REQUIRED' }));
    renderRoute(<ReservationsPage />, { path: '/rezervasyonlar', initial: '/rezervasyonlar' });
    await screen.findByText('Zeynep Arslan');
    fireEvent.click(within(rowOf('Zeynep Arslan')).getByRole('button', { name: 'Onayla' }));
    const dialog = (await screen.findByLabelText('Rezerve koltuk')).closest('dialog') as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Onayla' }));
    expect(await screen.findByText('Aboneliğiniz aktif değil.')).toBeInTheDocument();
    expect(within(rowOf('Burak Çelik')).getByRole('button', { name: 'Onayla' })).toBeDisabled();
  });

  it('katılım: yalnızca onaylıda, onay penceresiyle', async () => {
    vi.mocked(svc.markAttendance).mockResolvedValue({ ...confirmed, status: 'COMPLETED', attended: true });
    renderRoute(<ReservationsPage />, { path: '/rezervasyonlar', initial: '/rezervasyonlar?durum=CONFIRMED' });
    await screen.findByText('Mehmet Kaya');
    fireEvent.click(within(rowOf('Mehmet Kaya')).getByRole('button', { name: 'Geldi' }));
    expect(await screen.findByText('Müşteri geldi olarak işaretlensin mi?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Evet, işaretle' }));
    await waitFor(() => expect(svc.markAttendance).toHaveBeenCalledWith('c1', true));
  });
});

describe('Rezervasyon detayı', () => {
  it('ayrıntılar ve mesaj gönderme (boş gönderilmez)', async () => {
    vi.mocked(svc.getReservationDetail).mockResolvedValue(confirmed);
    vi.mocked(svc.getReservationMessages).mockResolvedValue([{ id: 'm1', reservationId: 'c1', senderId: 'u', senderRole: 'USER', content: 'Cam kenarı?', createdAt: '2026-11-27T10:00:00Z' }]);
    vi.mocked(svc.sendReservationMessage).mockResolvedValue({ id: 'm2', reservationId: 'c1', senderId: 'x', senderRole: 'RESTAURANT', content: 'Tabii', createdAt: '2026-11-27T11:00:00Z' });
    renderRoute(<ReservationDetailPage />, { path: '/rezervasyonlar/:id', initial: '/rezervasyonlar/c1' });
    expect(await screen.findByText('Cam kenarı?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gönder' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Mesaj yaz'), { target: { value: 'Tabii' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gönder' }));
    expect(await screen.findByText('Tabii')).toBeInTheDocument();
    expect(svc.sendReservationMessage).toHaveBeenCalledWith('c1', 'Tabii');
  });
});

describe('Doluluk', () => {
  it('saat satırları bant etiketi ve erişilebilir bar', async () => {
    vi.mocked(svc.getOccupancy).mockResolvedValue({ date: '2026-11-28', seatCapacity: 80, slots: [
      { time: '19:00', reserved: 20, free: 60, percent: 25, band: 'available' },
      { time: '20:00', reserved: 60, free: 20, percent: 75, band: 'limited' },
      { time: '21:00', reserved: 80, free: 0, percent: 100, band: 'full' },
    ] });
    renderRoute(<OccupancyPage />, { path: '/doluluk', initial: '/doluluk?tarih=2026-11-28' });
    expect(await screen.findByRole('img', { name: '20:00: 60/80 koltuk, yüzde 75, Az yer kaldı' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '21:00: 80/80 koltuk, yüzde 100, Dolu' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki gün' }));
    await waitFor(() => expect(svc.getOccupancy).toHaveBeenLastCalledWith('2026-11-29'));
  });
  it('kapasite yoksa yönlendirme', async () => {
    vi.mocked(svc.getOccupancy).mockResolvedValue({ date: '2026-11-28', seatCapacity: null, slots: [] });
    renderRoute(<OccupancyPage />, { path: '/doluluk', initial: '/doluluk' });
    expect(await screen.findByText('Koltuk kapasitesi girin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kapasite gir' })).toHaveAttribute('href', '/bilgiler');
  });
  it('abonelik gerekli', async () => {
    vi.mocked(svc.getOccupancy).mockRejectedValue(axiosError(403, { code: 'SUBSCRIPTION_REQUIRED', error: 'x' }));
    renderRoute(<OccupancyPage />, { path: '/doluluk', initial: '/doluluk' });
    expect(await screen.findByText('Abonelik gerekli')).toBeInTheDocument();
  });
});

describe('Bildirimler', () => {
  it('rezervasyon bildirimi detaya gider ve okundu işaretlenir', async () => {
    vi.mocked(notif.getNotifications).mockResolvedValue({ notifications: [
      { id: 'n1', type: 'RESERVATION_REQUEST', title: 'Yeni rezervasyon talebi', body: 'Zeynep 2 kişi', data: { reservationId: 'r9' }, isRead: false, createdAt: '2026-11-28T10:00:00Z' },
    ], total: 1, hasMore: false });
    vi.mocked(notif.markAsRead).mockResolvedValue();
    renderRoute(<NotificationsPage />, { path: '/bildirimler', initial: '/bildirimler' });
    fireEvent.click(await screen.findByRole('button', { name: 'Yeni rezervasyon talebi' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/rezervasyonlar/r9'));
    expect(notif.markAsRead).toHaveBeenCalledWith('n1');
  });
  it('hedef eşlemesi', () => {
    expect(notificationTarget({ type: 'RESERVATION_MESSAGE', data: { reservationId: 'x' } })).toBe('/rezervasyonlar/x');
    expect(notificationTarget({ type: 'LEVEL_UP', data: null })).toBeNull();
  });
});

describe('Genel bakış', () => {
  it('istatistikler ve bekleyen sayısı; trial sayacı (ödeme düğmesi yok)', async () => {
    vi.mocked(ra.getRestaurantStats).mockResolvedValue({ favorites: 12, reviews: 128, avgRating: '4.6', recommendations: 3 });
    vi.mocked(subs.getSubscription).mockResolvedValue({ id: 's', userId: 'u', status: 'trial', expiresAt: new Date(Date.now() + 2.5 * 86400000).toISOString() });
    renderRoute(<OverviewPage />);
    expect(await screen.findByText('Ücretsiz denemenizin bitmesine 3 gün kaldı.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bekleyen talepler \(2\)/ })).toHaveAttribute('href', '/rezervasyonlar?durum=PENDING');
    expect(screen.getByText('4,6')).toBeInTheDocument();
    expect(screen.queryByText(/Abone ol/)).toBeNull();
  });
  it('abonelik banner kararı', () => {
    const now = new Date('2026-11-28T00:00:00Z');
    expect(subscriptionBanner(null, now)).toEqual({ kind: 'inactive' });
    expect(subscriptionBanner({ id: '', userId: '', status: 'active', expiresAt: '2026-12-28T00:00:00Z' }, now)).toBeNull();
    expect(subscriptionBanner({ id: '', userId: '', status: 'trial', expiresAt: '2026-11-27T00:00:00Z' }, now)).toEqual({ kind: 'inactive' });
  });
});
