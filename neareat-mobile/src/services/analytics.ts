// Hafif ürün analitiği / funnel event tracking (S14-M5).
//
// Neden: Keşfet -> detay -> rezervasyon hunisini, AI öneri kullanımını ve premium
// dönüşümünü ölçmek için. Sağlayıcı-agnostik: gerçek sink (kendi backend'i veya bir
// analytics SDK'sı) `setAnalyticsSink` ile takılır; takılmazsa trackEvent TAM no-op
// (geliştirme/test/SDK'sız build etkilenmez).
//
// KVKK/gizlilik: PII (e-posta/telefon/token) gönderilmez; bilinen PII anahtarları ayıklanır.
// Kullanıcı id'si UUID (pseudonymous) olduğundan korunur.

export type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProps = Record<string, AnalyticsValue>;
export type AnalyticsSink = (name: string, props?: AnalyticsProps) => void;

let _sink: AnalyticsSink | null = null;

// Gerçek analytics sağlayıcısını takar (uygulama açılışında). null = devre dışı (no-op).
export function setAnalyticsSink(sink: AnalyticsSink | null): void {
  _sink = sink;
}

const PII_RE = /(email|password|phone|token|authorization|address)/i;

// PII anahtarlarını ayıklar (değer göndermez).
export function stripPii(props?: AnalyticsProps): AnalyticsProps | undefined {
  if (!props) return undefined;
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (PII_RE.test(k)) continue;
    out[k] = v;
  }
  return out;
}

// Bir funnel olayını kaydeder. Sink yoksa no-op; sink hatası asla UX'i bozmaz.
export function trackEvent(name: string, props?: AnalyticsProps): void {
  const sink = _sink;
  if (!sink) return;
  try {
    sink(name, stripPii(props));
  } catch {
    /* analitik asla akışı bozmamalı */
  }
}

// Standart funnel olay adları (tutarlılık için tek yerde).
export const ANALYTICS_EVENTS = {
  SCREEN_VIEW: 'screen_view',
  RESTAURANT_DETAIL_OPEN: 'restaurant_detail_open',
  RESERVATION_STARTED: 'reservation_started',
  RESERVATION_COMPLETED: 'reservation_completed',
  AI_RECOMMENDATION_REQUESTED: 'ai_recommendation_requested',
  PAYWALL_SHOWN: 'paywall_shown',
} as const;
