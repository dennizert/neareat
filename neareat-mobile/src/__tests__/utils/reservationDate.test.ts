/**
 * NEW-UI01 (issue #457) — düzenleme ekranının başlangıç tarihi kararı.
 *
 * Eski hâl: `days.includes(res.date) ? res.date : days[0]`. Pencereye sığmayan tarih
 * SESSİZCE bugüne düşüyordu; kullanıcı yalnızca kişi sayısını değiştirip kaydettiğinde
 * rezervasyonun tarihi de değişiyordu. Restoranın panelinde kullanıcının hiç yapmadığı
 * bir "bu akşam" rezervasyonu beliriyordu.
 */
import { resolveInitialDate } from '../../utils/reservationDate';

// Pencere: 2026-09-20'den itibaren 5 gün (ekranda 60, test için kısa tutuldu)
const TODAY = '2026-09-20';
const WINDOW = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];

describe('resolveInitialDate', () => {
  it('T1 tarih pencerede → seçili o tarih, ek seçenek ve uyarı yok', () => {
    expect(resolveInitialDate('2026-09-22', WINDOW)).toEqual({
      selected: '2026-09-22', extraOption: null, isPast: false,
    });
  });

  it('T4 tarih bugün (pencerenin ilk günü) → normal seçim', () => {
    expect(resolveInitialDate(TODAY, WINDOW)).toEqual({
      selected: TODAY, extraOption: null, isPast: false,
    });
  });

  // ASIL DÜZELTME: eskiden bu durum days[0]'a (bugüne) düşüyordu.
  it('T2 tarih pencere dışında ama GELECEKTE → korunur ve seçiciye eklenir', () => {
    expect(resolveInitialDate('2099-12-31', WINDOW)).toEqual({
      selected: '2099-12-31', extraOption: '2099-12-31', isPast: false,
    });
  });

  it('pencerenin hemen ertesi günü de korunur (sınır)', () => {
    expect(resolveInitialDate('2026-09-25', WINDOW)).toEqual({
      selected: '2026-09-25', extraOption: '2026-09-25', isPast: false,
    });
  });

  // Geçmiş tarihte kullanıcı adına tarih UYDURULMAZ: backend zaten reddeder,
  // sessiz bir değişiklik dürüst bir hatadan kötüdür.
  it('T3 tarih dün → seçim YOK, uyarı var', () => {
    expect(resolveInitialDate('2026-09-19', WINDOW)).toEqual({
      selected: '', extraOption: null, isPast: true,
    });
  });

  it('T5 çok eski tarih → dün ile aynı davranış', () => {
    expect(resolveInitialDate('2024-01-15', WINDOW)).toEqual({
      selected: '', extraOption: null, isPast: true,
    });
  });

  it('T6 ek seçenek yalnızca gerektiğinde üretilir', () => {
    expect(resolveInitialDate('2026-09-21', WINDOW).extraOption).toBeNull();
    expect(resolveInitialDate('2026-09-19', WINDOW).extraOption).toBeNull();
    expect(resolveInitialDate('2027-01-01', WINDOW).extraOption).toBe('2027-01-01');
  });

  it('tarih boşsa seçim yapılmaz', () => {
    expect(resolveInitialDate('', WINDOW)).toEqual({
      selected: '', extraOption: null, isPast: false,
    });
  });

  it('bugün açıkça geçilebilir (ekran pencerenin ilk gününü kullanır)', () => {
    expect(resolveInitialDate('2026-10-05', WINDOW, TODAY).selected).toBe('2026-10-05');
    expect(resolveInitialDate('2026-09-01', WINDOW, TODAY).isPast).toBe(true);
  });

  // Hiçbir durumda kullanıcının tarihi sessizce BAŞKA bir güne çevrilmemeli:
  // ya korunur, ya da seçim boş bırakılıp durum bildirilir.
  it.each([
    ['pencerede', '2026-09-23'],
    ['gelecek, pencere dışı', '2030-06-01'],
    ['geçmiş', '2020-02-02'],
  ])('%s: seçilen tarih ya mevcut tarihtir ya da boştur — asla başka bir gün değil', (_l, date) => {
    const { selected } = resolveInitialDate(date, WINDOW);
    expect(selected === date || selected === '').toBe(true);
  });
});
