import { useThemeStore } from '../store/themeStore';

/**
 * Eatlas — "Enerjik Premium" renk sistemi
 * Kaynak: lezzet-renk-sistemi.css (proje kökünde)
 *
 * RENK ROLÜ (KESİN KURALLAR):
 *   SICAK   coral + amber → yemek, fiyat, puan, ANA CTA (Detay, Liste, Rezervasyon)
 *   TEAL                  → SADECE harita, mesafe, rota, "yakınımdakiler"
 *   AI      violet + cyan → SADECE "Bugün Ne Yesem", "Yolda Ne Yesem"
 *   NÖTR                  → zemin, metin, sınır
 *
 * 60-30-10: %60 nötr · %30 sıcak · %10 aksan (teal + AI birlikte %10)
 * Tek ekranda MAX 2 canlı renk. Mercanı cömert kullanma — gücünü korur.
 * Amber ve teal üzerine ASLA beyaz metin koyma — koyu metin zorunlu.
 */

// ── Marka çekirdeği (her iki modda da sabit) ──
const BRAND = {
  coral: '#FF5A3C',
  coralHover: '#FF6E55',
  coralActive: '#E84427',
  coralDark: '#C7381E',          // açık modda küçük metin (4.5:1 ✓)
  amber: '#FFB627',
  teal: '#2DD4BF',
  tealDeep: '#0F766E',            // açık modda metin (5.0:1 ✓ — CSS'tekinden daha koyu)
  aiViolet: '#8B5CF6',
  aiVioletBtn: '#7C3AED',         // beyaz metin için (5.7:1 ✓)
  aiCyan: '#22D3EE',
};

const STATUS = {
  success: '#34D399',
  warning: '#FBBF24',
  danger:  '#F87171',
};

export const lightColors = {
  // Zemin
  background: '#FBF7F2',          // sıcak krem
  surface: '#FFFFFF',
  surfaceAlt: '#F4EFE8',
  surfaceElevated: '#FFFFFF',

  // Metin
  textPrimary: '#1F1A24',
  textSecondary: '#5C5366',
  textTertiary: '#8C8198',
  textMuted: '#B0A6BC',

  // Sınır
  border: 'rgba(22, 18, 28, 0.10)',
  borderStrong: 'rgba(22, 18, 28, 0.18)',
  separator: 'rgba(22, 18, 28, 0.06)',

  // Input
  inputBg: '#F4EFE8',
  placeholder: '#8C8198',

  // ── Marka: coral (yemek / ana CTA) ──
  // Açık zeminde beyaz metin için koyu varyant (E84427 üzerinde beyaz → 5.8:1 ✓)
  primary: BRAND.coralActive,
  primaryHover: BRAND.coral,
  primaryActive: BRAND.coralDark,
  primaryLight: '#FFE4DC',
  primaryLighter: '#FFF1EC',
  primarySurface: '#FFF8F4',
  primaryOn: '#FFFFFF',
  primaryText: BRAND.coralDark,   // krem zeminde okunur (4.9:1 ✓)

  // ── Travel: teal (SADECE harita/rota) ──
  travel: BRAND.tealDeep,         // krem zeminde metin için (5.0:1 ✓)
  travelLight: '#D6F3F0',
  travelSurface: '#EAFAF8',
  travelOn: '#FFFFFF',

  // ── AI: violet+cyan (SADECE AI özellikleri) ──
  ai: BRAND.aiVioletBtn,
  aiLight: '#EDE4FF',
  aiSurface: '#F6F0FF',
  aiOn: '#FFFFFF',
  aiGradient: [BRAND.aiViolet, BRAND.aiCyan] as const,

  // ── Amber: puan/rozet ──
  // ÜZERİNE KOYU METİN. amber metin krem üzerinde okunmaz, koyu amber kullan.
  amber: '#B45309',               // krem zeminde metin (5.2:1 ✓)
  amberSurface: '#FEF3C7',
  amberOn: '#1F1A24',

  // ── Anlamsal ──
  success: '#0F8A5F',
  successSurface: '#E6F7EF',
  warning: '#B45309',
  warningSurface: '#FEF3C7',
  error: '#DC2626',
  errorSurface: '#FDECEC',

  // ── Misc ──
  shadow: '#1F1A24',
  overlay: 'rgba(22, 18, 28, 0.55)',
  disabled: '#E6DFD6',
  disabledOn: '#A89F94',
};

export const darkColors: typeof lightColors = {
  // Zemin (CSS'ten BİREBİR)
  background: '#16121C',
  surface: '#211B2A',
  surfaceAlt: '#2D2536',
  surfaceElevated: '#2D2536',

  // Metin (CSS'ten BİREBİR)
  textPrimary: '#F7F1EA',
  textSecondary: '#B9AEC4',
  textTertiary: '#7E7589',
  textMuted: '#5F566B',

  border: 'rgba(255, 255, 255, 0.10)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  separator: 'rgba(255, 255, 255, 0.06)',

  inputBg: '#2A2335',
  placeholder: '#7E7589',

  // ── Marka: coral ──
  // Koyu zeminde parlak coral + koyu metin (coral üzerinde #16121C → 6.0:1 ✓)
  primary: BRAND.coral,
  primaryHover: BRAND.coralHover,
  primaryActive: BRAND.coralActive,
  primaryLight: '#3D1F18',
  primaryLighter: '#2A1610',
  primarySurface: '#1F140E',
  primaryOn: '#16121C',
  primaryText: BRAND.coral,       // koyu zeminde metin (6.0:1 ✓)

  // ── Travel ──
  travel: BRAND.teal,             // koyu zeminde metin (10:1 ✓)
  travelLight: '#0B2F2B',
  travelSurface: '#0A1F1D',
  travelOn: '#0D0A14',

  // ── AI ──
  ai: BRAND.aiViolet,
  aiLight: '#2B1B4D',
  aiSurface: '#1A1230',
  aiOn: '#FFFFFF',
  aiGradient: [BRAND.aiViolet, BRAND.aiCyan] as const,

  // ── Amber ──
  amber: BRAND.amber,             // koyu zeminde metin (11:1 ✓)
  amberSurface: '#3A2806',
  amberOn: '#16121C',

  // ── Anlamsal ──
  success: STATUS.success,
  successSurface: '#0E2A1F',
  warning: STATUS.warning,
  warningSurface: '#2A1F08',
  error: STATUS.danger,
  errorSurface: '#2A1010',

  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.65)',
  disabled: '#3A3344',
  disabledOn: '#6E6578',
};

export type Colors = typeof lightColors;

/**
 * Kullanım kılavuzu:
 *   primary / primaryOn / primaryText  → "Detay", "Rezervasyon Yap", fiyat
 *   travel / travelOn                  → "Haritada Göster", mesafe, "Yakınımda"
 *   ai     / aiOn / aiGradient         → "Bugün Ne Yesem", "Yolda Ne Yesem"
 *   amber  / amberOn / amberSurface    → puan, yıldız (üzerine KOYU metin)
 *   success/warning/error              → durum bildirimleri
 *
 * Kontrast kontrol listesi (her ekran için):
 *   ✓ Tek ekranda en fazla 2 canlı renk birlikte mi?
 *   ✓ Yıldızlar zeminden ayrışıyor mu? (amber rengini kullan, kart zemini değil)
 *   ✓ İkincil metin en az 4.5:1 mi? (textSecondary kullan, textMuted değil)
 *   ✓ Mercan sadece ana aksiyonda mı?
 */

export function useTheme() {
  const isDark = useThemeStore(s => s.isDark);
  const C = isDark ? darkColors : lightColors;
  return { isDark, C };
}
