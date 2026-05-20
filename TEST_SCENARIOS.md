# NearEat — Kapsamlı Test Senaryoları

Proje kapsayan test tipleri: **Birim (Unit)**, **Entegrasyon (Integration)**, **Uçtan-Uca (E2E)**, **Güvenlik**, **Sınır Değer (Boundary)**.
Aykırı (negatif/edge case) senaryolar her bölümde ✗ ile işaretlenmiştir.

---

## Test Altyapısı

| Katman | Framework | Konum |
|---|---|---|
| Backend birim | Jest | `neareat-backend/tests/unit/` |
| Backend entegrasyon | Jest + Supertest | `neareat-backend/tests/integration/`, `tests/api.test.js` |
| Frontend store | Jest | `neareat-mobile/src/__tests__/stores/` |
| Frontend E2E | Detox (önerilen) | Kurulum gerektirir |

---

## 1. Kimlik Doğrulama (Auth)

### 1.1 Kayıt (Register)
| # | Senaryo | Beklenen | Tip |
|---|---|---|---|
| 1 | Geçerli email, şifre, displayName ile kayıt | 201 + user + token | Happy |
| 2 | Eksik displayName | 400 | ✗ Negatif |
| 3 | Eksik email | 400 | ✗ Negatif |
| 4 | Geçersiz email formatı (`abc@`) | 400 | ✗ Negatif |
| 5 | 8 karakterden kısa şifre | 400 "8-128" | ✗ Sınır |
| 6 | 128 karakterden uzun şifre | 400 | ✗ Sınır |
| 7 | Tam 8 karakter şifre | 201 | Sınır |
| 8 | Zaten kayıtlı email | 409 Conflict | ✗ Negatif |
| 9 | Body 10KB'ı aşıyor | 413 veya 400 | ✗ Sınır |
| 10 | SQL injection içeren email (`' OR 1=1--`) | 400 (Prisma parametrize) | ✗ Güvenlik |
| 11 | XSS içeren displayName (`<script>alert(1)</script>`) | Sanitize edilmiş değer kaydedilir | ✗ Güvenlik |

### 1.2 Email ile Giriş (Login)
| # | Senaryo | Beklenen |
|---|---|---|
| 12 | Doğru email + şifre | 200 + token |
| 13 | Yanlış şifre | 401 |
| 14 | Kayıtlı olmayan email | 401 |
| 15 | Eksik email veya şifre | 400 |
| 16 | Askıya alınmış hesap | 403 |
| 17 | Rate limit: 20 denemeden fazla (15 dk içinde) | 429 |

### 1.3 Token Doğrulama (GET /api/auth/me)
| # | Senaryo | Beklenen |
|---|---|---|
| 18 | Geçerli JWT token | 200 + user |
| 19 | Token yok | 401 |
| 20 | Bozuk token (`Bearer invalid`) | 401 |
| 21 | Süresi dolmuş token | 401 |
| 22 | Başka kullanıcıya ait imzalanmış token | 401 |
| 23 | Askıya alınmış kullanıcının tokeni | 403 |

### 1.4 Hesap Silme (DELETE /api/auth/account)
| # | Senaryo | Beklenen |
|---|---|---|
| 24 | Token ile hesap silme | 200 |
| 25 | Token olmadan | 401 |
| 26 | Silme sonrası aynı token → geçersiz | 401 |

---

## 2. Restoran Keşfi (Restaurants)

### 2.1 Yakın Restoranlar (GET /api/restaurants/nearby)
| # | Senaryo | Beklenen |
|---|---|---|
| 27 | Geçerli lat/lng → restoran listesi | 200 + array |
| 28 | Premium kullanıcı → geniş radius (25km) | 200 + daha fazla sonuç |
| 29 | Ücretsiz kullanıcı → dar radius (5km) | 200 + sınırlı alan |
| 30 | lat/lng olmadan | 400 |
| 31 | Geçersiz lat (`lat=999`) | 400 |
| 32 | Geçersiz lng (`lng=999`) | 400 |
| 33 | Geçerli type parametresi (restaurant/cafe/bar) | 200 |
| 34 | Geçersiz type | 400 |
| 35 | Redis cache: aynı istek → cache'den döner | 200 (hızlı) |
| 36 | Google Places API hatası | 503 veya 500 |

