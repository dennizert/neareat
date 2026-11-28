// #528 başvuru, #530 işletme, #532 büyüme — ekran testleri.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { axiosError, renderRoute, signIn, signOut } from '../test/render';
import type { RestaurantProfile } from '../types';

vi.mock('../services/restaurantAccount', async (orig) => {
  const real = await orig<typeof import('../services/restaurantAccount')>();
  return {
    ...real,
    registerRestaurant: vi.fn(), getMyRestaurantProfile: vi.fn(), updateInfo: vi.fn(), updateHours: vi.fn(),
    uploadMenuItem: vi.fn(), deleteMenuItem: vi.fn(), listRestaurantPhotos: vi.fn(), getPhotoUploadUrl: vi.fn(),
    uploadPhotoToS3: vi.fn(), addRestaurantPhoto: vi.fn(), deleteRestaurantPhoto: vi.fn(),
    getMyRestaurantReviews: vi.fn(), replyToReview: vi.fn(), deleteReply: vi.fn(),
    updateDiscount: vi.fn(), activateInstantDiscount: vi.fn(), deactivateInstantDiscount: vi.fn(),
    sendCampaign: vi.fn(), getRestaurantAnalytics: vi.fn(), getWeeklyReport: vi.fn(),
  };
});
vi.mock('../services/places', () => ({ fetchNearby: vi.fn(), searchPlaces: vi.fn() }));
vi.mock('../store/sessionStore', async (orig) => {
  const real = await orig<typeof import('../store/sessionStore')>();
  return real;
});

import * as ra from '../services/restaurantAccount';
import * as places from '../services/places';
import { useSessionStore } from '../store/sessionStore';
import RegisterPage from './RegisterPage';
import InfoPage from './InfoPage';
import HoursPage from './HoursPage';
import MenuPage from './MenuPage';
import PhotosPage, { uploadGalleryPhoto } from './PhotosPage';
import ReviewsPage from './ReviewsPage';
import DiscountPage from './DiscountPage';
import CampaignPage from './CampaignPage';
import AnalyticsPage from './AnalyticsPage';

const profile = (p: Partial<RestaurantProfile> = {}) => ({
  id: 'rp', userId: 'u', businessName: 'Kebapçı', displayName: null, ownerName: 'A', taxNumber: '1234567890', taxOffice: 'K', phone: '0532',
  altPhone: null, contactEmail: 'i@k.co', address: 'Adr', businessCategory: 'Restoran', placeId: 'p', placeName: 'K', placeAddress: null,
  placePhotoUrl: null, status: 'APPROVED', rejectionReason: null, approvedAt: null, reservationUrl: null, announcement: null,
  announcementActive: false, acceptsReservations: true, tableCount: 10, seatCapacity: 80, openingHours: null, discountEnabled: false,
  discountPercent: null, discountMinStars: null, discountNote: null, discountActiveUntil: null, createdAt: '', updatedAt: '', menuItems: [], ...p,
}) as RestaurantProfile;

const file = (name: string, type: string, size: number) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  signIn();
});

