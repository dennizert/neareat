import * as Haptics from 'expo-haptics';

// S11-9 — Hafif dokunsal geri bildirim. Tüm çağrılar best-effort: desteklenmeyen
// platform/cihazda sessizce yutulur (UI akışını asla bozmaz).
function safe(fn: () => Promise<void>) {
  try {
    fn().catch(() => {});
  } catch {
    /* haptik yoksa yok say */
  }
}

export const haptics = {
  /** Hafif dokunuş — favori, seçim gibi küçük aksiyonlar. */
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Orta dokunuş — onay/gönderim. */
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Başarı bildirimi. */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Uyarı bildirimi. */
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Hata bildirimi. */
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