### 2.2 Restoran Detayı (GET /api/restaurants/:placeId)
| # | Senaryo | Beklenen |
|---|---|---|
| 37 | Geçerli placeId + auth | 200 + detay |
| 38 | Auth olmadan | 401 |
| 39 | Var olmayan placeId | 404 |
| 40 | Redis cache hit | 200 (hızlı) |

---

## 3. Favoriler (Favorites)

| # | Senaryo | Beklenen |
|---|---|---|
| 41 | Favori listeleme (boş) | 200 + [] |
| 42 | Favori listeleme (dolu) | 200 + array |
| 43 | Ücretsiz kullanıcı: limit altında favori ekleme | 201 |
| 44 | Ücretsiz kullanıcı: limit (3) aşıldığında | 403 PREMIUM_REQUIRED |
| 45 | Premium kullanıcı: limitsiz ekleme | 201 |
| 46 | Eksik placeId | 400 |
| 47 | Eksik placeName | 400 |
| 48 | Eksik koordinat | 400 |
| 49 | Aynı placeId iki kez ekleme → upsert | 201 (idempotent) |
| 50 | Favori silme | 200 |
| 51 | Var olmayan favori silme | 200 (no-op) |
| 52 | Auth olmadan | 401 |

---

## 4. Yorumlar (Reviews) & İçerik Moderasyonu

### 4.1 CRUD
| # | Senaryo | Beklenen |
|---|---|---|
| 53 | Yorum oluşturma: geçerli rating + body | 201 + yıldız ödülü |
| 54 | Yorum oluşturma: rating 1 (minimum) | 201 |
| 55 | Yorum oluşturma: rating 5 (maximum) | 201 |
| 56 | Yorum oluşturma: rating 0 | 400 |
| 57 | Yorum oluşturma: rating 6 | 400 |
| 58 | Eksik body | 400 |
| 59 | Aynı yere ikinci yorum → günceller (upsert) | 201 |
| 60 | Yorumu güncelleme (owner) | 200 |
| 61 | Yorumu güncelleme (başkası) | 403 |
| 62 | Yorum silme (owner) | 200 |
| 63 | Yorum silme (başkası) | 403 |

### 4.2 İçerik Filtresi
| # | Senaryo | Beklenen |
|---|---|---|
| 64 | Temiz metin | 201 |
| 65 | Türkçe küfür içeren body | 400 CONTENT_POLICY |
| 66 | İngilizce küfür | 400 |
| 67 | Leetspeak bypass denemesi (`s1kt1r`) | 400 |
| 68 | Büyük harf bypass (`FUCK`) | 400 |
| 69 | HTML içinde gizlenmiş küfür → sanitize + filter | 400 veya sanitize sonrası temiz |
| 70 | Türkçe ek eklenmiş kelime (`siktirsin`) | 400 |

---

## 5. Abonelik (Subscription)

| # | Senaryo | Beklenen |
|---|---|---|
| 71 | Abonelik yokken GET | 200 + null |
| 72 | Aktif abonelik GET | 200 + { status: 'active' } |
| 73 | Trial başlatma (yeni kullanıcı) | 201 + { status: 'trial' } |
| 74 | Trial başlatma (zaten aboneliği var) | 400 |
| 75 | Checkout: geçerli plan tipi (monthly/yearly) | 200 + form token |
| 76 | Checkout: geçersiz plan tipi | 400 |
| 77 | Süresi dolmuş trial → isPremium false | Doğrulama: premium özellikler 403 verir |
| 78 | Webhook: geçerli Iyzico payload | 200 |
| 79 | Webhook: geçersiz payload formatı | 400 |

---

## 6. Sosyal Özellikler (Social)