// ─── #528 ─────────────────────────────────────────────────────────────────────
describe('Restoran başvurusu', () => {
  beforeEach(() => signOut());

  function fillStep1() {
    fireEvent.change(screen.getByLabelText('Ad Soyad'), { target: { value: 'Ayşe Yılmaz' } });
    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'ayse@kebapci.com' } });
    fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: 'guclusifre1' } });
    fireEvent.click(screen.getByRole('button', { name: /Devam et/ }));
  }
  function fillStep2() {
    fireEvent.change(screen.getByLabelText('İşletme adı'), { target: { value: 'Kebapçı Dürüm Evi' } });
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'Restoran' } });
    fireEvent.change(screen.getByLabelText('Vergi numarası'), { target: { value: '12345abc67890' } });
    fireEvent.change(screen.getByLabelText('Vergi dairesi'), { target: { value: 'Kadıköy' } });
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '05320000000' } });
    fireEvent.change(screen.getByLabelText('İletişim e-postası'), { target: { value: 'iletisim@kebapci.com' } });
    fireEvent.change(screen.getByLabelText('İşletme adresi'), { target: { value: 'Moda Cd. 112' } });
    fireEvent.click(screen.getByRole('button', { name: /Devam et/ }));
  }

  it('adım doğrulaması: zorunlu alanlar olmadan ilerlemez; vergi no yalnız 10 rakam', () => {
    renderRoute(<RegisterPage />, { path: '/kayit', initial: '/kayit' });
    fireEvent.click(screen.getByRole('button', { name: /Devam et/ }));
    expect(screen.getByText('Adım 1/5 · Hesap')).toBeInTheDocument();
    expect(screen.getByLabelText('Ad Soyad')).toHaveAttribute('aria-invalid', 'true');
    fillStep1();
    expect(screen.getByText('Adım 2/5 · İşletme')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Vergi numarası'), { target: { value: '12a3' } });
    expect(screen.getByLabelText('Vergi numarası')).toHaveValue('123');
    fireEvent.click(screen.getByRole('button', { name: /Devam et/ }));
    expect(screen.getByText('Vergi numarası 10 haneli olmalı.')).toBeInTheDocument();
    // geri gidince veriler kaybolmaz
    fireEvent.click(screen.getByRole('button', { name: /Geri/ }));
    expect(screen.getByLabelText('Ad Soyad')).toHaveValue('Ayşe Yılmaz');
  });

  it('levha: PDF ve büyük dosya istemcide reddedilir', async () => {
    renderRoute(<RegisterPage />, { path: '/kayit', initial: '/kayit' });
    fillStep1(); fillStep2();
    const input = document.getElementById('levha') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file('levha.pdf', 'application/pdf', 1000)] } });
    expect(await screen.findByText('Bu dosya türü desteklenmiyor. JPG veya PNG yükleyin.')).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [file('levha.png', 'image/png', 4 * 1024 * 1024)] } });
    expect(await screen.findByText('Dosya en fazla 3,5 MB olabilir.')).toBeInTheDocument();
  });

  it('409 e-posta → adım 1, alan hatası, veriler korunur; başarı → oturum + inceleniyor', async () => {
    vi.mocked(places.fetchNearby).mockResolvedValue({ results: [] });
    vi.mocked(ra.registerRestaurant).mockRejectedValueOnce(axiosError(409, { error: 'Bu e-posta zaten kayıtlı' }));
    const loginEmail = vi.fn().mockResolvedValue(undefined);
    useSessionStore.setState({ loginEmail });
    renderRoute(<RegisterPage />, { path: '/kayit', initial: '/kayit' });
    fillStep1(); fillStep2();
    fireEvent.click(screen.getByRole('button', { name: /Devam et/ })); // levha (isteğe bağlı)
    fireEvent.click(screen.getByRole('button', { name: 'Listede yok, atla' }));
    expect(screen.getByText('Adım 5/5 · Özet')).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Başvuruyu gönder' });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(send);
    expect(await screen.findByText('Bu e-posta zaten kayıtlı')).toBeInTheDocument();
    expect(screen.getByText('Adım 1/5 · Hesap')).toBeInTheDocument();
    expect(screen.getByLabelText('E-posta')).toHaveValue('ayse@kebapci.com');

    vi.mocked(ra.registerRestaurant).mockResolvedValueOnce({ token: 't', user: { id: 'u', email: 'x', role: 'RESTAURANT', displayName: 'A' }, restaurantProfile: profile({ status: 'PENDING' }) });
    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'yeni@kebapci.com' } });
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /Devam et/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Listede yok, atla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Başvuruyu gönder' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/basvuru-durumu'));
    expect(ra.registerRestaurant).toHaveBeenLastCalledWith(expect.objectContaining({ email: 'yeni@kebapci.com', taxNumber: '1234567890', businessCategory: 'Restoran' }));
    expect(loginEmail).toHaveBeenCalledWith('yeni@kebapci.com', 'guclusifre1');
  });
});

