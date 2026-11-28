// Form doğrulamaları — mesajlar backend/mobil metinleriyle aynı (FAZ1-ANALIZ §4-6, BILESENLER §3).
// Saf fonksiyonlar: `null` = geçerli, string = alan altında gösterilecek hata.

export const MSG = {
  required: 'Bu alan zorunludur.',
  email: 'Geçerli bir e-posta girin.',
  passwordLength: 'Şifre 8-128 karakter arasında olmalı',
  passwordShort: 'Şifre en az 8 karakter olmalı.',
  passwordMismatch: 'Şifreler eşleşmiyor.',
  taxNumber: 'Vergi numarası 10 haneli olmalı.',
  seats: 'Rezerve koltuk 1-5000 arasında olmalıdır.',
  rejectionReason: 'Red nedeni girilmesi zorunludur.',
  messageEmpty: 'Mesaj içeriği boş olamaz.',
  messageLong: 'Mesaj en fazla 1000 karakter olabilir.',
  displayName: 'Görünen ad 2-80 karakter arasında olmalıdır.',
  tableCount: 'Masa kapasitesi 1-500 arasında olmalıdır.',
  seatCapacity: 'Koltuk kapasitesi 1-5000 arasında olmalıdır.',
  altPhone: 'Alternatif telefon en fazla 20 karakter olabilir.',
  replyEmpty: 'İçerik gerekli',
  replyLong: 'Cevap 500 karakteri geçemez',
  discountPercent: 'İndirim oranı %1-%80 arasında olmalı',
  discountDuration: 'Süre 30-1440 dakika arasında olmalı',
  campaignShort: 'Mesaj en az 5 karakter olmalı',
  campaignLong: 'Mesaj en fazla 200 karakter olabilir.',
} as const;

export function validateEmail(v: string): string | null {
  const s = v.trim();
  if (!s) return MSG.required;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? null : MSG.email;
}

export function validatePassword(v: string): string | null {
  if (!v) return MSG.required;
  return v.length < 8 || v.length > 128 ? MSG.passwordLength : null;
}

export function validatePasswordConfirm(pw: string, confirm: string): string | null {
  if (!confirm) return MSG.required;
  return pw === confirm ? null : MSG.passwordMismatch;
}

export function validateRequired(v: string): string | null {
  return v.trim() ? null : MSG.required;
}

export function validateTaxNumber(v: string): string | null {
  return /^\d{10}$/.test(v) ? null : MSG.taxNumber;
}

function intInRange(v: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(v.trim())) return false;
  const n = Number(v);
  return n >= min && n <= max;
}

export function validateSeats(v: string): string | null {
  return intInRange(v, 1, 5000) ? null : MSG.seats;
}

export function validateRejectionReason(v: string): string | null {
  return v.trim() ? null : MSG.rejectionReason;
}

export function validateMessage(v: string): string | null {
  if (!v.trim()) return MSG.messageEmpty;
  return v.length > 1000 ? MSG.messageLong : null;
}

/** Bilgiler formu — boş bırakılabilen alanlar boşken geçerli. */
export function validateDisplayName(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  return s.length < 2 || s.length > 80 ? MSG.displayName : null;
}

export function validateOptionalRange(v: string, min: number, max: number, msg: string): string | null {
  if (!v.trim()) return null;
  return intInRange(v, min, max) ? null : msg;
}

export function validateAltPhone(v: string): string | null {
  return v.trim().length > 20 ? MSG.altPhone : null;
}

export function validateReply(v: string): string | null {
  if (!v.trim()) return MSG.replyEmpty;
  return v.length > 500 ? MSG.replyLong : null;
}

export function validateDiscountPercent(v: string): string | null {
  return intInRange(v, 1, 80) ? null : MSG.discountPercent;
}

export function validateDiscountDuration(v: string): string | null {
  return intInRange(v, 30, 1440) ? null : MSG.discountDuration;
}

export function validateCampaignMessage(v: string): string | null {
  const s = v.trim();
  if (s.length < 5) return MSG.campaignShort;
  return s.length > 200 ? MSG.campaignLong : null;
}

// ─── Dosya ───────────────────────────────────────────────────────────────────

export interface FileRule { types: string[]; maxBytes: number; typeMessage: string; sizeMessage: string }

/**
 * Vergi levhası (S1 varsayımı: Faz 1'de yalnızca JPG/PNG, ≤3,5 MB). Base64 ~%33 şişer:
 * 3,5 MB → ~4,7 MB, backend'in 5 MB JSON gövde sınırına diğer alanlarla birlikte sığar.
 */
export const TAX_CERT_RULE: FileRule = {
  types: ['image/jpeg', 'image/png'],
  maxBytes: 3.5 * 1024 * 1024,
  typeMessage: 'Bu dosya türü desteklenmiyor. JPG veya PNG yükleyin.',
  sizeMessage: 'Dosya en fazla 3,5 MB olabilir.',
};

/** Menü: backend `uploadMenuItem` izinli türleri ve 3 MB sınırı. */
export const MENU_RULE: FileRule = {
  types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  maxBytes: 3 * 1024 * 1024,
  typeMessage: 'Desteklenmeyen dosya türü',
  sizeMessage: 'Menü dosyası en fazla 3 MB olabilir.',
};

/** Foto galerisi: JPEG/PNG/WebP, 5 MB (backend `createPhotoUploadUrl`/`addPhoto`). */
export const PHOTO_RULE: FileRule = {
  types: ['image/jpeg', 'image/png', 'image/webp'],
  maxBytes: 5 * 1024 * 1024,
  typeMessage: 'Desteklenmeyen dosya türü. Yalnızca JPEG/PNG/WebP.',
  sizeMessage: 'Fotoğraf en fazla 5 MB olabilir.',
};

export function validateFile(file: { type: string; size: number }, rule: FileRule): string | null {
  if (!rule.types.includes(file.type)) return rule.typeMessage;
  if (file.size > rule.maxBytes) return rule.sizeMessage;
  return null;
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('Dosya okunamadı.'));
    r.readAsDataURL(file);
  });
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
