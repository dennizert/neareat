/**
 * Oturum Politikası — A01/A02/A04 (issue #451)
 *
 * Saf karar fonksiyonları: ağ, store ve navigation'dan bağımsız, doğrudan test edilir.
 *
 * NEDEN AYRI BİR DOSYA: bu kararlar yanlış olduğunda hata VERMEZLER, sessizce yanlış
 * davranırlar — kullanıcı sebepsiz çıkış yapmış olur. Bu tür mantığın ekran/interceptor
 * içine gömülmesi, doğrudan test edilememesi demekti.
 */

/** Axios benzeri hata nesnesinden HTTP durum kodunu çıkarır (yoksa null). */
function statusOf(error: any): number | null {
  const status = error?.response?.status;
  return typeof status === 'number' ? status : null;
}

/**
 * Sunucu kimliği AÇIKÇA reddetti mi?
 *
 * Yalnızca 401/403 bu anlama gelir. Ağ hatası, zaman aşımı ve 5xx "bilmiyoruz"
 * demektir — kimlik bilgisinin geçersizliğine dair kanıt değildir.
 */
export function isAuthInvalid(error: any): boolean {
  const status = statusOf(error);
  return status === 401 || status === 403;
}

/**
 * Hata geçici mi (yeniden denemeye değer mi)?
 *
 * Yanıt hiç gelmediyse (ağ/offline), zaman aşımıysa veya sunucu 5xx döndüyse evet.
 * 4xx hayır — istek yeniden denenerek düzelmez.
 */
export function isTransientFailure(error: any): boolean {
  if (error?.code === 'ECONNABORTED') return true; // axios timeout
  const status = statusOf(error);
  if (status == null) return true; // yanıt yok → ağ/offline
  return status >= 500;
}

/**
 * Açılıştaki kimlik sorgusu başarısız oldu — KALICI kimlik bilgisi silinmeli mi?
 *
 * ESKİ DAVRANIŞ: `catch { clearStoredToken() }` — her hata siliyordu. Zayıf sinyalde
 * uygulamayı açmak, token gayet geçerliyken çıkış yaptırıyordu (A04). Bulgular
 * arasında en sık tetiklenen buydu.
 */
export function shouldClearCredential(error: any): boolean {
  return isAuthInvalid(error);
}

/**
 * Açılış kimlik sorgusu için yeniden deneme kararı. Saf.
 *
 * @param attempt 1 tabanlı deneme sırası (ilk çağrı = 1)
 */
export function shouldRetryAuthProbe(error: any, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false;
  return isTransientFailure(error);
}

/**
 * 401 yanıtı GÜNCEL oturuma mı ait?
 *
 * A02: interceptor yalnızca "biri giriş yapmış mı" diye bakıyordu, isteğin HANGİ
 * oturuma ait olduğuna bakmıyordu. A çıkıp B girdikten sonra A'nın uçuştaki isteği
 * 401 dönünce B çıkarılıyordu.
 *
 * Damgasız istek (interceptor'dan geçmemiş, ör. doğrudan axios çağrısı) GÜNCEL
 * sayılır: aksi hâlde gerçek bir oturum sonlanması sessizce yutulur ve kullanıcı
 * çalışmayan bir arayüzde kalırdı. Yanlış tarafa düşmemek için güvenli varsayılan
 * budur — kaçırılmış bir çıkış, yanlış kullanıcının çıkarılmasından daha kötü.
 */
export function isCurrentSession(
  requestSessionId: number | undefined | null,
  currentSessionId: number,
): boolean {
  if (requestSessionId == null) return true;
  return requestSessionId === currentSessionId;
}