// ─── #530 ─────────────────────────────────────────────────────────────────────
describe('Bilgiler', () => {
  it('doğrulama hataları alan altında, aralık dışı gönderilmez', async () => {
    vi.mocked(ra.getMyRestaurantProfile).mockResolvedValue(profile());
    renderRoute(<InfoPage />, { path: '/bilgiler', initial: '/bilgiler' });
    fireEvent.change(await screen.findByLabelText(/Koltuk kapasitesi/), { target: { value: '6000' } });
    fireEvent.change(screen.getByLabelText(/Masa kapasitesi/), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Görünen ad/), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(screen.getByText('Koltuk kapasitesi 1-5000 arasında olmalıdır.')).toBeInTheDocument();
    expect(screen.getByText('Masa kapasitesi 1-500 arasında olmalıdır.')).toBeInTheDocument();
    expect(screen.getByText('Görünen ad 2-80 karakter arasında olmalıdır.')).toBeInTheDocument();
    expect(ra.updateInfo).not.toHaveBeenCalled();
  });
  it('başarılı kaydetme ve içerik filtresi mesajı alan altında', async () => {
    vi.mocked(ra.getMyRestaurantProfile).mockResolvedValue(profile());
    vi.mocked(ra.updateInfo).mockRejectedValueOnce(axiosError(400, { error: 'Görünen ad uygunsuz içerik (hakaret, argo veya küfür) içeremez.' }));
    renderRoute(<InfoPage />, { path: '/bilgiler', initial: '/bilgiler' });
    fireEvent.change(await screen.findByLabelText(/Görünen ad/), { target: { value: 'Kötü ad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Görünen ad uygunsuz içerik (hakaret, argo veya küfür) içeremez.')).toBeInTheDocument();
    vi.mocked(ra.updateInfo).mockResolvedValueOnce(profile({ displayName: 'Dürüm Evi', seatCapacity: 120 }));
    fireEvent.change(screen.getByLabelText(/Görünen ad/), { target: { value: 'Dürüm Evi' } });
    fireEvent.change(screen.getByLabelText(/Koltuk kapasitesi/), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(ra.updateInfo).toHaveBeenLastCalledWith(expect.objectContaining({ displayName: 'Dürüm Evi', seatCapacity: 120, tableCount: 10 })));
  });
});

describe('Saatler', () => {
  it('mobilin kaydettiği saatler aynen görünür ve aynı biçimde kaydedilir', async () => {
    const saved = { monday: { open: '18:00', close: '02:00', closed: false }, sunday: { open: '09:00', close: '22:00', closed: true } };
    vi.mocked(ra.getMyRestaurantProfile).mockResolvedValue(profile({ openingHours: saved }));
    vi.mocked(ra.updateHours).mockImplementation(async (h) => profile({ openingHours: h }));
    renderRoute(<HoursPage />, { path: '/saatler', initial: '/saatler' });
    expect(await screen.findByLabelText('Pazartesi kapanış')).toHaveValue('02:00');
    expect(screen.getByText('Ertesi gün kapanır')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pazar açılış')).toBeNull();
    fireEvent.change(screen.getByLabelText('Salı açılış'), { target: { value: '10:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(ra.updateHours).toHaveBeenCalled());
    const sent = vi.mocked(ra.updateHours).mock.calls[0][0];
    expect(sent.monday).toEqual({ open: '18:00', close: '02:00', closed: false });
    expect(sent.tuesday).toEqual({ open: '10:30', close: '22:00', closed: false });
    expect(sent.sunday.closed).toBe(true);
    expect(Object.keys(sent)).toHaveLength(7);
  });
});

describe('Menü', () => {
  it('izin verilmeyen tür ve 3 MB üstü reddedilir; 10 öğede yükleme kapalı', async () => {
    vi.mocked(ra.getMyRestaurantProfile).mockResolvedValue(profile({ menuItems: [] }));
    renderRoute(<MenuPage />, { path: '/menu', initial: '/menu' });
    await screen.findByText('Menü yüklenmemiş');
    const input = document.getElementById('menu-file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file('a.gif', 'image/gif', 10)] } });
    expect(await screen.findByText('Desteklenmeyen dosya türü')).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [file('a.pdf', 'application/pdf', 3 * 1024 * 1024 + 1)] } });
    expect(await screen.findByText('Menü dosyası en fazla 3 MB olabilir.')).toBeInTheDocument();
    expect(ra.uploadMenuItem).not.toHaveBeenCalled();
  });
  it('10 öğe sınırı', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, mimeType: 'image/png', fileName: `m${i}.png`, sortOrder: i, uploadedAt: '2026-11-01' }));
    vi.mocked(ra.getMyRestaurantProfile).mockResolvedValue(profile({ menuItems: items }));
    renderRoute(<MenuPage />, { path: '/menu', initial: '/menu' });
    expect(await screen.findByText('En fazla 10 menü öğesi yükleyebilirsiniz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menü öğesi yükle' })).toBeDisabled();
  });
});