### 6.1 Arkadaşlık
| # | Senaryo | Beklenen |
|---|---|---|
| 80 | Arkadaş listesi (boş) | 200 + [] |
| 81 | Arkadaş isteği gönderme (geçerli kullanıcı) | 201 |
| 82 | Kendine istek gönderme | 400 |
| 83 | Var olmayan kullanıcıya istek | 404 |
| 84 | Zaten arkadaş olunmuşa istek | 409 |
| 85 | Bekleyen isteği kabul etme | 200 |
| 86 | Bekleyen isteği reddetme | 200 |
| 87 | Var olmayan isteği kabul etme | 404 |
| 88 | Başkasının isteğini kabul etme | 403 |
| 89 | Arkadaşlıktan çıkarma | 200 |
| 90 | Arkadaş olmayan birden çıkarma | 404 |
| 91 | Bekleyen istek listesi | 200 |

### 6.2 Kullanıcı Arama
| # | Senaryo | Beklenen |
|---|---|---|
| 92 | Geçerli arama sorgusu | 200 + kullanıcılar |
| 93 | Boş sorgu | 200 + [] |
| 94 | Yalnızca USER rolü döner (ADMIN, RESTAURANT hariç) | 200 + sadece users |
| 95 | Kendi hesabı sonuçlarda yok | Sonuçlarda bulunmaz |
| 96 | Herkese açık olmayan hesap | Sonuçlarda bulunmaz (isPublic=false) |

### 6.3 Öneri (Recommendation)
| # | Senaryo | Beklenten |
|---|---|---|
| 97 | Arkadaşa restoran önerme | 201 + yıldız ödülü |
| 98 | Arkadaş olmayan birine öneri | 403 |
| 99 | Kendine öneri | 400 |
| 100 | Gelen önerileri listeleme | 200 |
| 101 | Gönderilen önerileri listeleme | 200 |

### 6.4 Liderlik Tablosu
| # | Senaryo | Beklenen |
|---|---|---|
| 102 | Liderlik tablosu (top 5 + sıram) | 200 + { top5, myRank } |
| 103 | Auth olmadan | 401 |

---

## 7. Mesajlaşma (Messages)

| # | Senaryo | Beklenen |
|---|---|---|
| 104 | Okunmamış mesaj sayısı | 200 + { count: N } |
| 105 | Konuşma listesi | 200 + conversations |
| 106 | Mesaj geçmişi (sayfalama) | 200 + { messages, hasMore, nextCursor } |
| 107 | Arkadaşa mesaj gönderme | 201 + message |
| 108 | Kendine mesaj gönderme | 400 |
| 109 | Arkadaş olmayan birine mesaj | 403 |
| 110 | Boş mesaj içeriği | 400 |
| 111 | 2000 karakterden uzun mesaj | 400 veya kırpma |
| 112 | Küfür içeren mesaj | 400 CONTENT_POLICY |
| 113 | Per-user rate limit (60 req/dk) | 429 |

---

## 8. Profil (Profile)

| # | Senaryo | Beklenen |
|---|---|---|
| 114 | Kendi profili getirme | 200 + stats |
| 115 | Başka kullanıcının profili | 200 (public) veya 403 (private) |
| 116 | Var olmayan kullanıcı | 404 |
| 117 | Profil güncelleme (displayName) | 200 |
| 118 | Profil güncelleme (photoUrl) | 200 |
| 119 | Küfürlü bio güncelleme | 400 CONTENT_POLICY |
| 120 | Auth olmadan | 401 |

---

## 9. Koleksiyonlar (Collections)

