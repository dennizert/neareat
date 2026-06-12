// Google Cloud Pub/Sub "authenticated push" doğrulaması (S12-4).
//
// Pub/Sub push aboneliği "authentication" ile yapılandırıldığında, her push isteği
// Google imzalı bir OIDC token'ı taşır: `Authorization: Bearer <jwt>`.
// Burada bu token'ı doğrularız — böylece RTDN webhook'u yalnızca Google'dan gelen
// gerçek bildirimleri işler (sahte bildirim / DoS engeli).
//
// GOOGLE_PUBSUB_AUDIENCE tanımlı değilse doğrulama uygulanmaz (geriye uyumluluk);
// bu durumda çağıran taraf uyarı loglar. Üretimde audience MUTLAKA ayarlanmalı.

const { OAuth2Client } = require('google-auth-library');

let _client = null;
function getClient() {
  if (!_client) _client = new OAuth2Client();
  return _client;
}

/**
 * Pub/Sub push isteğinin OIDC token'ını doğrular.
 * @param {import('express').Request} req
 * @returns {Promise<{ ok: boolean, enforced: boolean, reason?: string }>}
 *   - enforced=false → doğrulama yapılandırılmamış (kabul edilir, çağıran uyarmalı).
 *   - ok=false → yapılandırılmış ama token geçersiz/eksik (reddedilmeli).
 */
async function verifyPubSubPush(req) {
  const audience = process.env.GOOGLE_PUBSUB_AUDIENCE;
  if (!audience) return { ok: true, enforced: false };

  const header = req.headers?.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return { ok: false, enforced: true, reason: 'missing_token' };
  }
  const idToken = header.slice('Bearer '.length).trim();

  try {
    const ticket = await getClient().verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload() || {};

    const expectedEmail = process.env.GOOGLE_PUBSUB_SA_EMAIL;
    if (expectedEmail) {
      if (payload.email !== expectedEmail) {
        return { ok: false, enforced: true, reason: 'sa_email_mismatch' };
      }
      if (payload.email_verified !== true) {
        return { ok: false, enforced: true, reason: 'email_unverified' };
      }
    }
    return { ok: true, enforced: true };
  } catch {
    return { ok: false, enforced: true, reason: 'invalid_token' };
  }
}

module.exports = { verifyPubSubPush };