describe('Fotoğraflar', () => {
  it('depo CORS kuralı uygulanmadan "yakında" durumu; listeleme çalışır', async () => {
    vi.mocked(ra.listRestaurantPhotos).mockResolvedValue([{ id: 'f1', kind: 'RESTAURANT', url: 'https://x/1.jpg', sortOrder: 0, createdAt: '' }]);
    renderRoute(<PhotosPage />, { path: '/fotograflar', initial: '/fotograflar' });
    expect(await screen.findByText('Fotoğraf yükleme yakında aktifleşecek.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Restoran fotoğrafları 1' })).toBeInTheDocument();
    screen.getAllByRole('button', { name: 'Fotoğraf ekle' }).forEach((b) => expect(b).toBeDisabled());
  });
  it('depo yüklemesi reddedilirse kayıt oluşturulmaz', async () => {
    vi.mocked(ra.getPhotoUploadUrl).mockResolvedValue({ uploadUrl: 'https://s3/put', key: 'k', publicUrl: 'https://s3/k', expiresIn: 60 });
    vi.mocked(ra.uploadPhotoToS3).mockRejectedValue(new ra.PhotoUploadRejectedError('Fotoğraf depoya yüklenemedi (403).'));
    await expect(uploadGalleryPhoto('PRODUCT', file('a.jpg', 'image/jpeg', 100))).rejects.toThrow('403');
    expect(ra.addRestaurantPhoto).not.toHaveBeenCalled();
  });
});

// ─── #532 ─────────────────────────────────────────────────────────────────────
describe('Yorumlar', () => {
  it('boş yanıt gönderilmez, sayaç, içerik filtresi mesajı birebir', async () => {
    vi.mocked(ra.getMyRestaurantReviews).mockResolvedValue([{ id: 'v1', userId: 'u', placeId: 'p', rating: 4, body: 'Güzel', createdAt: '2026-11-20', user: { displayName: 'Elif', photoUrl: null }, reply: null }]);
    vi.mocked(ra.replyToReview).mockRejectedValue(axiosError(400, { error: 'Cevabınız uygunsuz içerik (hakaret, argo veya küfür) içerdiği için gönderilemedi. Lütfen saygılı bir dil kullanın.' }));
    renderRoute(<ReviewsPage />, { path: '/yorumlar', initial: '/yorumlar' });
    fireEvent.click(await screen.findByRole('button', { name: 'Yanıtla' }));
    const ta = screen.getByLabelText('Yanıtınız');
    expect(ta).toHaveAttribute('maxLength', '500');
    expect(screen.getAllByRole('button', { name: 'Yanıtla' })[0]).toBeDisabled();
    fireEvent.change(ta, { target: { value: 'kötü söz' } });
    expect(screen.getByText('8/500')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Yanıtla' })[0]);
    expect(await screen.findByText(/uygunsuz içerik \(hakaret, argo veya küfür\) içerdiği için/)).toBeInTheDocument();
  });
  it('yorum yoksa boş durum', async () => {
    vi.mocked(ra.getMyRestaurantReviews).mockResolvedValue([]);
    renderRoute(<ReviewsPage />, { path: '/yorumlar', initial: '/yorumlar' });
    expect(await screen.findByText('Henüz yorum yok')).toBeInTheDocument();
  });
});

describe('İndirim', () => {
  it('aralık dışı oran gönderilmez; aktif indirimde bitiş görünür', async () => {
    vi.mocked(ra.getMyRestaurantProfile).mockResolvedValue(profile());
    renderRoute(<DiscountPage />, { path: '/indirim', initial: '/indirim' });
    fireEvent.change(await screen.findByLabelText('İndirim oranı (%)'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'İndirimi başlat' }));
    expect(screen.getByText('İndirim oranı %1-%80 arasında olmalı')).toBeInTheDocument();
    expect(ra.activateInstantDiscount).not.toHaveBeenCalled();
    vi.mocked(ra.activateInstantDiscount).mockResolvedValue(profile({ discountPercent: 20, discountActiveUntil: '2099-01-01T12:00:00Z' }));
    fireEvent.change(screen.getByLabelText('İndirim oranı (%)'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'İndirimi başlat' }));
    expect(await screen.findByText('%20 indirim aktif')).toBeInTheDocument();
    expect(ra.activateInstantDiscount).toHaveBeenCalledWith(60, 20, undefined);
  });
  it('SUBSCRIPTION_REQUIRED kilit', async () => {
    vi.mocked(ra.getMyRestaurantProfile).mockResolvedValue(profile());
    vi.mocked(ra.activateInstantDiscount).mockRejectedValue(axiosError(403, { error: 'Anlık indirim tanımlamak Premium üyelik gerektirir.', code: 'SUBSCRIPTION_REQUIRED' }));
    renderRoute(<DiscountPage />, { path: '/indirim', initial: '/indirim' });
    fireEvent.change(await screen.findByLabelText('İndirim oranı (%)'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'İndirimi başlat' }));
    expect(await screen.findByText('Abonelik gerekli')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'İndirimi başlat' })).toBeDisabled();
  });
});