| # | Senaryo | Beklenen |
|---|---|---|
| 121 | Premium kullanıcı: koleksiyon oluşturma | 201 |
| 122 | Ücretsiz kullanıcı: koleksiyon oluşturma | 403 PREMIUM_REQUIRED |
| 123 | Boş isim | 400 |
| 124 | 100 karakterden uzun isim | 400 |
| 125 | Kendi koleksiyonlarını listeleme | 200 |
| 126 | Koleksiyon detayı (owner) | 200 + items |
| 127 | Başkasının özel koleksiyonu | 403 |
| 128 | Paylaşılan koleksiyonu görüntüleme | 200 |
| 129 | Koleksiyon güncelleme (owner) | 200 |
| 130 | Koleksiyon güncelleme (başkası) | 403 |
| 131 | Koleksiyon silme (owner) | 200 |
| 132 | Öğe ekleme | 201 |
| 133 | Aynı öğeyi iki kez ekleme (upsert) | 201 (idempotent) |
| 134 | Öğe silme | 200 |
| 135 | Arkadaşla paylaşma | 201 |
| 136 | Arkadaş olmayan biriyle paylaşma | 403 |
| 137 | Kendinle paylaşma | 400 |
| 138 | Paylaşımı kaldırma | 200 |
| 139 | Bana paylaşılan koleksiyonlar | 200 |

---

## 10. Admin Paneli

| # | Senaryo | Beklenen |
|---|---|---|
| 140 | Admin login (doğru bilgiler) | 200 + token |
| 141 | Admin login (yanlış şifre) | 401 |
| 142 | Normal kullanıcı ile admin endpoint | 403 |
| 143 | Platform istatistikleri | 200 + stats |
| 144 | Bekleyen restoran başvuruları | 200 + list |
| 145 | Restoran başvurusu onaylama | 200 + bildirim |
| 146 | Restoran başvurusu reddetme (gerekçesiz) | 400 |
| 147 | Restoran başvurusu reddetme (gerekçeli) | 200 |
| 148 | Kullanıcı listesi | 200 |
| 149 | Kullanıcı askıya alma | 200 |
| 150 | Kendini askıya alma | 400 |
| 151 | Kullanıcı askıyı kaldırma | 200 |
| 152 | Şikayet edilen yorumlar listesi | 200 |
| 153 | Yorum silme (admin) | 200 |
| 154 | Var olmayan yorum silme | 404 |
| 155 | Şikayet listesi | 200 |
| 156 | Şikayet işleme (dismiss/suspend/warn) | 200 |
| 157 | Geçersiz işlem tipi | 400 |
| 158 | Seed: ADMIN_SEED_SECRET ile | 201 (ilk kez) |
| 159 | Seed: Secret olmadan | 503 |
| 160 | Seed: Yanlış secret | 403 |
| 161 | Seed: Admin zaten varken | 409 |

---

## 11. Rezervasyon (Reservations)

### 11.1 Rezervasyon Oluşturma
| # | Senaryo | Beklenen |
|---|---|---|
| 162 | Geçerli rezervasyon isteği | 201 |
| 163 | Eksik placeId | 400 |
| 164 | Eksik reservationDate | 400 |
| 165 | Geçersiz tarih formatı | 400 |
| 166 | Geçmiş tarih | 400 |
| 167 | guestCount = 0 | 400 |
| 168 | guestCount negatif | 400 |
| 169 | guestCount > 50 (maks) | 400 |
| 170 | Aynı restoran + tarih + saat çakışması | 409 |

### 11.2 Rezervasyon Yönetimi
| # | Senaryo | Beklenen |
|---|---|---|
| 171 | Kendi rezervasyonlarımı listeleme | 200 |
| 172 | Rezervasyon detayı (owner) | 200 |
| 173 | Rezervasyon detayı (başkası) | 403 |
| 174 | Var olmayan rezervasyon | 404 |
| 175 | PENDING rezervasyonu iptal etme | 200 |
| 176 | CONFIRMED rezervasyonu iptal etme | 200 |
| 177 | COMPLETED rezervasyonu iptal etme | 400 |
| 178 | Başkasının rezervasyonunu iptal etme | 403/404 |
| 179 | PENDING rezervasyonu güncelleme | 200 |
| 180 | CONFIRMED rezervasyonu güncelleme | 400 |

### 11.3 Restoran Tarafı
| # | Senaryo | Beklenen |
|---|---|---|
| 181 | Restoranıma gelen rezervasyonları görüntüleme | 200 |
| 182 | Normal kullanıcı restoran rezervasyon listesi | 403 |
| 183 | Rezervasyonu onaylama (restoran) | 200 |
| 184 | Rezervasyonu reddetme (restoran) | 200 |
| 185 | Geçersiz status | 400 |
| 186 | CONFIRMED olmayan rezervasyona katılım işareti | 400 |
| 187 | No-show: yıldız cezası (10 yıldız) | Stars düşer |

