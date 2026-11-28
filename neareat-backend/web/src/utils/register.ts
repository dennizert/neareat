// Restoran başvurusu (#528) saf yardımcıları: adım doğrulaması, gövde üretimi, 409 eşlemesi.
import type { RegisterRestaurantPayload } from '../services/restaurantAccount';
import type { PlaceResult } from '../types';
import { MSG, validateEmail, validatePassword, validateRequired, validateTaxNumber } from './validation';

export const STEPS = ['Hesap', 'İşletme', 'Vergi levhası', 'Restoran seçimi', 'Özet'] as const;
/** Mobil `RestaurantRegisterScreen` ile aynı kategori listesi. */
export const CATEGORIES = ['Restoran', 'Kafe', 'Fast Food', 'Pastane/Fırın', 'Esnaf Lokantası', 'Diğer'];

export interface RegisterForm {
  ownerName: string;
  email: string;
  password: string;
  businessName: string;
  businessCategory: string;
  taxNumber: string;
  taxOffice: string;
  phone: string;
  contactEmail: string;
  address: string;
  taxCertificate: { name: string; size: number; dataUrl: string } | null;
  place: PlaceResult | null;
  consent: boolean;
}

export const EMPTY_FORM: RegisterForm = {
  ownerName: '', email: '', password: '',
  businessName: '', businessCategory: '', taxNumber: '', taxOffice: '', phone: '', contactEmail: '', address: '',
  taxCertificate: null, place: null, consent: false,
};

export type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

export function validateStep(step: number, f: RegisterForm): RegisterErrors {
  const e: RegisterErrors = {};
  const put = (k: keyof RegisterForm, v: string | null) => { if (v) e[k] = v; };
  if (step === 0) {
    put('ownerName', validateRequired(f.ownerName));
    put('email', validateEmail(f.email));
    put('password', validatePassword(f.password));
  }
  if (step === 1) {
    put('businessName', validateRequired(f.businessName));
    put('businessCategory', f.businessCategory ? null : MSG.required);
    put('taxNumber', validateTaxNumber(f.taxNumber));
    put('taxOffice', validateRequired(f.taxOffice));
    put('phone', validateRequired(f.phone));
    put('contactEmail', validateEmail(f.contactEmail));
    put('address', validateRequired(f.address));
  }
  if (step === 4 && !f.consent) e.consent = 'Devam etmek için koşulları kabul etmelisiniz.';
  return e;
}

/** Yalnızca rakam, en fazla 10 hane (vergi no alanı başka karakter kabul etmez). */
export function sanitizeTaxNumber(v: string): string {
  return v.replace(/\D/g, '').slice(0, 10);
}

export function buildPayload(f: RegisterForm): RegisterRestaurantPayload {
  return {
    email: f.email.trim().toLowerCase(),
    password: f.password,
    ownerName: f.ownerName.trim(),
    businessName: f.businessName.trim(),
    taxNumber: f.taxNumber,
    taxOffice: f.taxOffice.trim(),
    phone: f.phone.trim(),
    contactEmail: f.contactEmail.trim(),
    address: f.address.trim(),
    businessCategory: f.businessCategory,
    placeId: f.place?.placeId,
    placeName: f.place?.name,
    placeAddress: placeAddressOf(f.place) ?? undefined,
    placePhotoUrl: f.place?.photoUrl ?? undefined,
    taxCertificateData: f.taxCertificate?.dataUrl,
  };
}

export function placeAddressOf(p: PlaceResult | null | undefined): string | null {
  return p?.formattedAddress || p?.vicinity || p?.address || null;
}

/** 409 → hangi adım/alan. Veriler korunur, kullanıcı o adıma döner. */
export function conflictTarget(message: string): { step: number; field: keyof RegisterForm } | null {
  if (/e-posta/i.test(message)) return { step: 0, field: 'email' };
  if (/vergi/i.test(message)) return { step: 1, field: 'taxNumber' };
  return null;
}

/** 5 MB JSON gövde sınırı (backend `express.json({limit:'5mb'})`). */
export const BODY_LIMIT_BYTES = 5 * 1024 * 1024;
export function payloadFitsBodyLimit(p: RegisterRestaurantPayload): boolean {
  return new Blob([JSON.stringify(p)]).size < BODY_LIMIT_BYTES;
}
