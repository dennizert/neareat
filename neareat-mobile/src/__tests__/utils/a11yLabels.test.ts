/**
 * NEW-UI02 (issue #459) — auth alanlarının erişilebilir adı.
 *
 * Düzeltme öncesi emülatörde ölçülen erişilebilirlik ağacı:
 *   EditText  text='ornek@email.com'  content-desc=''
 *   EditText  text='Şifreniz'         content-desc=''
 *   ImageView (göz düğmesi)           content-desc=''   ← tamamen adsız
 *
 * Yani alanların adı YOK değil, YANLIŞ: görünen etiket yerine placeholder okunuyordu.
 */
import { fieldAccessibilityLabel, passwordToggleLabel } from '../../utils/a11yLabels';

describe('fieldAccessibilityLabel', () => {
  it('T1 etiket varsa ad etikettir (placeholder DEĞİL)', () => {
    expect(fieldAccessibilityLabel({ label: 'E-posta', placeholder: 'ornek@email.com' }))
      .toBe('E-posta');
  });

  it('T2 etiket yoksa placeholder kullanılır', () => {
    expect(fieldAccessibilityLabel({ placeholder: 'ornek@email.com' }))
      .toBe('ornek@email.com');
  });

  it('T3 ikisi de yoksa ad üretilmez', () => {
    expect(fieldAccessibilityLabel({})).toBeUndefined();
  });

  // RN'de aria-describedby karşılığı yok: hata ADA eklenmezse, alana odaklanan
  // kullanıcı ayrı duran hata metnini hiç duymaz.
  it('T4 hata varsa ad etiketi VE hatayı içerir', () => {
    const label = fieldAccessibilityLabel({
      label: 'Şifre', placeholder: 'Şifreniz', error: 'En az 8 karakter',
    });
    expect(label).toContain('Şifre');
    expect(label).toContain('En az 8 karakter');
  });

  it('T5 etiket yokken hata tek başına iletilir', () => {
    expect(fieldAccessibilityLabel({ error: 'Zorunlu alan' })).toBe('Hata: Zorunlu alan');
  });

  it('boş/whitespace hata ada eklenmez', () => {
    expect(fieldAccessibilityLabel({ label: 'E-posta', error: '   ' })).toBe('E-posta');
    expect(fieldAccessibilityLabel({ label: 'E-posta', error: null })).toBe('E-posta');
  });

  // Hiçbir durumda ad, placeholder'a sessizce düşmemeli — asıl hata buydu.
  it('etiket verildiği sürece placeholder ada SIZMAZ', () => {
    const label = fieldAccessibilityLabel({
      label: 'Şifre', placeholder: 'Şifreniz', error: 'Hatalı',
    });
    expect(label).not.toContain('Şifreniz');
  });
});

describe('passwordToggleLabel', () => {
  // Düğmenin adı YAPACAĞI eylemi söyler; ekran okuyucu kullanıcısı için eylem,
  // mevcut durumdan daha yararlıdır.
  it('T6 şifre gizliyken "Şifreyi göster"', () => {
    expect(passwordToggleLabel(false)).toBe('Şifreyi göster');
  });

  it('T7 şifre görünürken "Şifreyi gizle"', () => {
    expect(passwordToggleLabel(true)).toBe('Şifreyi gizle');
  });

  it('iki durum farklı ad üretir (düğme sessizce aynı kalmaz)', () => {
    expect(passwordToggleLabel(true)).not.toBe(passwordToggleLabel(false));
  });
});
