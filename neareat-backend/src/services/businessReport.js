/**
 * Restoran haftalık işletme raporu (Sprint-5 Task #6).
 *
 * S5-5 analitik verisini + son yorumları Claude'a verip kısa Türkçe işletme
 * özeti üretir ("Bu hafta 5 yorum geldi, 4'ü kahve menüsünden bahsetti").
 *
 * Model: claude-haiku-4-5 — basit summarization, projenin maliyet stratejisiyle
 * tutarlı (recommendationService free tier ile aynı model). Anthropic hatasında
 * graceful fallback: kısa şablon özet döner, akış bozulmaz.
 */

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger'); // S21-2
const { readTimeoutEnv } = require('../utils/httpTimeout'); // S20-1

const REPORT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_REPORT_TOKENS = 600;
const MAX_REVIEW_SNIPPETS = 8;
const MAX_REVIEW_LEN = 200;

// S20-1 — SDK varsayılanı 10 dakika; rapor üretimi tek atışlık bir çağrı, bu kadar
// uzun beklemenin karşılığı yok. Zaman aşımında mevcut şablon fallback'i devreye girer.
const ANTHROPIC_TIMEOUT_MS = readTimeoutEnv('ANTHROPIC_TIMEOUT_MS', 60000);

let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY tanımlı değil');
  _client = new Anthropic({ apiKey, timeout: ANTHROPIC_TIMEOUT_MS });
  return _client;
}

const SYSTEM_PROMPT =
  'Sen bir restoran işletme danışmanısın. Sana bir restoranın haftalık ' +
  'verilerini (rezervasyon trendi, yoğun saatler, durum dağılımı, katılım oranı, ' +
  'puan ve son yorumlar) JSON olarak veriyorum. Bunlardan restoran sahibine ' +
  'yönelik KISA (3-5 cümle), somut ve eyleme dönük bir Türkçe haftalık özet yaz. ' +
  'Sayılara atıfta bulun, abartma, uydurma veri ekleme. Sadece özet metnini döndür, ' +
  'başlık veya madde işareti kullanma.';

/** Anthropic erişilemezse deterministik şablon özet. */
function fallbackReport(analytics) {
  const r = analytics?.reservations || {};
  const rev = analytics?.reviews || {};
  const total = r.totalReservations ?? 0;
  const busiest = (r.busiestHours && r.busiestHours[0]) ? `${r.busiestHours[0].hour}:00` : null;
  const parts = [`Bu hafta toplam ${total} rezervasyon kaydı var.`];
  if (busiest) parts.push(`En yoğun saat ${busiest} civarı.`);
  if (rev.reviewCount > 0) {
    parts.push(`${rev.reviewCount} yorum alındı${rev.avgRating != null ? `, ortalama puan ${rev.avgRating}` : ''}.`);
  }
  return parts.join(' ');
}

/**
 * @param {object} analytics - computeReservationAnalytics/Review çıktısı { reservations, reviews }
 * @param {Array<{rating:number, body:string}>} recentReviews
 * @returns {Promise<{ report: string, model: string|null, fallback: boolean }>}
 */
async function generateWeeklyReport(analytics, recentReviews = []) {
  const reviewSnippets = (recentReviews || [])
    .slice(0, MAX_REVIEW_SNIPPETS)
    .map((r) => ({ rating: r.rating, body: String(r.body || '').slice(0, MAX_REVIEW_LEN) }));

  const payload = JSON.stringify({ analytics, recentReviews: reviewSnippets });

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: REPORT_MODEL,
      max_tokens: MAX_REPORT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Haftalık veriler:\n\`\`\`json\n${payload}\n\`\`\`` }],
    });
    const text = response.content?.find((b) => b.type === 'text')?.text?.trim();
    if (!text) return { report: fallbackReport(analytics), model: null, fallback: true };
    return { report: text, model: REPORT_MODEL, fallback: false };
  } catch (err) {
    logger.error('[businessReport] Anthropic hatası, fallback kullanılıyor', { error: err.message });
    return { report: fallbackReport(analytics), model: null, fallback: true };
  }
}

module.exports = { generateWeeklyReport, fallbackReport, REPORT_MODEL, SYSTEM_PROMPT };
