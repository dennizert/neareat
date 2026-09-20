/**
 * Erişilebilir ad hesabı — NEW-UI02 (issue #459).
 *
 * Saf fonksiyonlar: bileşenden bağımsız, doğrudan test edilir.
 *
 * NEDEN: React Native, kardeş bir `<Text>` etiketini `TextInput` ile İLİŞKİLENDİRMEZ
 * (web'deki `<label for>` karşılığı yok). Etiket verilmezse ekran okuyucu placeholder'ı
 * okur. Emülatörde ölçüldü — düzeltme öncesi erişilebilirlik ağacı:
 *   EditText text='ornek@email.com' content-desc=''
 *   EditText text='Şifreniz'        content-desc=''
 *   ImageView (göz düğmesi)         content-desc=''   ← tamamen adsız
 */

/**
 * Bir form alanının erişilebilir adı.
 *
 * Öncelik: görünen etiket → placeholder. Hata varsa ADA EKLENİR, çünkü RN'de
 * `aria-describedby` karşılığı yoktur ve alana odaklanan kullanıcı ayrı duran hata
 * metnini hiç duymaz.
 */
export function fieldAccessibilityLabel(
  { label, placeholder, error }: { label?: string; placeholder?: string; error?: string | null },
): string | undefined {
  const base = label || placeholder || '';
  const trimmedError = error ? String(error).trim() : '';
  if (!base && !trimmedError) return undefined;
  if (!trimmedError) return base;
  if (!base) return `Hata: ${trimmedError}`;
  return `${base}. Hata: ${trimmedError}`;
}

/**
 * Şifre göster/gizle düğmesinin adı. Ad, düğmenin YAPACAĞI eylemi söyler —
 * mevcut durumu değil; ekran okuyucu kullanıcısı için eylem daha yararlıdır.
 */
export function passwordToggleLabel(isVisible: boolean): string {
  return isVisible ? 'Şifreyi gizle' : 'Şifreyi göster';
}
