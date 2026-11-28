# FAZ 1 ANALİZİ — Web temeli, giriş ve restoran paneli

Tarih: 2026-11-28 · Yazan: `is-analisti` · Girdi: `IS-EMRI.md` (Faz 1 + "Kullanıcı kararları — 2026-11-27"), `ADR-001.md`, `tasarim/BILESENLER.md`, `routes/restaurantAccount.js`, `routes/auth.js`, `routes/reservations.js`, mobil `screens/restaurant-account/*`, `screens/reservations/ReservationDetailScreen.tsx`, `navigation/index.tsx`.

Bağlayıcı çerçeve: web `neareat-backend/web/` altında, Railway Express aynı origin'den `/panel/*` servis eder; web oturumu çerez + DB oturumu (`__Host-eatlas_sid`), CSRF token + Origin kontrolü, Google girişi Google Identity Services (ADR-001 #1-#8). K7: restoran kaydı web'e taşınır. K8: mobilde ileride yalnızca rezervasyon/doluluk kalır (o sadeleştirme Faz 4'tür).

**Mobil kod bu fazda değişmez.** Restoran sahibi Faz 1 boyunca aynı işleri hem mobilde hem web'de yapabilir; mobilin Bearer akışı, uç sözleşmeleri ve hata gövdeleri aynen kalır. Bu kural bütün issue'lar için geçerlidir ve issue'larda tekrar yazılmaz.

---

## 1. Kullanıcı türleri

| Tür | Web'de Faz 1'de ne yapar |
|---|---|
| Restoran adayı (hesabı yok) | Web'den başvuru yapar (5 adım). |
| Restoran — başvurusu inceleniyor (`PENDING`) | Giriş yapar, yalnızca "Başvurunuz inceleniyor" ekranını görür, çıkış yapar. |
| Restoran — reddedilmiş (`REJECTED`) | Giriş yapar, red nedenini görür, çıkış yapar. |
| Restoran — onaylı (`APPROVED`) | Panelin tamamı. Aboneliği yoksa abonelik kapılı işlemler `SUBSCRIPTION_REQUIRED` ile kilitli görünür. |
| Normal kullanıcı (`USER`) | Web'e giremez; genel bir mesajla reddedilir, oturum açılmaz. |
| Admin (`ADMIN`) | Faz 1'de web girişi yok (Faz 2, 2FA ile). Restoran giriş formu admin'i de genel mesajla reddeder. |
| Mobil istemci | Etkilenmez. Bearer istekleri çerez/CSRF kontrollerinden muaftır. |

## 2. Mobil restoran işlemi ↔ web karşılığı

Mobil restoran yığını (`navigation/index.tsx`, `role === 'RESTAURANT'`): Dashboard, Hours, Menu, Discount, Campaign, Analytics, Reviews, Info, Reservations, Occupancy, ReservationDetail, Notifications (+ Paywall, Faz 3). Kayıt ve bekleme ekranı oturum öncesi yığında.

| # | Mobil ekran / işlem | Kullanılan backend ucu (değişmez) | Web ekranı (Faz 1) | Issue grubu |
|---|---|---|---|---|
| 1 | `RestaurantRegisterScreen` — hesap, işletme bilgileri, vergi no (10 hane), vergi dairesi, telefon, iletişim e-postası, adres, kategori, vergi levhası, Google kaydı seçimi, KVKK/gizlilik onayı | `POST /api/restaurant-account/register` (açık), `GET /api/restaurants/nearby`, `GET /api/places/search` (opsiyonel auth) | Başvuru (5 adım, `kayit.html`) | Restoran kaydı |
| 2 | `RestaurantPendingScreen` — inceleniyor / reddedildi + red nedeni | `GET /api/restaurant-account/me` (`status`, `rejectionReason`) | Başvuru durumu ekranı | Restoran kaydı |
| 3 | Dashboard — özet sayılar, bekleyen rezervasyon uyarısı, trial sayacı, menü kısayolları | `GET /me`, `GET /stats`, `GET /api/reservations/restaurant`, `GET /api/subscriptions` | Genel bakış (`panel.html`) | Rezervasyonlar + doluluk |
| 4 | Reservations — durum sekmeleri, liste, öncelikli kullanıcı rozeti (L3+), bekleyenlerde öncelik sırası | `GET /api/reservations/restaurant?status=` | Rezervasyonlar (`rezervasyonlar.html`) | Rezervasyonlar + doluluk |
| 5 | Onay — rezerve koltuk (varsayılan `guestCount`, 1-5000) | `PUT /api/reservations/:id/status` `{status:'CONFIRMED', reservedSeats}` | Onay modalı | Rezervasyonlar + doluluk |
| 6 | Red — neden zorunlu | `PUT /api/reservations/:id/status` `{status:'REJECTED', rejectionReason}` | Red modalı | Rezervasyonlar + doluluk |
| 7 | Katılım — Geldi / Gelmedi | `PUT /api/reservations/:id/attendance` `{attended}` | Katılım onayı | Rezervasyonlar + doluluk |
| 8 | ReservationDetail — detay + kullanıcıyla mesajlaşma | `GET /api/reservations/:id`, `GET/POST /api/reservations/:id/messages` | Rezervasyon detayı | Rezervasyonlar + doluluk |
| 9 | Occupancy — tarih seçici, saat bazlı doluluk bandı | `GET /api/restaurant-account/occupancy?date=` | Doluluk (`doluluk.html`) | Rezervasyonlar + doluluk |
| 10 | Notifications — liste, okundu işaretleme, tümünü okundu | `GET /api/notifications`, `GET /unread-count`, `PUT /:id/read`, `PUT /read-all` | Bildirimler (üst çubuk zili + liste) | Rezervasyonlar + doluluk |
| 11 | Info — görünen ad, masa kapasitesi, alternatif telefon vb. | `GET /me`, `PUT /api/restaurant-account/info` | Bilgiler | İşletme |
| 12 | Info — koltuk kapasitesi (1-5000) | `PUT /info` `{seatCapacity}` | Bilgiler (kapasite alanı) | İşletme |
| 13 | Info — restoran ve ürün foto galerileri (en çok 8'er, JPEG/PNG/WebP, 5 MB) | `POST /photos/upload-url`, depoya doğrudan yükleme, `POST /photos`, `GET /photos`, `DELETE /photos/:id` | Fotoğraflar | İşletme |
| 14 | Hours — haftalık çalışma saatleri | `PUT /hours` | Çalışma saatleri | İşletme |
| 15 | Menu — menü öğesi yükleme (en çok 10, 3 MB) ve silme | `POST /menu`, `DELETE /menu/:itemId` | Menü | İşletme |
| 16 | Reviews — yorum listesi, yanıt yazma (500 karakter, içerik filtresi), yanıt silme | `GET /reviews`, `POST/DELETE /reviews/:reviewId/reply` | Yorumlar | Büyüme |
| 17 | Discount — kalıcı indirim; anlık indirim aç/kapat (%1-80, 30-1440 dk) | `PUT /discount`, `POST /discount/activate`, `DELETE /discount/deactivate` | İndirim | Büyüme |
| 18 | Campaign — hedef kitle (favoriler/rezervasyon yapanlar/hepsi), mesaj 5-200 karakter, günde 1 | `POST /campaign` | Kampanya | Büyüme |
| 19 | Analytics — rezervasyon trendi, yoğun saatler, durum dağılımı, puan dağılımı | `GET /analytics` | Analitik | Büyüme |
| 20 | Analytics — haftalık iş raporu (AI özet, yedekli şablon) | `GET /report` | Analitik (rapor kartı) | Büyüme |
| 21 | Çıkış | (mobil: token silme) | Çıkış + tüm cihazlardan çıkış | Web giriş |

Uçların hiçbiri yeniden tasarlanmaz; web aynı uçları çerez oturumuyla çağırır. Abonelik kapısı (`isRestaurantActive`) ve hata gövdeleri (`SUBSCRIPTION_REQUIRED`, `OVERBOOKING`, red nedeni mesajı vb.) aynen gösterilir.

Mobilde olup web'e **taşınmayanlar** (bilinçli):
- `PUT /announcement`: backend'de var ama mobilde ekranı yok → yeni özellik sayılır, kapsam dışı (iş emri "restoran için yeni özellik yok").
- Paywall / satın alma: Faz 3 (iyzico). Faz 1'de trial sayacı gösterilir, ödeme düğmesi yoktur.
- Bildirim tercihleri ve FCM token: mobil cihaza özgü, web'de yok.

## 3. Ana akışlar

**A. Giriş (e-posta):** `/panel/giris` → e-posta + şifre → başarılıysa oturum çerezi kurulur → `/panel` (onaylı) ya da başvuru durumu ekranı (PENDING/REJECTED). Hatalı şifre, yanlış rol, askıya alınmış hesap, 429 ayrı mesaj gösterir.
**B. Giriş (Google):** Google düğmesi → Google kimlik belgesi → backend doğrular → yalnızca **mevcut** RESTAURANT hesabıyla eşleşirse oturum açılır. Web Google girişi **hesap oluşturmaz** (mobil `POST /api/auth/login` eşleşmeyen e-postada USER yaratıyor; web'de bu yol kapalı olmalı, aksi halde web'den başıboş USER hesapları doğar).
**C. Şifre sıfırlama:** `/panel/sifre-sifirla` → e-posta → hesap var/yok aynı mesaj → e-postadaki bağlantı RESTAURANT/ADMIN için `/panel/sifre-sifirla?token=`, USER için mevcut uygulama bağlantısı → yeni şifre + tekrar → başarı → kullanıcının bütün web oturumları iptal.
**D. Başvuru:** Hesap → İşletme → Vergi levhası → Google kaydı seçimi (konum izni veya metinle arama) → Özet + KVKK/gizlilik onayı → gönder → "inceleniyor" ekranı.
**E. Rezervasyon onayı:** Rezervasyonlar → Bekleyen sekmesi (L3+ üstte) → Onayla → koltuk sayısı (varsayılan kişi sayısı) → onay → satır Onaylı sekmesine geçer, bekleyen rozeti azalır.
**F. Çıkış:** Menüden Çıkış → oturum satırı silinir, çerez temizlenir → `/panel/giris`. "Tüm cihazlardan çıkış" kullanıcının bütün web oturumlarını siler (mobil JWT'ler etkilenmez, ADR §8).

## 4. İş kuralları

1. Web girişi yalnızca RESTAURANT rolüne açıktır (Faz 1). USER ve ADMIN genel bir mesajla reddedilir; oturum açılmaz; mesaj hesabın varlığını ya da rolünü sızdırmaz.
2. Oturum süreleri: restoran 72 saat boşta / 14 gün mutlak (ADR #4). Süresi dolan oturumla yapılan istek 401 döner; web giriş ekranına "Oturumunuzun süresi doldu" mesajıyla yönlendirir.
3. Girişte oturum kimliği yeniden üretilir (sabitleme koruması).
4. Çerezle gelen her durum değiştiren istek geçerli CSRF token'ı **ve** `Origin == PUBLIC_WEB_ORIGIN` ister. Bearer istekleri bu kontrollerden muaftır.
5. Şifre sıfırlama, hesap askıya alma ve hesap silme kullanıcının bütün web oturumlarını iptal eder.
6. Başvuruda doğrulamalar backend ile aynıdır: zorunlu alanlar, şifre 8-128, vergi no 10 hane, e-posta ve vergi no tekil (409). Mesajlar backend metinleriyle birebir.
7. PENDING/REJECTED restoran panel ekranlarına doğrudan URL ile de giremez; başvuru durumu ekranına yönlendirilir.
8. Abonelik kapılı işlemlerde `403 SUBSCRIPTION_REQUIRED` gelirse işlem kilitli gösterilir; Faz 1'de ödeme yönlendirmesi yoktur.
9. Doluluk bandı eşikleri mobil `utils/occupancyBand.ts` ile birebir: <%70 Müsait, %70+ Az yer kaldı, %100 Dolu; kapasite yoksa bant gösterilmez.
10. Para/tarih/saat biçimi BILESENLER.md §3 "Metin ve biçim kuralları".

## 5. Veri alanları (web formlarında)

| Form | Alanlar (zorunluluk backend'deki gibi) |
|---|---|
| Giriş | e-posta, şifre |
| Şifre sıfırlama | e-posta; yeni şifre + tekrar (8-128) |
| Başvuru | e-posta, şifre, yetkili adı, işletme adı, vergi no (10 hane), vergi dairesi, telefon, iletişim e-postası, adres, kategori, vergi levhası dosyası, Google kaydı (placeId/ad/adres/foto, isteğe bağlı), KVKK + gizlilik onayı |
| Rezervasyon onayı | rezerve koltuk (1-5000, varsayılan kişi sayısı) |
| Rezervasyon reddi | red nedeni (zorunlu) |
| Katılım | geldi / gelmedi |
| Rezervasyon mesajı | metin (1-1000) |
| Bilgiler | görünen ad (2-80), masa kapasitesi (1-500), koltuk kapasitesi (1-5000), alternatif telefon (≤20) ve mobil Info ekranındaki diğer alanlar |
| Saatler | haftanın her günü için açılış/kapanış veya kapalı |
| Menü | dosya (izinli türler, ≤3 MB), en çok 10 öğe |
| Foto | galeri türü (restoran/ürün), JPEG/PNG/WebP, ≤5 MB, galeri başına ≤8 |
| Yorum yanıtı | metin (1-500) |
| İndirim | oran (%1-80), süre (30-1440 dk) |
| Kampanya | hedef kitle (favoriler/rezervasyon yapanlar/hepsi), mesaj (5-200) |

## 6. Backend değişiklikleri (Faz 1)

1. **Web oturumu:** `WebSession` kaydı (ADR §5), `POST /api/auth/web/login`, `POST /api/auth/web/google`, `GET /api/auth/web/session` (`{user, csrfToken, mfa:'none'}`), `POST /api/auth/web/logout`, `POST /api/auth/web/logout-all`. `authenticate` önce Bearer'a bakar (davranış değişmez), yoksa oturum çerezine. Web uçları mevcut `authLimiter` ve `/api/auth` 10 kb gövde sınırını miras alır.
2. **CSRF + Origin:** çerezle gelen POST/PUT/PATCH/DELETE için token + Origin kontrolü; Bearer muaf; GET/HEAD/OPTIONS muaf.
3. **CORS / env:** `PUBLIC_WEB_ORIGIN` yeni env; CORS izin listesine eklenir; bilinmeyen origin'e hata davranışı korunur. `validateEnv` üretimde `PUBLIC_WEB_ORIGIN` yoksa açılışı durdurur. (`MFA_ENCRYPTION_KEY` Faz 2'de kullanılır; ADR Faz 1 için zorunlu diyor, zorunluluk Faz 2 issue'suna ertelendi, bkz. varsayım V6.)
4. **Şifre sıfırlama bağlantısı:** e-postadaki bağlantı role göre `/panel/sifre-sifirla?token=` (RESTAURANT/ADMIN) veya mevcut uygulama bağlantısı (USER). Başarılı sıfırlama web oturumlarını iptal eder.
5. **Oturum iptali:** askıya alma ve hesap silme web oturumlarını iptal eder.
6. **`/panel` servis:** Express `web/dist`'i `/panel/*` altında servis eder (SPA yönlendirmesi: bilinmeyen `/panel/...` yolları `index.html`), `index.html` önbelleğe alınmaz, `/panel/assets/*` uzun süreli önbellek; panel'e özel CSP (yalnızca kendi origin + Google Identity + Google Fonts + foto deposu). `/api/*`, `/health`, `/verify-email`, `/reset-password` davranışı değişmez.
7. **Derleme ve CI:** `build` betiği web'i derler; CI'da `web-lint`, `web-typecheck`, `web-test`, `web-build` job'ları. Backend lint/jest `web/`'i yok sayar.
8. **Foto deposu:** tarayıcıdan imzalı URL ile doğrudan yükleme, deponun web origin'ine yükleme izni vermesini gerektirir (mobilde Origin yok, bu sorun mobilde görünmez). Bu canlı altyapı ayarıdır → kullanıcı onayı / işlemi (Soru S2).

## 7. Web E2E yolculuğu (zorunlu, en az bir)

Gerçek tarayıcı, gerçek Postgres (mevcut `tests/e2e` güvenlik kuralı: veritabanı adında `test` yoksa reddet).
1. Tohum: onaylı restoran (e-posta+şifre), bu restorana ait bir PENDING rezervasyon (kullanıcı tarafı mevcut API istemcisiyle oluşturulur).
2. `/panel/giris` → giriş → genel bakışta bekleyen sayısı 1.
3. Rezervasyonlar → Bekleyen → Onayla → koltuk sayısı varsayılan → onay → satır Onaylı sekmesinde; DB'de `status=CONFIRMED`, `reservedSeats` = girilen değer.
4. Çıkış → giriş ekranı; geri tuşu/eski URL ile panel açılmaz; eski çerezle yapılan API isteği 401.
5. Negatif adımlar: CSRF başlığı olmadan onay isteği 403; aynı yolculuk sonunda mobil Bearer ile `GET /api/reservations/restaurant` 200 (Bearer akışı etkilenmedi).

## 8. Hata ve uç durumlar

| Durum | Beklenen |
|---|---|
| Hatalı şifre | Mevcut `login/email` genel mesajı; hangi alanın yanlış olduğu söylenmez; mevcut hesap kilidi kuralları geçerli. |
| USER/ADMIN hesabıyla giriş | Genel ret mesajı, oturum yok. |
| Askıya alınmış hesap | Mevcut askı mesajı, oturum yok. |
| 429 (rate limit) | "Çok fazla deneme, lütfen sonra tekrar deneyin" + düğme geçici kilitli. |
| Google hesabı Eatlas'ta yok / USER | Genel ret; **yeni hesap oluşturulmaz**. |
| Google belgesi geçersiz veya süresi dolmuş | 401, genel mesaj. |
| Oturum süresi doldu / başka sekmede çıkış yapıldı | Sonraki istek 401 → giriş ekranı, mesajla. |
| CSRF token eksik/yanlış, yabancı Origin | 403; web "Sayfayı yenileyip tekrar deneyin" der ve oturum bilgisini yeniden çeker. |
| Başvuruda e-posta veya vergi no kayıtlı | 409 mesajı ilgili adımda gösterilir; doldurulan alanlar kaybolmaz. |
| Vergi levhası büyük/yanlış tür | Gönderimden önce istemcide reddedilir (bkz. V3). |
| Konum izni reddedildi (başvuru) | Metinle restoran arama yolu sunulur; Google kaydı seçmeden de başvurulabilir (backend `placeId` isteğe bağlı). |
| Onaylanacak rezervasyon bu arada mobilde onaylandı/iptal edildi | 400 "Yalnızca bekleyen rezervasyonlar güncellenebilir." gösterilir, liste yenilenir. |
| Katılım zaten işaretli | 400 mesajı, liste yenilenir. |
| Kapasite aşımı (koltuk > boş koltuk) | Uyarı gösterilir, onay engellenmez (mobil davranışı). |
| `SUBSCRIPTION_REQUIRED` | İlgili ekran kilit durumu; ödeme düğmesi yok (Faz 3). |
| Kampanya günde 1 sınırı | 429 mesajı ve bir sonraki uygun zaman (backend ne dönüyorsa). |
| Foto deposu yapılandırılmamış | 503 mesajı ("Fotoğraf yükleme yakında aktifleşecek"). |
| Ağ hatası / 5xx | Hata durumu + "Tekrar dene"; form verisi korunur. |
| Çift tıklama | İşlem sürerken düğme `aria-busy`, ikinci istek gitmez. |
| Panel derlemesi bozuk | CI `web-build` merge öncesi kırmızı olur (canlı deploy bozulmaz). |

## 9. Kapsam dışı (Faz 1)

- Mobil koddaki her değişiklik (kayıt ekranının kaldırılması dahil → Faz 4).
- Admin web girişi ve 2FA (Faz 2), iyzico ödemesi ve abonelik sayfası (Faz 3).
- `PUT /announcement` duyuru ekranı, çoklu şube, yeni restoran özelliği.
- Mobil JWT iptali (ADR §8: ayrı iş).
- Alt alan adı / DNS (K1: önce aynı origin).
- Bildirim tercihleri, push bildirimi web'de.

## 10. Varsayımlar (ekip kararı; raporda belirtildi)

- **V1** Web Google girişi yalnızca mevcut RESTAURANT hesabına bağlanır, hesap oluşturmaz.
- **V2** PENDING/REJECTED restoran web'e giriş yapabilir ve yalnızca durum ekranını görür (mobil davranışının aynası).
- **V3** Vergi levhası web'de JPG/PNG kabul edilir, PDF Faz 1'de kabul edilmez. Gerekçe: mevcut admin incelemesi (mobil) levhayı resim olarak gösteriyor; PDF Faz 2 web admin'iyle birlikte açılabilir. Dosya sınırı, base64 şişmesi sonrası `5mb` gövde sınırına sığacak şekilde istemcide küçültme/sınır ile sağlanır (bkz. S1).
- **V4** Başvuru sonrası web otomatik oturum açar ve "inceleniyor" ekranını gösterir (mobil de token alıp bekleme ekranına geçiyor).
- **V5** Başvuru formundaki KVKK/gizlilik onayı mobildeki yayında olan metinlerin aynısını gösterir; Faz 0 yasal taslakları (ödeme metinleri) Faz 3'e aittir.
- **V6** `MFA_ENCRYPTION_KEY` zorunluluğu Faz 2'ye ertelenir (Faz 1'de kullanan kod yok; zorunlu tutmak canlı açılışı gereksiz bir env'e bağlar). ADR'den sapmadır, Faz 2 issue'sunda kapatılır.
- **V7** Trial sayacı web genel bakışta gösterilir, "abone ol" düğmesi Faz 3'te eklenir.
- **V8** Web E2E yolculuğu CI'da ayrı job olarak koşar; mevcut `backend-e2e` job'ı ve test sayıları değişmez.

## 11. Kullanıcıya Sorular

Yalnızca kullanıcı kararı/işlemi gerektirenler. Her birinde varsayım var; cevap gelene kadar varsayımla devam edilir.

- **S1 — Vergi levhası PDF.** GİB'den indirilen vergi levhası genelde PDF'tir. Faz 1'de web başvurusu yalnızca JPG/PNG mi kabul etsin (admin bugün mobilden inceliyor, PDF'i gösteremiyor), yoksa PDF de alınsın ve admin onu Faz 2 web panelinden mi incelesin?
  Varsayım: Faz 1'de yalnızca JPG/PNG; PDF Faz 2 ile.
- **S2 — Foto deposu (S3) ayarı.** Web'den fotoğraf yükleyebilmek için canlı depoda web adresine yükleme izni (CORS kuralı) açılması gerekiyor. Bu canlı altyapı değişikliği: ayarı siz mi yapacaksınız, yoksa ekip hazırlayıp onayınıza mı sunsun? Ayrıca canlıda foto deposu şu an yapılandırılmış mı?
  Varsayım: Ekip kuralı hazırlar, siz uygularsınız; yapılana kadar web'de foto yükleme "yakında" durumu gösterir, diğer işler beklemez.
- **S3 — Google Cloud ve Railway env (işlem, karar değil).** Web'de Google girişi için mevcut OAuth web istemcisine Railway adresinin "Authorized JavaScript origins" olarak eklenmesi (ADR KK-4) ve Railway'e `PUBLIC_WEB_ORIGIN` + `ALLOWED_ORIGINS` eklenmesi (KK-5) sizin işleminiz. Merge'den önce yapabilir misiniz?
  Varsayım: Merge onayıyla birlikte yapılır; yapılmazsa web'de Google girişi çalışmaz, e-postayla giriş çalışır.

## 12. Backlog (GitHub, etiket `faz1-web` + `backlog`)

| Sıra | Issue | Alan | Bağımlı |
|---|---|---|---|
| 1 | #524 Backend: web oturumu | backend | — |
| 1 | #531 Web: iskelet, kabuk, API katmanı, korumalı yönlendirme | frontend | (#524 sözleşmesi) |
| 2 | #525 Backend: CSRF/Origin, CORS, sıfırlama bağlantısı, oturum iptali | backend | #524 |
| 2 | #526 Backend: `/panel` servis, CSP, build, CI web job'ları | backend, ci | #531 |
| 3 | #527 Web: giriş, Google, şifre sıfırlama, çıkış | frontend | #524 #525 #531 |
| 4 | #529 Web: genel bakış, rezervasyonlar, doluluk, bildirimler | frontend | #527 |
| 4 | #528 Web: restoran başvurusu + durum ekranı | frontend | #527 |
| 4 | #530 Web: bilgiler, kapasite, saatler, menü, foto | frontend | #527 |
| 4 | #532 Web: yorum yanıtı, indirim, kampanya, analitik, rapor | frontend | #527 |
| 5 | #533 Test: web E2E (giriş → onay → çıkış) | frontend, testing | #526 #529 |
