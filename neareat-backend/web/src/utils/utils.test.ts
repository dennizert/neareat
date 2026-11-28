import { describe, expect, it } from 'vitest';
import * as v from './validation';
import { bandColorKey, bandForPercent, bandLabel, shouldShowBand, trialDaysLeft } from './occupancyBand';
import { canMarkAttendance, capacityCheck, countByTab, filterByTab, sortPending } from './reservations';
import { buildPayload, conflictTarget, EMPTY_FORM, payloadFitsBodyLimit, sanitizeTaxNumber, validateStep } from './register';
import { addDays, formatDateLong, formatDateShort, formatDecimal } from './format';
import { safeReturnPath } from '../store/sessionStore';
import type { Reservation } from '../types';

const res = (p: Partial<Reservation>): Reservation => ({
  id: 'r', userId: 'u', restaurantId: 'x', placeId: 'p', placeName: 'P', date: '2026-11-28', time: '19:00', guestCount: 2,
  occasion: null, specialRequests: null, status: 'PENDING', rejectionReason: null, attended: null, createdAt: '', updatedAt: '',
  user: { id: 'u', displayName: 'A', photoUrl: null }, ...p,
});

describe('form doğrulamaları (backend metinleri)', () => {
  it('rezerve koltuk 1-5000', () => {
    expect(v.validateSeats('0')).toBe('Rezerve koltuk 1-5000 arasında olmalıdır.');
    expect(v.validateSeats('5001')).toBe(v.MSG.seats);
    expect(v.validateSeats('2.5')).toBe(v.MSG.seats);
    expect(v.validateSeats('1')).toBeNull();
    expect(v.validateSeats('5000')).toBeNull();
  });
  it('red nedeni zorunlu', () => {
    expect(v.validateRejectionReason('   ')).toBe('Red nedeni girilmesi zorunludur.');
    expect(v.validateRejectionReason('Dolu')).toBeNull();
  });
  it('şifre ve tekrar', () => {
    expect(v.validatePassword('1234567')).toBe(v.MSG.passwordLength);
    expect(v.validatePassword('a'.repeat(129))).toBe(v.MSG.passwordLength);
    expect(v.validatePassword('12345678')).toBeNull();
    expect(v.validatePasswordConfirm('12345678', '12345679')).toBe('Şifreler eşleşmiyor.');
  });
  it('vergi no 10 hane', () => {
    expect(v.validateTaxNumber('123456789')).toBe('Vergi numarası 10 haneli olmalı.');
    expect(v.validateTaxNumber('1234567890')).toBeNull();
  });
  it('mesaj 1-1000', () => {
    expect(v.validateMessage('')).toBe(v.MSG.messageEmpty);
    expect(v.validateMessage('x'.repeat(1001))).toBe(v.MSG.messageLong);
  });
  it('bilgiler aralıkları (boş geçerli)', () => {
    expect(v.validateDisplayName('')).toBeNull();
    expect(v.validateDisplayName('A')).toBe(v.MSG.displayName);
    expect(v.validateOptionalRange('', 1, 500, 'x')).toBeNull();
    expect(v.validateOptionalRange('501', 1, 500, 'x')).toBe('x');
    expect(v.validateAltPhone('1'.repeat(21))).toBe(v.MSG.altPhone);
  });
  it('yorum yanıtı, indirim, kampanya', () => {
    expect(v.validateReply('')).toBe('İçerik gerekli');
    expect(v.validateReply('x'.repeat(501))).toBe('Cevap 500 karakteri geçemez');
    expect(v.validateDiscountPercent('81')).toBe('İndirim oranı %1-%80 arasında olmalı');
    expect(v.validateDiscountPercent('0')).toBe(v.MSG.discountPercent);
    expect(v.validateDiscountPercent('80')).toBeNull();
    expect(v.validateDiscountDuration('29')).toBe('Süre 30-1440 dakika arasında olmalı');
    expect(v.validateDiscountDuration('1440')).toBeNull();
    expect(v.validateCampaignMessage('abcd')).toBe('Mesaj en az 5 karakter olmalı');
    expect(v.validateCampaignMessage('x'.repeat(201))).toBe(v.MSG.campaignLong);
  });
  it('dosya kuralları', () => {
    expect(v.validateFile({ type: 'application/pdf', size: 10 }, v.TAX_CERT_RULE)).toBe(v.TAX_CERT_RULE.typeMessage);
    expect(v.validateFile({ type: 'image/png', size: 3.6 * 1024 * 1024 }, v.TAX_CERT_RULE)).toBe(v.TAX_CERT_RULE.sizeMessage);
    expect(v.validateFile({ type: 'image/jpeg', size: 1000 }, v.TAX_CERT_RULE)).toBeNull();
    expect(v.validateFile({ type: 'image/gif', size: 1 }, v.PHOTO_RULE)).toBe(v.PHOTO_RULE.typeMessage);
    expect(v.validateFile({ type: 'image/webp', size: 5 * 1024 * 1024 + 1 }, v.PHOTO_RULE)).toBe('Fotoğraf en fazla 5 MB olabilir.');
    expect(v.validateFile({ type: 'application/pdf', size: 3 * 1024 * 1024 + 1 }, v.MENU_RULE)).toBe('Menü dosyası en fazla 3 MB olabilir.');
  });
});

