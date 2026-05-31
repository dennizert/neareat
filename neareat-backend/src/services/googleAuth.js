const { OAuth2Client } = require('google-auth-library');

// Mobil @react-native-google-signin, webClientId audience'lı bir Google OAuth
// idToken üretir (Firebase token DEĞİL). Bu yüzden token'ı google-auth-library
// ile doğruluyoruz; firebase-admin yalnızca FCM/messaging için kullanılıyor.
//
// webClientId gizli değildir (mobil uygulamada gömülüdür), bu yüzden bilinen
// değeri default alıyoruz; gerekirse GOOGLE_WEB_CLIENT_ID env'i ile override edilir.
const GOOGLE_WEB_CLIENT_ID =
  process.env.GOOGLE_WEB_CLIENT_ID ||
  '1088498639612-651fnimrdrpu7h4rqetm8bdrqtoesbk7.apps.googleusercontent.com';

const client = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);

/**
 * Google OAuth idToken'ı doğrular ve payload'u döner.
 * @param {string} idToken - Mobilden gelen Google idToken
 * @returns {Promise<object>} payload: { sub, email, name, picture, email_verified, ... }
 * @throws Geçersiz/süresi dolmuş token veya audience uyuşmazlığında hata fırlatır.
 */
async function verifyGoogleIdToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_WEB_CLIENT_ID,
  });
  return ticket.getPayload();
}

module.exports = { verifyGoogleIdToken, GOOGLE_WEB_CLIENT_ID };