---

## 12. Restoran Hesabı (Restaurant Account)

| # | Senaryo | Beklenen |
|---|---|---|
| 188 | Restoran kaydı (yeni başvuru) | 201 |
| 189 | Eksik bilgilerle kayıt | 400 |
| 190 | Onay bekleniyor → dashboard | PENDING ekranı |
| 191 | Reddedilmiş → nedeni görüntüleme | REJ ekranı |
| 192 | Onaylanmış → dashboard | 200 |
| 193 | Menü öğesi ekleme | 201 |
| 194 | Menü öğesi silme | 200 |
| 195 | Çalışma saatlerini güncelleme | 200 |
| 196 | Yoruma yanıt verme | 201 |
| 197 | Başka restoranın yorumuna yanıt | 403 |
| 198 | Anlık indirim aktifleştirme | 200 |
| 199 | Anlık indirim deaktifleştirme | 200 |
| 200 | İstatistikler (stats) | 200 |
| 201 | Kendi yorumlarını görüntüleme | 200 |

---

## 13. Bildirimler (Notifications)

| # | Senaryo | Beklenen |
|---|---|---|
| 202 | Bildirim listesi (sayfalama) | 200 + list |
| 203 | Okunmamış sayısı | 200 + { count } |
| 204 | Tek bildirimi okundu işaretleme | 200 |
| 205 | Başkasının bildirimini okundu işaretleme | 404 |
| 206 | Tümünü okundu işaretleme | 200 |
| 207 | FCM token güncelleme | 200 |
| 208 | Boş FCM token | 400 |
| 209 | Auth olmadan | 401 |

---

## 14. Güvenlik & API Gateway

### 14.1 Kimlik Doğrulama Koruması
| # | Senaryo | Beklenen |
|---|---|---|
| 210 | Her korumalı endpoint: token yok → 401 | 401 |
| 211 | Her korumalı endpoint: geçersiz token → 401 | 401 |
| 212 | Askıya alınmış kullanıcı → her istekte 403 | 403 |
| 213 | Başka kullanıcının JWT ile kendi datasına erişim | 403/404 |

### 14.2 Rate Limiting
| # | Senaryo | Beklenen |
|---|---|---|
| 214 | Auth endpoint: 21+ istek (15 dk) → 429 | 429 |
| 215 | Genel API: 121+ istek (1 dk) → 429 | 429 |
| 216 | Per-user: 61+ istek (1 dk) → 429 | 429 |
| 217 | 429 sonrası bekleme → istek geçer | 200 |

### 14.3 Input Sanitizasyonu
| # | Senaryo | Beklenen |
|---|---|---|
| 218 | `<script>` tag içeren body → sanitize | HTML kaldırılır |
| 219 | `__proto__` key içeren JSON | Key yok sayılır |
| 220 | `constructor` key içeren JSON | Key yok sayılır |
| 221 | Çok büyük payload (> 5MB) | 413 |

### 14.4 CORS
| # | Senaryo | Beklenen |
|---|---|---|
| 222 | Origin header olmayan istek (mobil) | 200 |
| 223 | İzin verilmeyen Origin | CORS error |
| 224 | X-Request-ID response header mevcut | Her yanıtta bulunur |

### 14.5 Admin Seed Koruması
| # | Senaryo | Beklenen |
|---|---|---|
| 225 | ADMIN_SEED_SECRET env var yok | 503 |
| 226 | Yanlış secret header | 403 |
| 227 | Doğru secret + admin yokken | 201 |
| 228 | Doğru secret + admin varken | 409 |

---

## 15. Yardımcı Fonksiyonlar (Utils) — Birim Testler

