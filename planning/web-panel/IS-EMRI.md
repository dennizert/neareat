# İŞ EMRİ — Eatlas Web Paneli ve iyzico Ödemesi

Tarih: 2026-11-27 · Hazırlayan: Genel Müdür · Durum: kullanıcı cevapları bekleniyor (aşağıda "Kullanıcıya sorulacak")

> Not: Depo herkese açık ve `docs/` GitHub Pages'ten yayınlanıyor. Bu dosya master'a girerse herkese açık olur. Gizli bilgi içermiyor, ama iç planın yayınlanmasını istemiyorsan dosyayı `docs/` dışına (ör. depo kökünde `plans/`) taşıyın.

**Hedef:** Restoran sahibinin bütün işleri (ödeme dahil) ve admin yönetimi giriş yapılan bir web panelinden yürüsün. Ödeme iyzico abonelik API'siyle alınsın ve web'de ödeme yapan restoran mobilde aktif abone sayılsın. Mobil uygulamada restoran tarafı günlük işlere iner, admin paneli kalkar, Play satın alma kaldırılır.

**Başarı ölçütü:**
- (1) Restoran web'de giriş yapıp mobildeki bütün restoran işlemlerini yapabiliyor.
- (2) Admin bütün admin işlemlerini web'de 2FA ile yapabiliyor.
- (3) iyzico ile ödeme yapan restoranın `Subscription` kaydı `active` oluyor ve mobil bunu aynı API'den görüyor. Yenileme, başarısız ödeme ve iptal webhook ile doğru işleniyor.
- (4) Mobilde Play satın alma kodu, Paywall ve web ödemesine işaret eden hiçbir buton, bağlantı ya da metin (bildirim metinleri dahil) yok.
- (5) Faz 1 ile Faz 4 arasındaki her faz master'a tek başına çıkabiliyor ve mevcut mobil sürümü bozmuyor.

**Büyüklük:** Büyük, 6 faz (Faz 0 hazırlık, Faz 1-5 canlıya çıkabilir).

**Çağrı bütçesi** (düzeltme turu dahil üst sınır):

| Faz | Çağrı |
|---|---|
| Faz 0 | 3 |
| Faz 1 | 8+1 |
| Faz 2 | 7+1 |
| Faz 3 | 8+1 |
| Faz 4 | 6+1 |
| Faz 5 | 4 |
| **Toplam** | **36 + en çok 4 düzeltme = 40** |

Bu, önceki ölçümle (6 çağrı ≈ 500 bin token) kabaca 3-3,5 milyon token eder.

**Düzeltme turu:** Faz başına en fazla 1. İkinci tur yalnızca kritik veya yüksek bulguda açılır.