describe('doluluk bandı (mobil ile birebir)', () => {
  it('etiket ve renk', () => {
    expect(bandLabel('available')).toBe('Müsait');
    expect(bandLabel('limited')).toBe('Az yer kaldı');
    expect(bandLabel('full')).toBe('Dolu');
    expect(bandLabel('unknown')).toBeNull();
    expect(bandColorKey('limited')).toBe('warning');
    expect(shouldShowBand('unknown')).toBe(false);
  });
  it('eşikler: <70 müsait, 70+ az yer, 100 dolu', () => {
    expect(bandForPercent(69)).toBe('available');
    expect(bandForPercent(70)).toBe('limited');
    expect(bandForPercent(99)).toBe('limited');
    expect(bandForPercent(100)).toBe('full');
    expect(bandForPercent(null)).toBe('unknown');
  });
  it('trial kalan gün yukarı yuvarlanır', () => {
    const now = new Date('2026-11-28T10:00:00Z');
    expect(trialDaysLeft('2026-11-29T09:00:00Z', now)).toBe(1);
    expect(trialDaysLeft('2026-12-01T11:00:00Z', now)).toBe(4);
    expect(trialDaysLeft('2026-11-27T00:00:00Z', now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBeNull();
  });
});

describe('rezervasyon listesi', () => {
  it('bekleyen sıralaması: öncelik desc → tarih/saat asc', () => {
    const list = [
      res({ id: 'a', reservationPriority: 0, date: '2026-11-28', time: '18:00' }),
      res({ id: 'b', reservationPriority: 2, date: '2026-11-30', time: '20:00' }),
      res({ id: 'c', reservationPriority: 2, date: '2026-11-29', time: '12:00' }),
      res({ id: 'd', reservationPriority: 0, date: '2026-11-28', time: '12:00' }),
    ];
    expect(sortPending(list).map((r) => r.id)).toEqual(['c', 'b', 'd', 'a']);
  });
  it('sekme sayıları ve filtre', () => {
    const list = [res({ status: 'PENDING' }), res({ status: 'CONFIRMED' }), res({ status: 'CANCELLED' })];
    expect(countByTab(list)).toEqual({ PENDING: 1, CONFIRMED: 1, COMPLETED: 0, REJECTED: 0, ALL: 3 });
    expect(filterByTab(list, 'ALL')).toHaveLength(3);
    expect(filterByTab(list, 'CONFIRMED')).toHaveLength(1);
  });
  it('katılım yalnızca onaylı + işaretlenmemiş', () => {
    expect(canMarkAttendance({ status: 'CONFIRMED', attended: null })).toBe(true);
    expect(canMarkAttendance({ status: 'CONFIRMED', attended: true })).toBe(false);
    expect(canMarkAttendance({ status: 'PENDING', attended: null })).toBe(false);
  });
  it('kapasite uyarısı: işgal aralığındaki en dolu dilim', () => {
    const occ = { date: '2026-11-28', seatCapacity: 80, slots: [
      { time: '19:00', reserved: 60, free: 20, percent: 75, band: 'limited' },
      { time: '20:00', reserved: 76, free: 4, percent: 95, band: 'limited' },
      { time: '21:00', reserved: 80, free: 0, percent: 100, band: 'full' },
    ] };
    expect(capacityCheck(occ, '19:00', 4)).toEqual({ reserved: 76, capacity: 80, overflow: false });
    expect(capacityCheck(occ, '19:00', 5)?.overflow).toBe(true);
    // 19:30 + 120 dk → 21:00 dilimi de işgal aralığında (dolu)
    expect(capacityCheck(occ, '19:30', 1)).toEqual({ reserved: 80, capacity: 80, overflow: true });
    expect(capacityCheck({ ...occ, seatCapacity: null }, '19:00', 2)).toBeNull();
  });
});

describe('başvuru', () => {
  it('adım 1 ve 2 doğrulaması', () => {
    expect(Object.keys(validateStep(0, EMPTY_FORM)).sort()).toEqual(['email', 'ownerName', 'password']);
    const e = validateStep(1, { ...EMPTY_FORM, businessName: 'X', businessCategory: 'Kafe', taxNumber: '123', taxOffice: 'K', phone: '1', contactEmail: 'a@b.co', address: 'A' });
    expect(e).toEqual({ taxNumber: 'Vergi numarası 10 haneli olmalı.' });
    expect(validateStep(4, EMPTY_FORM).consent).toBeTruthy();
  });
  it('vergi no yalnızca 10 rakam', () => {
    expect(sanitizeTaxNumber('12a34-567890123')).toBe('1234567890');
  });
  it('409 eşlemesi', () => {
    expect(conflictTarget('Bu e-posta zaten kayıtlı')).toEqual({ step: 0, field: 'email' });
    expect(conflictTarget('Bu vergi numarası zaten kayıtlı')).toEqual({ step: 1, field: 'taxNumber' });
  });
  it('gövde: seçilen yer ve levha gönderilir; 3,5 MB levha 5 MB sınırına sığar', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(Math.ceil((3.5 * 1024 * 1024 * 4) / 3));
    const p = buildPayload({ ...EMPTY_FORM, email: ' A@B.CO ', place: { placeId: 'pid', name: 'N', vicinity: 'Adr', photoUrl: 'u' }, taxCertificate: { name: 'l.png', size: 1, dataUrl: big } });
    expect(p).toMatchObject({ email: 'a@b.co', placeId: 'pid', placeName: 'N', placeAddress: 'Adr', placePhotoUrl: 'u' });
    expect(payloadFitsBodyLimit(p)).toBe(true);
    expect(payloadFitsBodyLimit({ ...p, taxCertificateData: 'A'.repeat(5 * 1024 * 1024) })).toBe(false);
  });
});

describe('biçim ve yönlendirme', () => {
  it('tarih biçimleri', () => {
    expect(formatDateShort('2026-11-28')).toBe('28 Kas 2026');
    expect(formatDateLong('2026-11-27')).toBe('27 Kasım 2026, Cuma');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(formatDecimal('4.56')).toBe('4,6');
  });
  it('dönüş yolu yalnızca panel içi göreli', () => {
    expect(safeReturnPath('/rezervasyonlar?durum=PENDING')).toBe('/rezervasyonlar?durum=PENDING');
    expect(safeReturnPath('//evil.com')).toBeNull();
    expect(safeReturnPath('https://evil.com')).toBeNull();
    expect(safeReturnPath('/giris')).toBeNull();
  });
});