### 15.1 haversineKm
| # | Senaryo | Beklenen |
|---|---|---|
| 229 | Aynı nokta → 0 km | 0 (floating point toleransı) |
| 230 | İstanbul → Ankara | ~352 km (±5 km) |
| 231 | Simetri: d(A,B) == d(B,A) | Eşit |
| 232 | Antipodal noktalar | ~20015 km |
| 233 | Sıfır koordinatlar | 0 |

### 15.2 JWT
| # | Senaryo | Beklenen |
|---|---|---|
| 234 | signToken → string döner | string |
| 235 | verifyToken(valid) → { sub: userId } | Doğru |
| 236 | verifyToken(tampered) | JsonWebTokenError |
| 237 | verifyToken(expired) | TokenExpiredError |
| 238 | verifyToken(empty) | Hata |
| 239 | Token süresi: 7 gün | exp - iat ≈ 604800 |

### 15.3 getLevel (Stars)
| # | Senaryo | Beklenen |
|---|---|---|
| 240 | 0 yıldız → Seviye 1 | { level: 1, badge: 'Yeni Kaşif' } |
| 241 | 10 yıldız → Seviye 2 | { level: 2 } |
| 242 | 25 yıldız → Seviye 3 | { level: 3 } |
| 243 | 50 yıldız → Seviye 4 | { level: 4 } |
| 244 | 100 yıldız → Seviye 5 | { level: 5 } |
| 245 | Sınır altı değerler (9, 24, 49, 99) | Bir alt seviye |

### 15.4 isActivePremium
| # | Senaryo | Beklenen |
|---|---|---|
| 246 | null | false |
| 247 | status: 'active', gelecek tarih | true |
| 248 | status: 'trial', gelecek tarih | true |
| 249 | status: 'active', geçmiş tarih | false |
| 250 | status: 'cancelled' | false |
| 251 | Tam şu an (new Date()) | false |

### 15.5 containsOffensiveContent
| # | Senaryo | Beklenen |
|---|---|---|
| 252 | Temiz metin | false |
| 253 | null / undefined / number | false |
| 254 | Türkçe küfür (siktir) | true |
| 255 | İngilizce küfür (fuck) | true |
| 256 | Büyük harf (FUCK) | true |
| 257 | Leetspeak (s1kt1r) | true |
| 258 | Türkçe ek (siktirsin) | true |
| 259 | Küfürlü cümle (f*ck → fck ≠ fuck) | false (bu özel durum belgelenmiştir) |

---

## 16. Frontend Store — Birim Testler

### 16.1 authStore
| # | Senaryo | Beklenen |
|---|---|---|
| 260 | Başlangıç: user=null, token=null | Doğru |
| 261 | setUser() → kullanıcı güncellenir | Doğru |
| 262 | isPremium(): abonelik yok → false | false |
| 263 | isPremium(): aktif abonelik, gelecek → true | true |
| 264 | isPremium(): süresi dolmuş → false | false |
| 265 | logout() → tüm state temizlenir | State reset |
| 266 | setRestaurantStatus() | restaurantStatus güncellenir |

### 16.2 messageStore
| # | Senaryo | Beklenen |
|---|---|---|
| 267 | Başlangıç: conversations=[], unreadCount=0 | Doğru |
| 268 | updateConversationAfterSend() → yeni konuşma ekler | Eklenir |
| 269 | updateConversationAfterSend() → var olan güncellenir | Güncellenir |
| 270 | markConversationRead() → unreadCount azalır | Azalır |
| 271 | markConversationRead() → 0'ın altına inmez | ≥0 |
| 272 | clear() → sıfırlanır | [] ve 0 |

### 16.3 favoriteStore
| # | Senaryo | Beklenen |
|---|---|---|
| 273 | addFavorite() → array büyür | +1 |
| 274 | removeFavorite() → placeId bulunup silinir | -1 |
| 275 | isFavorite(): mevcut placeId | true |
| 276 | isFavorite(): olmayan placeId | false |

### 16.4 themeStore
| # | Senaryo | Beklenen |
|---|---|---|
| 277 | Başlangıç: isDark=false | false |
| 278 | toggle() → true | true |
| 279 | toggle() iki kez → false | false |
| 280 | setDark(true) | true |
| 281 | setDark(false) → tekrar false | false |