**Kapsam dışı:**
- Kullanıcı premium'u ve kullanıcı tarafı ödeme (seviye sistemi aynen kalır)
- iOS / App Store
- Otomatik e-fatura entegrasyonu (ayrı iş, bkz. K3)
- Pazarlama sitesi, SEO, reklam
- Yıllık plan, kupon, çoklu şube veya çoklu restoran hesabı
- Restoran için yeni özellik (web'e yalnızca mevcut işlevler taşınır)
- #415 dışındaki bağımlılık yükseltmeleri

---

## Fazlar ve bağımlılıklar

```
Faz 0 (hazırlık) ─► Faz 1 (web + giriş + restoran paneli) ─► Faz 2 (admin web)
                                   └──────────────► Faz 3 (iyzico, prod'da kapalı) ─► Faz 5 (canlı ödeme + zorunluluk)
                  Faz 1 + Faz 2 tamam ─► Faz 4 (mobil sadeleştirme + Play release)
```

- Faz 2 ile Faz 3 paralel yürüyebilir.
- Faz 4, Faz 3'ü beklemez. Gerekçe: abonelik zorunluluğu (`ENFORCE_RESTAURANT_SUBSCRIPTION`) kapalı olduğu için ödeme yolunun bir süre olmaması kimseyi pasifleştirmez.
- Faz 5, iyzico canlı üye işyeri onayına ve kullanıcı onayına bağlıdır.

---

## Faz 0 — Hazırlık (canlıya kod çıkmaz) · bütçe 3

Adımların üçü paralel yürür.

1. `yazilim-mimari` — **Bütün program için tek ADR** (`planning/web-panel/ADR-001.md`).
   - Web yığını ve paket yeri (ADR-001 kararı: `neareat-backend/web/`).
   - Barındırma seçenekleri: (a) Railway'deki mevcut Express aynı origin'den servis eder, (b) ayrı statik barındırma + `api.eatlastr.com` özel alan adı. Her biri maliyet ve hesap ihtiyacıyla yazılır.
   - Web oturumu: httpOnly + Secure çerez, CSRF koruması, oturum süresi ve iptali. Mevcut 7 günlük, iptal edilemeyen JWT web için uygun mu?
   - Railway alan adındaki üçüncü taraf çerez sorunu.
   - CORS (`ALLOWED_ORIGINS`) değişikliği.
   - Google girişinin web'de çalışması (ADR-001: Google Identity Services; backend ham Google idToken doğruluyor).
   - Admin 2FA (TOTP) tasarımı.
   - iyzico tasarımı: resmi `iyzipay` Node paketi abonelik uçlarını kapsıyor mu, kapsamıyorsa imzalı REST. Checkout form, callback, webhook imza doğrulaması, idempotency, sırasız olay (NEW-B01 `lastEventAt` dersi), kart güncelleme, iptal.
   - `Subscription` veri modeli genişlemesi: `provider` (GOOGLE_PLAY | APP_STORE | IYZICO), iyzico referans kodları. `PurchaseEvent` defterinin sağlayıcıdan bağımsız hale gelmesi.
   - Trial ile ödeme ilişkisi (K4 cevabına göre).
   - Kabul kriteri: her konu için seçilen yol, reddedilen seçenek ve tek cümle gerekçe var. Kullanıcı kararı gerektirenler (para, hesap, DNS) "kullanıcı kararı" diye ayrı işaretli. Kart verisinin hiçbir koşulda sunucumuza gelmediği akış çizilmiş (iyzico barındırılan form, PCI SAQ-A).
2. `ui-tasarimci` — Web paneli arayüz kiti ve prototipi (`planning/web-panel/tasarim/`, HTML/CSS).
   - Mevcut `lezzet-renk-sistemi.css` ve Eatlas markası temel alınır.
   - Ekranlar: giriş, şifre sıfırlama, restoran paneli iskeleti (yan menü), rezervasyonlar, doluluk, abonelik/ödeme sayfası, admin iskeleti.
   - Kabul kriteri: telefon genişliğinde çalışıyor, açık ve koyu tema var, frontend'in doğrudan kullanabileceği bileşen listesi var.
3. `icerik-yazari` — Yasal ve kurumsal sayfa taslakları.
   - Sayfalar: abonelik koşulları, mesafeli hizmet sözleşmesi ve ön bilgilendirme, iptal ve iade politikası, KVKK aydınlatma eki (ödeme verisi ve iyzico'ya aktarım), iletişim ve şirket bilgileri sayfası.
   - Şirket bilgileri yer tutucuyla bırakılır (K2).
   - Kabul kriteri: iyzico üye işyeri başvurusunun istediği sayfaların hepsi var. Her sayfada "hukukçu veya mali müşavir onayı bekliyor" notu var.
   - Neden Faz 0: iyzico canlı başvurusu sitenin yayında olmasını ve bu sayfaları ister. Başvuru günler, belki haftalar sürer. Erken başlamazsa Faz 5 takvimi kayar.

Bu fazda kod incelemesi ve test yok, çünkü çıktısı belge. ADR'yi koordinatör okur. ADR kullanıcı kararına dokunuyorsa ya da seçenekler arasında net üstünlük yoksa konu kullanıcıya gider. Yalnızca teknik bir anlaşmazlık çıkarsa `genel-mudur` devreye girer.

---

## Faz 1 — Web temeli, giriş ve restoran paneli · bütçe 8 (+1 düzeltme)

Bu faz canlıya kendi başına çıkar. Mobil hiç değişmez: restoran sahibi aynı işleri hem mobilde hem web'de yapabilir.

1. `is-analisti` — Faz 1 analizi ve GitHub issue'ları. Plan adımı da bu çağrıdadır; faz planı bu iş emrinde hazır.
   - Girdi: bu dosya, ADR, prototip, `neareat-backend/src/routes/restaurantAccount.js`, `auth.js`, mobil `screens/restaurant-account/*`.
   - Kabul kriteri: mobildeki her restoran işlemi için bir web karşılığı issue'su var. Kapsam: kayıt + vergi levhası (K7'ye göre), bilgiler, saatler, kapasite, menü, foto, yorum yanıtı, indirim, kampanya, analitik, rapor, doluluk, rezervasyon onay/red/katılım. Her issue'da kabul kriteri var.
2. Paralel:
   - `backend-gelistirici` — web oturum uçları (çerez, CSRF, çıkış, oturum iptali), CORS, ADR'nin istediği servis veya barındırma değişikliği.
   - `frontend-gelistirici` — `neareat-backend/web/` (ADR-001): giriş, şifre sıfırlama, Google girişi, restoran panelinin tüm ekranları, CI derleme ve yayın adımı.
   - Kabul kriteri:
     - Mevcut backend testleri değişmeden yeşil.
     - Lint sıfır hata.
     - Web için en az bir E2E yolculuk var: giriş, rezervasyon onayı, çıkış.
     - Mobil istemci etkilenmiyor: Bearer akışı aynen çalışıyor.
   - ADR ayrı barındırma seçerse `devops-muhendisi` 1 çağrıyla eklenir: alan adı, yayın hattı, gizli anahtarlar. Bu durumda bütçe 9 olur. Frontend işi tek çağrıya sığmazsa bu çağrı ikinci frontend turuna gider; ikisi birden gerekirse koordinatör bana döner.
3. Paralel:
   - `test-muhendisi` — issue kabul testleri.
   - `kod-inceleme-uzmani` — PR incelemesi.
   - `performans-ve-guvenlik-testcisi` — oturum, CSRF, CORS, IDOR (bir restoranın başka restoranın verisine erişimi), oturum sabitleme, brute force ve rate limit.
4. `is-analisti` — kabul, issue'ları kapatma, faz sonu durum satırı.

**Denetim:** Kullanıcıya dönük ve kimlik doğrulamaya dokunan kod. Bu yüzden test, kod incelemesi ve güvenlik testinin üçü de zorunlu.

**Canlıya çıkış:** Master'a merge kullanıcı onayıyla yapılır (Railway otomatik deploy eder). DNS kayıtlarını kullanıcı girer.

---

## Faz 2 — Admin paneli web · bütçe 7 (+1)

Ekip: `is-analisti` → `backend-gelistirici` ∥ `frontend-gelistirici` → `test-muhendisi` ∥ `kod-inceleme-uzmani` ∥ `performans-ve-guvenlik-testcisi` → `is-analisti` (kabul).

**Kapsam:** `routes/admin.js` altındaki bütün işlemlerin web karşılığı:
- istatistik, metrik, analitik özeti
- restoran başvurusu, vergi levhası, onay/red
- kullanıcı askıya alma
- yorum ve şikâyet moderasyonu
- elle job tetikleme
- yer talepleri
- abonelik görünümü (Faz 3 sonrası dolar)

**Zorunlu güvenlik:**
- Admin için TOTP 2FA.
- Kısa oturum.
- Her admin işlemi denetim kaydına (`logSecurityEvent`) yazılır.
- `/admin/seed` ucu yeniden değerlendirilir.
- `requireAdmin` route seviyesinde kalır (S22-1 kuralı).

Mobil admin bu fazda kalkmaz; Faz 4'e kadar paralel çalışır.

---

## Faz 3 — iyzico abonelik ödemesi (prod'da bayrakla kapalı) · bütçe 8 (+1)

Ekip: `is-analisti` → `backend-gelistirici` ∥ `frontend-gelistirici` → `test-muhendisi` ∥ `kod-inceleme-uzmani` ∥ `performans-ve-guvenlik-testcisi` → `is-analisti` (kabul).

**Backend:**
- `Subscription.provider` ve migration. Migration idempotent ve geriye uyumlu olur; mevcut Play kayıtları `GOOGLE_PLAY` olarak işaretlenir.
- iyzico servisi: ürün ve fiyat planı, checkout form başlatma, callback.
- Webhook: imza doğrulama, idempotent, sırasız olaya dayanıklı.
- Yenileme, başarısız ödeme ve tolerans (K5), dönem sonu iptal, kart güncelleme.
- `PurchaseEvent` defterine iyzico olayları.
- `isRestaurantActive` sağlayıcıdan bağımsız çalışır.
- Bayrak: `IYZICO_ENABLED`. Prod'da kapalı, staging/sandbox'ta açık.
- E-posta ile makbuz, başarısız ödeme ve trial bitiş bildirimi (Resend). Web bağlantısı yalnızca e-postada olur.

**Web:** Abonelik sayfası (durum, sonraki çekim, ödeme geçmişi, iptal, kart güncelleme), iyzico barındırılan formu, Faz 0 yasal sayfalarının yayını.

**Test:** Sandbox'ta uçtan uca:
- başarılı ödeme
- ~~3DS~~ (iyzico aboneliğinde 3DS yok — ADR-001) → 1 TL kart doğrulaması + PENDING→aktifleştirme testleri
- reddedilen kart
- yenileme webhook'u
- aynı webhook'un iki kez gelmesi
- sırasız webhook
- iptal
- tolerans süresi bitişi

**Güvenlik:**
- Webhook taklidi ve tekrar gönderimi (replay).
- Başka restoranın aboneliğini değiştirme (IDOR).
- Fiyatın istemciden değiştirilmesi: fiyat yalnızca sunucudaki plandan gelir.
- Kart verisinin loglara ya da DB'ye girmemesi.
- TCKN/VKN gibi kişisel verinin saklanmaması veya en az veriyle saklanması.

---

## Faz 4 — Mobil sadeleştirme ve Play release · bütçe 6 (+1)

Ekip: `is-analisti` → `mobil-gelistirici` → `test-muhendisi` ∥ `kod-inceleme-uzmani` → `yayin-ve-surum-yoneticisi` (Sonnet: Play kontrol listesi, BILLING izninin kaldırılması, Data safety, sürüm notu) → `is-analisti` (kabul).

**Kapsam:**
- `expo-iap`, `PaywallScreen` ve `premiumGate` içindeki Paywall yolu kaldırılır.
- Restoran yığını rezervasyonlar ve doluluk ekranlarına iner (K8). Dashboard'daki trial sayacının "1.299,90 yenileme" çağrısı kaldırılır; yerine nötr bir bilgi gelir, ör. "Aboneliğiniz aktif değil."
- Admin yığını kalkar. Admin rolüyle mobilde giriş yapan kişi nötr bir bilgi ekranı görür.
- Kalan "premium olabilirsin" metinleri temizlenir. Örnek: `screens/restaurant/RestaurantDetailScreen.tsx:216`.
- Backend: `jobs/subscriptionReminders.js` uygulama içi bildirim metni şu an aboneliği başlatmaya çağırıyor, fiyat yazıyor ve `screen: 'Paywall'` veriyor. Bu metin nötr hale gelir; ödeme çağrısı yalnızca e-postada kalır.
- Issue #505 "iptal: Play satın alma kaldırıldı" notuyla kapatılır.
- Kabul kriteri: mobil kaynakta ve backend'in mobile giden bildirim metinlerinde "web", alan adı, "abone ol", "ödeme" ve fiyat aranır; yasaklı yönlendirme sıfır. `tsc`, lint ve jest yeşil.

**Backend Play uçları:** Kaldırılmaz. RTDN, mevcut Play aboneleri bitene kadar çalışmaya devam eder (K6). Eski APK'larda satın almayı Play Console'daki ürün pasifleştirmesi durdurur; bunu kullanıcı yapar.

**Güvenlik testi atlandı:** Bu faz kod kaldırıyor, yeni veri ya da kimlik doğrulama yüzeyi açmıyor.

---

## Faz 5 — Canlı ödeme ve abonelik zorunluluğu · bütçe 4

Ekip: `backend-gelistirici` → `test-muhendisi` → `izleme-ve-destek-uzmani` (Sonnet) → `is-analisti` (kabul ve program kapanış durumu).

**Backend:**
- S19-1 öncesinde onaylanmış ve aboneliği olmayan restoranlara trial verilir (K9).
- Canlı iyzico anahtarları yalnızca Railway env'de tutulur.
- `IYZICO_ENABLED` prod'da açılır.
- `ENFORCE_RESTAURANT_SUBSCRIPTION` açılış planı hazırlanır.

**Test:** Staging'de zorunluluk açıkken kontrol edilir: trial'lı ve aktif restoran görünür, aboneliği bitmiş restoran görünmez.

**İzleme:** Ödeme ve webhook hata alarmları (S16-2 metrikleri), başarısız ödeme runbook'u.

**Açma kararları:**
- Her iki bayrağın açılışı kullanıcı onayıyla yapılır.
- Restoranlara duyuru e-postası dışarıya mesajdır; metin kullanıcı onayından geçer.

---

## Denetim

Her canlı fazda test ve kod incelemesi var. Auth, admin ve ödeme içeren Faz 1-3'te güvenlik testi de var. Faz 0 belge olduğu için tek okuma yeterli. Faz 4'te yeni yüzey açılmıyor, bu yüzden test ve inceleme yeterli. Faz 5 yapılandırma ve backfill olduğu için test ve izleme yeterli. Para, kimlik doğrulama ve kişisel veri içeren her fazda bağımsız güvenlik testi şartı karşılanıyor.

## Atlananlar

| Atlanan | Gerekçe |
|---|---|
| `proje-yoneticisi` plan | Faz planı bu iş emrinde hazır. Faz sonu durumunu kabul çağrısındaki `is-analisti` yazar. Program sonunda gerekirse 1 Sonnet çağrısı yapılır. |
| `yazilim-muduru` ADR onayı | Mimarın kararlarını kod incelemesi ve güvenlik testi bağımsız denetliyor. Ayrı onay, aynı belgeyi ikinci kez okumak olur. |
| `proje-yonetimi-muduru`, `test-muduru`, `tasarim-muduru` | Tek ürün, takvim çakışması yok. Test kapsamı ve tasarım kapsamı bu emirde. |
| `veritabani-uzmani` | Şema değişikliği küçük (birkaç kolon ve enum). Migration'ı backend geliştirici yazar, kod incelemesi denetler. |
| `ux-arastirmaci` | Akışlar mobilde zaten var; web'e taşınıyor, yeniden tasarlanmıyor. |
| Pazarlama departmanı | Restoranların web'i nasıl öğreneceği kapsam dışı. Mobilde bağlantı olmayacağı için duyuru e-postayla yapılır (Faz 5). |

---

## Riskler

1. **Google Play politikası.** Uygulama içinde ödemeye işaret eden tek bir metin, buton ya da bildirim uygulamanın reddedilmesine veya kaldırılmasına yol açabilir. Gözden kaçabilecek yerler: trial hatırlatma bildirimi (bugün doğrudan Paywall'a yönlendiriyor) ve sunucudan gelen hata mesajları. Önlem: Faz 4'teki metin taraması ve yayın kontrol listesi.
2. **Çerez ve alan adı.** API `*.up.railway.app` adresinde kalırsa web oturum çerezi üçüncü taraf çerez sayılır ve tarayıcılar engeller. Önlem: aynı origin ya da `api.eatlastr.com`. Her ikisi de DNS işlemi ister ve bunu kullanıcı yapar.
3. **iyzico onay süresi ve abonelik modülü.** Canlı başvuru gecikirse Faz 3 prod'da kapalı bekler. Abonelik ürünü canlı hesapta ayrıca açtırılmak zorunda olabilir; bunu sandbox hesabı açılırken iyzico'ya sormak gerekir. Önlem: yasal sayfalar Faz 0'da yazılıyor.
4. **Para akışında hata.** Çift çekim, kaçırılan webhook ya da sırasız bir olayın aktif aboneliği düşürmesi. Önlem: idempotency anahtarı, `lastEventAt` kuralı, defter, günlük mutabakat (iyzico'dan abonelik durumunu çekme; ADR'de değerlendirilir).
5. **Kişisel veri ve vergi.** iyzico müşteri kaydı TCKN/VKN ve fatura adresi isteyebilir; bu KVKK aydınlatmasının güncellenmesini gerektirir. iyzico fatura kesmez, fatura yükümlülüğü bizde kalır (K3). Yasal metinleri ajanlar taslak olarak yazar; geçerliliği hukukçu veya mali müşavir onaylar.
6. **Admin yüzeyinin internete açılması.** Önlem: 2FA, kısa oturum, rate limit, denetim kaydı ve Faz 2 güvenlik testi.
7. **Mevcut Play aboneleri ve eski APK'lar.** Ürünler pasifleştirilmezse eski sürümden satın alma sürer. Önlem: K6'ya göre ürün pasifleştirme ve RTDN'in korunması.
8. **Zorunluluğun açılması.** Bayrak açılınca aboneliği olmayan restoranlar sessizce görünmez olur. Önlem: önce backfill trial ve duyuru, sonra açılış (Faz 5, kullanıcı onayı).
9. **Bu dosyanın herkese açık yayını.** `docs/` GitHub Pages'te yayınlanıyor (yukarıdaki not).

---

## Kullanıcıya sorulacak (kullanıcı kararı)

Her soruda önerim de yazılı.

**K1 — Alan adı ve barındırma**
`eatlastr.com` DNS'ini kim yönetiyor? Kök alan adında şu an site var mı? Web için `panel.eatlastr.com`, API için `api.eatlastr.com` açılabilir mi? DNS kayıtlarını sen girersin.
Öneri: Ücretli yeni barındırma açılmasın. Önce mevcut Railway servisi (aynı origin) ya da ücretsiz statik barındırma denensin. Ücret veya yeni hesap gerekirse ayrıca onay istenir.

**K2 — iyzico hesapları ve şirket bilgileri**
iyzico sandbox hesabını sen açar mısın (hesap açma sende)? Canlı başvuru ne zaman yapılacak? Şirket türü ve bilgileri ne: unvan, adres, VKN, MERSİS, iletişim? Bunlar yasal sayfalar için gerekli.
Öneri: Faz 0 biter bitmez sandbox açılsın. Canlı başvuru yasal sayfalar yayına çıkınca yapılsın.

**K3 — KDV ve fatura**
1.299,90 TL KDV dahil mi? Fatura nasıl kesilecek?
Öneri: İlk aşamada mali müşavir elle kessin. Otomatik e-arşiv entegrasyonu ayrı bir iş olsun.

**K4 — Trial sırasında abone olan restoran**
Kart hemen mi çekilsin, trial sonunda mı?
Öneri: Trial sonunda çekilsin, kalan trial günleri korunsun. Trial için kart şartı olmasın; mevcut 15 günlük kartsız trial sürsün.

**K5 — Başarısız ödeme, iptal ve iade**
Öneri:
- Başarısız ödemede 3 gün tolerans.
- İptal edilen abonelik dönem sonuna kadar aktif kalsın.
- Kısmi iade olmasın.

**K6 — Canlıdaki Play aboneleri**
Canlıda Play üzerinden aktif `restaurant_premium` veya `user_premium` aboneliği var mı?
Öneri: Varsa süreleri bitene kadar tanınsın, yenilemeleri kapatılsın. Faz 4 sürümünden sonra Play Console'daki ürünleri sen pasifleştir.

**K7 — Restoran kaydı ve mobilde web'e referans**
Restoran kaydı (başvuru ve vergi levhası) web'e mi taşınsın? Mobilde web paneline ödeme dışı bir amaçla da olsa hiç referans olmasın mı?
Öneri: Kayıt web'e taşınsın ve mobildeki kayıt ekranı kalksın. Mobilde web'e hiç referans olmasın: ödeme içeren bir siteye yönlendirme, Play incelemesinde ödeme yönlendirmesi sayılabilir. Restoranlara web adresi e-posta ve doğrudan iletişimle verilsin.

**K8 — Mobildeki "günlük işler"in sınırı**
Öneri: Yalnızca rezervasyon listesi, onay/red, katılım işaretleme ve doluluk kalsın (kararın birebir uygulaması). Yorum yanıtı ve anlık indirim web'e gitsin. Yorum yanıtının veya anlık indirimin mobilde kalmasını istiyorsan şimdi söyle; sonradan eklemek bir mobil sürüm daha demek.

**K9 — Zorunluluğun açılışı**
`ENFORCE_RESTAURANT_SUBSCRIPTION` ne zaman açılsın? Aboneliği olmayan eski onaylı restoranlara yeni bir 15 günlük trial verilsin mi?
Öneri: Canlı ödeme açıldıktan sonra herkese 15 gün yeni trial ve bir duyuru e-postası gitsin; bayrak trial bitiminde açılsın. E-posta metnini sen onaylarsın.

**K10 — Merge ve push onayı**
Her fazın master'a merge'i canlıya çıkış demek.
Öneri: Faz başına bir onay.

## Ekip kararı (kullanıcıya sorulmaz)

- Web yığını, SPA ya da SSR seçimi, paket yapısı
- Oturum yöntemi (çerez, CSRF), CORS
- Test araçları, CI adımları
- iyzico SDK ya da REST seçimi, webhook ve veri modeli tasarımı
- Arayüz kiti
- Admin 2FA zorunluluğu (güvenlik, ödün verilmeyenler arasında)
- Kart verisinin sunucuya hiç gelmemesi (barındırılan form zorunlu)

Barındırma, ücretsizse ve yeni hesap gerektirmiyorsa ekip kararıdır; değilse K1 kapsamında kullanıcıya gider.

## Eksik yetenek

Yok.
- Ödeme entegrasyonu `backend-gelistirici` ile `yazilim-mimari`nin alanında.
- Play politikası ve sürüm `yayin-ve-surum-yoneticisi`nin alanında.
- Yasal metin taslağı `icerik-yazari`nin alanında.

Hukuki ve vergisel geçerlilik ajanla çözülecek bir iş değil, insan uzman onayı gerektiriyor (K3, risk 5). Yeni bir "hukuk" ajanı bu riski azaltmaz.

## Kullanıcı kararları — 2026-11-27

Kullanıcı K1–K10'un tamamında öneriyi kabul etti.

- **K1:** Ücretli yeni barındırma açılmaz. Öncelik **(a) mevcut Railway Express'in web'i aynı origin'den servis etmesi** (DNS ve üçüncü taraf çerez sorunu gerektirmez). Alt alan adı (`panel.`/`api.eatlastr.com`) ancak (a) teknik olarak yetmezse; o durumda DNS kaydını kullanıcı girer ve ayrıca sorulur. DNS'i kimin yönettiği henüz bilinmiyor.
- **K2:** Sandbox Faz 0 bitince kullanıcı tarafından açılır; canlı başvuru yasal sayfalar yayına çıkınca. Şirket bilgileri yer tutucu.
- **K3:** Fatura ilk aşamada mali müşavirden elle; e-arşiv entegrasyonu kapsam dışı. KDV durumu yasal sayfada yer tutucu.
- **K4:** Trial kartsız; abone olan restoranda kart trial sonunda çekilir, kalan günler korunur.
- **K5:** 3 gün tolerans · dönem sonu iptal · kısmi iade yok.
- **K6:** Varsa Play aboneleri süre bitene kadar tanınır; Play Console ürünlerini kullanıcı Faz 4 sonrası pasifleştirir.
- **K7:** Restoran kaydı web'e taşınır; mobilde web'e hiçbir referans yok.
- **K8:** Mobilde yalnızca rezervasyon listesi, onay/red, katılım işaretleme ve doluluk.
- **K9:** Canlı ödemeden sonra herkese 15 gün yeni trial + duyuru e-postası (metni kullanıcı onaylar); bayrak trial bitiminde.
- **K10:** Faz başına bir merge onayı.

Not: İş emri `docs/` (GitHub Pages) yerine `planning/web-panel/` altına taşındı — planlama belgeleri herkese açık sitede yayınlanmasın.
