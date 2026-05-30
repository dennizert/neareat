/**
 * Restoran fotoğrafı analizi (Sprint-7 #94).
 *
 * Kullanıcı bir restoran fotoğrafını (URL ya da base64) verir; Claude vision
 * onu analiz edip Türkçe atmosfer/durum değerlendirmesi yazar.
 *
 * Model: claude-haiku-4-5 — multimodal, hızlı ve maliyet-etkin (businessReport
 * + free tier recommendation ile aynı). Anthropic hatasında null'a düşer.
 */

const Anthropic = require('@anthropic-ai/sdk');

const VISION_MODEL = 'claude-haiku-4-5-20251001';
const MAX_VISION_TOKENS = 350;

let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY tanımlı değil');
  _client = new Anthropic({ apiKey });
  return _client;
}

const SYSTEM_PROMPT =
  'Sen bir restoran fotoğrafı uzmanısın. Sana bir restoranın fotoğrafı + opsiyonel ' +
  'isim/adres veriliyor. Atmosferi, görünür kalitesi, kimler için uygun olduğu, ' +
  'fotoğraftan çıkarılabilecek olumlu/olumsuz sinyaller hakkında KISA (3-4 cümle) ' +
  'Türkçe bir değerlendirme yaz. Tahmin yürütüyorsan açıkça söyle ("Görünüşe göre..."). ' +
  'Sayı/puan uydurma. Sadece değerlendirme metnini döndür.';

/**
 * Image source'u Claude vision message formatına çevir.
 * @param {{ imageUrl?: string, imageBase64?: string, mediaType?: string }} input
 */
function buildImageBlock(input) {
  if (input.imageUrl) {
    return { type: 'image', source: { type: 'url', url: input.imageUrl } };
  }
  if (input.imageBase64) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: input.mediaType || 'image/jpeg',
        data: input.imageBase64,
      },
    };
  }
  return null;
}

/**
 * @param {{ imageUrl?: string, imageBase64?: string, mediaType?: string,
 *           placeId?: string, placeName?: string, placeAddress?: string }} input
 * @returns {Promise<{ analysis: string|null, model: string|null, fallback: boolean, error?: string }>}
 */
async function analyzeRestaurantPhoto(input) {
  const imageBlock = buildImageBlock(input);
  if (!imageBlock) {
    return { analysis: null, model: null, fallback: true, error: 'image yok' };
  }

  const contextParts = [];
  if (input.placeName) contextParts.push(`Restoran: ${input.placeName}`);
  if (input.placeAddress) contextParts.push(`Adres: ${input.placeAddress}`);
  const contextLine = contextParts.length
    ? contextParts.join('\n') + '\n\n'
    : '';

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: MAX_VISION_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          imageBlock,
          { type: 'text', text: `${contextLine}Bu restoran nasıl görünüyor?` },
        ],
      }],
    });
    const text = response.content?.find((b) => b.type === 'text')?.text?.trim();
    if (!text) return { analysis: null, model: null, fallback: true };
    return { analysis: text, model: VISION_MODEL, fallback: false };
  } catch (err) {
    console.error('[photoAnalysis] Anthropic hatası:', err.message);
    return { analysis: null, model: null, fallback: true, error: err.message };
  }
}

module.exports = {
  analyzeRestaurantPhoto,
  buildImageBlock,
  VISION_MODEL,
  SYSTEM_PROMPT,
};