---

## 17. Middleware — Birim Testler

| # | Senaryo | Beklenen |
|---|---|---|
| 282 | requestId: header yoksa UUID oluşturur | UUID formatı |
| 283 | requestId: X-Request-ID ≤64 karakter → kullanır | Aynı değer |
| 284 | requestId: >64 karakter → UUID oluşturur | Farklı UUID |
| 285 | sanitize: HTML siler | Tag yok |
| 286 | sanitize: __proto__ key'i yok sayar | Key eksik |
| 287 | requireAdmin: USER role → 403 | 403 |
| 288 | requireAdmin: ADMIN role → next() | next çağrılır |
| 289 | requireRestaurant: RESTAURANT → next() | next çağrılır |
| 290 | securityLogger: console.warn çağrılır | Çağrılır |
| 291 | securityLogger: JSON formatında | Parse edilebilir |

---

## 18. E2E Test Senaryoları (Detox / Manuel)

Bu senaryolar kurulmuş Detox ortamı veya manuel test gerektirir.

| # | Akış | Adımlar |
|---|---|---|
| 292 | Tam kullanıcı akışı | Kayıt → Giriş → Restoran keşfet → Favori ekle → Yorum yaz |
| 293 | Sosyal akış | İki kullanıcı → Arkadaş isteği → Kabul → Mesaj gönder |
| 294 | Rezervasyon akışı | Restoran seç → Rezervasyon oluştur → Restoran onaylar → Kullanıcı katılır |
| 295 | Premium akış | Trial başlat → Premium özellik kullan → Süre dol → Ücretli geçiş |
| 296 | Dark mode | Profil → Dark mode toggle → Tüm ekranlar kontrol |
| 297 | Admin moderasyon | Admin giriş → Yorum şikayet → Şikayeti işle → Kullanıcıya bildirim |
| 298 | Restoran onay akışı | Kayıt → Admin onay → Dashboard erişim |
| 299 | Çevrimdışı | İnternet kes → Uygulama aç → Hata yönetimi kontrol |
| 300 | Push bildirim | Arkadaş isteği → Bildirim geldi → Bildirime tıkla → Doğru ekran |

---

## Toplam Test Sayısı

| Kategori | Senaryo Sayısı |
|---|---|
| Auth | 26 |
| Restaurant Discovery | 14 |
| Favorites | 12 |
| Reviews + Content Filter | 18 |
| Subscriptions | 9 |
| Social Features | 22 |
| Messages | 10 |
| Profile | 7 |
| Collections | 19 |
| Admin | 22 |
| Reservations | 26 |
| Restaurant Account | 14 |
| Notifications | 8 |
| Security & API Gateway | 19 |
| Utils (Unit) | 30 |
| Frontend Stores (Unit) | 22 |
| Middleware (Unit) | 10 |
| E2E | 9 |
| **TOPLAM** | **297** |

---

## Otomatik Test Çalıştırma

```bash
# Backend — tüm testler
cd neareat-backend
npm test

# Backend — yalnızca birim testler
npm test -- tests/unit

# Backend — yalnızca entegrasyon testler
npm test -- tests/integration

# Frontend — store testler (paketler kurulduktan sonra)
cd neareat-mobile
npm install
npm run test:stores
```

---

## AI Yemek Önerisi Senaryoları (Sprint-1, 2026-05-20)

### Mutlu yol — Free kullanıcı
1. HomeScreen aç → header altında "🤖 Bu akşam ne yesem?" turuncu banner görünüyor
2. Banner tıkla → RecommendationScreen açılır, empty state "🤔 Mood'unu seç..."
3. "🍽️ Önerileri Getir" tıkla → "Konum alınıyor…" → "Öneriler hazırlanıyor…" → 3 RecommendationCard
4. Her kartta: sıra numarası, restoran adı + mutfak (Türkçe humanize), meta row (★/oy/mesafe/fiyat), "🤖 Neden bu?" reason box, "Detayları gör →"
5. Tier rozeti: "Ücretsiz" + "Bugün kalan hak: 2/3"
6. "Detayları gör" → RestaurantDetail açılır