describe('Kampanya', () => {
  it('kısa mesaj gönderilmez; 429 günlük sınır → mesaj + düğme kilitli', async () => {
    vi.mocked(ra.sendCampaign).mockRejectedValue(new ra.CampaignLimitError('Bugün zaten bir kampanya gönderdiniz. Yarın tekrar deneyebilirsiniz.'));
    renderRoute(<CampaignPage />, { path: '/kampanya', initial: '/kampanya' });
    fireEvent.change(screen.getByLabelText('Mesaj'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kampanyayı gönder' }));
    expect(screen.getByText('Mesaj en az 5 karakter olmalı')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mesaj'), { target: { value: 'Bu akşam %20 indirim' } });
    fireEvent.click(document.querySelector('input[value="favorites"]') as HTMLInputElement);
    fireEvent.click(screen.getByRole('button', { name: 'Kampanyayı gönder' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Gönder' }));
    expect(await screen.findByText('Bugün zaten bir kampanya gönderdiniz. Yarın tekrar deneyebilirsiniz.')).toBeInTheDocument();
    expect(ra.sendCampaign).toHaveBeenCalledWith('Bu akşam %20 indirim', 'favorites');
    expect(screen.getByRole('button', { name: 'Kampanyayı gönder' })).toBeDisabled();
  });
});

describe('Analitik', () => {
  it('veri yoksa boş durum; rapor hatasında tekrar dene', async () => {
    vi.mocked(ra.getRestaurantAnalytics).mockResolvedValue({
      reservations: { totalReservations: 0, trend: [], busiestHours: [], statusBreakdown: { PENDING: 0, CONFIRMED: 0, REJECTED: 0, CANCELLED: 0, COMPLETED: 0 }, attendanceRate: null },
      reviews: { reviewCount: 0, avgRating: null, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    });
    vi.mocked(ra.getWeeklyReport).mockRejectedValueOnce(axiosError(500, {})).mockResolvedValueOnce({ report: 'Haftalık özet', model: null, fallback: true, generatedAt: '' });
    renderRoute(<AnalyticsPage />, { path: '/analitik', initial: '/analitik' });
    expect(await screen.findByText('Henüz analitik verisi yok')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByText('Haftalık özet')).toBeInTheDocument();
  });
  it('grafiklerin metin karşılığı', async () => {
    vi.mocked(ra.getRestaurantAnalytics).mockResolvedValue({
      reservations: { totalReservations: 5, trend: [{ date: '2026-11-27', count: 3 }], busiestHours: [{ hour: '20', count: 2 }], statusBreakdown: { PENDING: 1, CONFIRMED: 2, REJECTED: 0, CANCELLED: 0, COMPLETED: 2 }, attendanceRate: 0.5 },
      reviews: { reviewCount: 2, avgRating: 4.5, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 } },
    });
    vi.mocked(ra.getWeeklyReport).mockResolvedValue({ report: 'ok', model: 'h', fallback: false, generatedAt: '' });
    renderRoute(<AnalyticsPage />, { path: '/analitik', initial: '/analitik' });
    expect(await screen.findByRole('table', { name: 'En yoğun saatler' })).toBeInTheDocument();
    expect(screen.getByText('%50')).toBeInTheDocument();
  });
});