### Mood seçimi
1. 6 mood chip (Hızlı/Şık/Romantik/Aile/Sağlıklı/Bütçeli) görünüyor
2. "Şık" tıkla → turuncu border + dolgu
3. Tekrar tıkla → deselect
4. Mood opsiyonel — seçim olmadan da CTA enabled

### Free tier limit aşımı (otomatik paywall)
1. Free user bugün 3 öneri kullanmış (AiRecommendationLog'da 3 row)
2. "Önerileri Getir" → backend 429 LIMIT_EXCEEDED
3. **Otomatik PremiumUpsellScreen modal açılır** (useRef ile transition detect)
4. ⏰ Hero + "Günlük AI öneri hakkın doldu" + countdown card "X saat Y dakika"
5. 4 premium feature: ♾️ Limitsiz / 🧠 Sonnet 4.6 / 👥 Arkadaş sinyalleri / ⚡ Hız
6. "✨ Premium Detaylarını Gör" → mevcut Paywall (Iyzico checkout)
7. "Bugün için kapat" → goBack, RecommendationScreen'e dön
8. "Önerileri Getir" tekrar tıkla → modal AÇILMAZ (transition false→true değil; ref ile blocked)

### Premium kullanıcı
1. Subscription active + expiresAt > now (veya trial)
2. Tier rozeti: "✨ Premium" (sarı badge)
3. remainingToday = null (sonsuz)
4. Model = Sonnet 4.6 (response.model)
5. 100 ardışık call → her zaman 200

### Expired subscription edge case
1. Subscription status='active' AMA expiresAt geçmiş
2. `isActivePremium()` false döner
3. Tier = free, limit 3 uygulanır

### Aday bulunamama
1. Google Places boş döner VEYA tüm sonuçlar rating<3.5 / openNow=false
2. Backend 404 NO_CANDIDATES
3. "📍 Yakında uygun restoran yok" inline error
4. Anthropic API çağrılmaz (cost saving)

### Halüsinasyon filtresi
1. LLM aday listede olmayan placeId döndürür (uydurma)
2. Backend `candidatesByPlaceId.has(rec.placeId)` check → silsiz atar
3. AiRecommendationLog.suggestedPlaceIds sadece geçerli ID'ler
4. UI'da sahte kart yok

### Profile opt-in toggle (arkadaş paylaşımı)
1. Profile aç → "🤖 AI Öneri Paylaşımı" satırı (Dark Mode toggle ile aynı style)
2. Alt başlık + gizlilik notu görünüyor
3. Switch aç → optimistic UI + PUT /profile/me { shareWithFriendsRecommender: true }
4. Uygulamayı kapat/aç → switch hâlâ açık (getMyProfile yükler)
5. Offline'da toggle → rollback + Alert

### Prompt caching doğrulama (smoke)
1. `node neareat-backend/scripts/smoke-recommender-cache.js`
2. Call 1: cacheWrite=5977, cacheRead=0
3. 5dk içinde Call 2: cacheRead=5977 (1:1 match)
4. Maliyet: $0.0127 → $0.0061 (%52 tasarruf)
5. Profile determinism check: aynı user 2× build → identical bytes

### Dark mode uyumu
1. Profile → "🌙 Karanlık Mod" aç
2. RecommendationScreen, RecommendationCard, PremiumUpsellScreen, HomeScreen CTA banner — tüm renkler dark theme'e döner
3. Primary turuncu aynı kalır, surface/text/border tema değişkenleri günceller

### Sınır validasyonları (backend)
1. lat=100 → 400 "Geçersiz koordinat"
2. lat="41.04" string → 400 "lat ve lng zorunlu (number)"
3. mood=12345 → 400 "mood string olmalı"
4. mood 100 char → trim + 50 char kesilir
5. mood "   " whitespace → null
6. No auth → 401
7. Malformed Bearer → 401
