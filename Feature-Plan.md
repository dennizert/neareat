# NearEat — Geliştirme ve Yeni Özellik Analiz Raporu

---

## BÖLÜM 1 — GELİŞTİRİLMESİ GEREKEN ALANLAR

### 1.1 AI Öneri Motoru

**Mevcut durum:** Tek-adım öneri + SSE streaming mevcut. Kullanıcı bir istek gönderir, Claude yanıt verir, biter.

**Sorunlar:**
- Thumbs-up/down geri bildirimi toplanıyor ancak modeli etkilemiyor; loglarda duruyor
- Kullanıcı sonuçları beğenmezse baştan başlamak zorunda (refinement yok)
- Haiku (ücretsiz) / Sonnet (premium) ayrımı vardır ama hiçbir A/B testi yoktur; hangi modelin daha iyi sonuç verdiği bilinmiyor
- Arkadaş sosyal sinyalleri her öneri çağrısında tüm arkadaşların verisi döngüyle çekiliyor — büyüyen sosyal grafikle N+1 sorunu

**Önerilen iyileştirmeler:**
- **Konuşmaya dayalı refinement:** Kullanıcı "daha ucuz", "daha yakın", "daha sessiz bir yer" diyebilsin; SSE session ID ile bağlamı tutun
- **Feedback döngüsü:** `RecommendationFeedback` loglarını haftalık aggregate ederek hangi restoran/mutfak türlerinin beğenildiğini sistem prompt'una ekleyin
- **Sosyal sinyal önbelleği:** Arkadaşların favori/yorum verilerini Redis'te 15 dakika cache'leyin (her öneri çağrısında sorgu atmak yerine)

---

### 1.2 Keşif & Arama

**Mevcut durum:** Kategori filtresi (restaurant/cafe/fast food) + harita görünümü var. Restoran adına göre arama yok.

**Sorunlar:**
- Kullanıcı "Tarihi yarımadada pizza yeri" araştırmak istese ne yapacak?
- Filtreler navigasyon değişiminde sıfırlanıyor; aynı filtreyi her seferinde yeniden seçmek gerekiyor
- Google Places kategorileri kaba — "kebap", "deniz ürünleri", "vejetaryen" gibi mutfak tipi filtresi yok

**Önerilen iyileştirmeler:**
- **İsim bazlı arama:** Google Places `findPlaceFromText` API'sini kullanarak serbest metin araması ekleyin
- **Filtre kalıcılığı:** Seçilen filtreleri `restaurantStore`'a yazın, navigasyonda koruyun
- **Mutfak tipi etiketleri:** Google Places `types` verisindeki keywords üzerinden "Türk mutfağı", "deniz ürünleri" gibi etiket grupları oluşturun

---

### 1.3 Rezervasyon Sistemi

**Mevcut durum:** Kullanıcı rezervasyon yapıyor, restoran manuel onaylıyor/reddediyor. Zaman sınırı yok.

**Sorunlar:**
- Restoran yanıt vermezse rezervasyon sonsuza PENDING kalıyor
- Kullanıcı etkinlik günü sabahı iptal edebiliyor — restoran bunu öğrenemiyor
- "Katıldım" işareti tamamen manüel; gerçek attend oranını bilmek imkânsız
- Restoran kapasitesi (masa sayısı) takip edilmiyor; aynı saate 50 rezervasyon alınabiliyor

**Önerilen iyileştirmeler:**
- **Otomatik son yanıt süresi:** Restoran 24 saat içinde yanıt vermezse PENDING → otomatik onay veya bildirim
- **İptal politikası:** Etkinlikten X saat önce iptal için ceza puanı, X saatten sonra iptal yasağı (konfigüre edilebilir)
- **Kapasite yönetimi:** Restaurant modeline `tableCount` alanı ekleyin; aynı zaman diliminde kapasite doluşta yeni rezervasyonu reddedin

---

### 1.4 Bildirim Sistemi

**Mevcut durum:** 11 bildirim türü, Firebase FCM entegrasyonu, 4 cron job mevcut.

**Sorunlar:**
- Kullanıcılar bildirimleri özelleştiremiyor; hepsini alıyor ya da ayar yok
- Bildirimler asla silinmiyor — aktif kullanıcıda yüzlerce birikim olabilir
- Haftalık özet ve hareketsizlik hatırlatması sabit zamanlı; saat dilimi farkı gözetilmiyor
- `LEVEL_UP` bildirim tipi enum'da var ama hiçbir zaman tetiklenmiyor

**Önerilen iyileştirmeler:**
- **Bildirim tercihleri:** Her tür için açık/kapalı toggle (`NotificationPreference` modeli)
- **Otomatik temizlik:** 90 günden eski okunmuş bildirimleri haftalık cron ile archive edin
- **Level-up tetikleyicisi:** `starService`'te yıldız eklendiğinde seviye değişimini kontrol edin ve `LEVEL_UP` bildirimi gönderin

---

### 1.5 Koleksiyonlar

**Mevcut durum:** Premium kullanıcılar koleksiyon oluşturup paylaşabiliyor. Paylaşım sadece görüntüleme amaçlı.

**Sorunlar:**
- Aynı mekan koleksiyona iki kez eklenebiliyor (unique constraint yok)
- Koleksiyonda 50 mekan varsa hepsini listelemek gerek, sıralama/arama yok
- Koleksiyon paylaşımı sadece belirli kişilere — "herkese açık + link paylaşımı" yok

**Önerilen iyileştirmeler:**
- `CollectionItem`'e unique constraint: `(collectionId, placeId)`
- Koleksiyon içi sıralama seçeneği (ekleme tarihi, puan, uzaklık)
- Ortak düzenleme (collaborative) özelliği için `CollectionMember` rolü (editor/viewer)

---

### 1.6 Premium & Ödeme Sistemi

**Mevcut durum:** Iyzico webhook handler minimal. Checkout endpoint var ama incomplete. Trial 7 gün.

**Sorunlar:**
- Iyzico webhook hata yönetimi eksik; ödeme başarısız olsa da subscription active kalabilir
- Ücretsizden premium geçiş izlenmiyor; hangi özellik dönüşümü tetikledi bilinmiyor
- Referral sistemi yok; kullanıcı büyümesi organik

**Önerilen iyileştirmeler:**
- Iyzico webhook'a idempotency key + retry güvenliği ekleyin
- `conversionTrigger` alanı: Kullanıcı hangi ekranda premium'a geçti loglanmalı
- Referral kodu sistemi: Davet eden + davet edilen her ikisi de bonus yıldız kazansın

---

## BÖLÜM 2 — YENİ EKLENEBİLECEK ÖZELLİKLER

---

### 2.1 Sosyal Aktivite Akışı ("Ne Yediler?")

**Tanım:** Arkadaşların son yorum, favori, rezervasyon ve öneri aktivitelerini kronolojik bir akışta gösterme.

**Katacağı değer:**
- Uygulama içi "ısınma" — kullanıcı her açıldığında görecek yeni içerik var
- Arkadaş önerileri pasif değil, aktif ve görünür hale gelir
- Tablo: `ActivityEvent(userId, type, placeId, metadata, createdAt)` — `logService`'i genişlet
- Arkadaş listesini alıp son 7 günün event'lerini tek query ile çekebilirsiniz

---

### 2.2 "Şu An Nereye?" — Anlık Grup Karar Desteği

**Tanım:** Aktif bir arkadaş grubuna "nereye gidelim?" sorusunu atıp, grubun oylamasıyla AI'ın önerdiği restoranı seçme.

**Katacağı değer:**
- Mevcut `MealGroup` + `Poll` altyapısını doğrudan kullanabilirsiniz
- AI önerisini grup profili + voting sonuçlarına göre yapın: "3/4 kişi Kadıköy'de, bütçe orta"
- En yüksek talep segmenti: grup yemeği karar verme ("nereye gideceğiz" tartışması)
- Rakip uygulamalarda bu özellik yok

---

### 2.3 Restoran Analitik Paneli

**Tanım:** Restoran sahibine haftalık rezervasyon trendi, en yoğun saatler, müşteri memnuniyeti puanı, inceleme analizi.

**Katacağı değer:**
- Restoran sahibinin uygulamaya bağlılığını artırır (B2B retention)
- Veri zaten var: `Reservation`, `Review`, `StarEvent`, `UserLog`
- AI özelliği: Claude ile haftalık "işletme raporu" oluşturulabilir ("Bu hafta 5 yorum geldi, 4'ü kahve menüsünden bahsetti")
- Ek gelir kapısı: analitik paketi premium restoran planı olabilir

---

### 2.4 "Yakın Kapanıyor" ve "Yeni Açıldı" Etiketleri

**Tanım:** Keşif ekranında gerçek zamanlı etiketler — "30 dk kapanıyor", "Bu ay açıldı".

**Katacağı değer:**
- FOMO etkisi → tıklama oranı artar
- "30 dk kapanıyor" bildirimi zaten var (`FAVORITE_CLOSING_SOON`) — bunu keşif listesine etiket olarak taşımak küçük bir iş
- Google Places `opening_hours.periods` verisini zaten çekiyorsunuz

---

### 2.5 Fotoğraf Bazlı "Buraya Gitmeye Değer mi?" Analizi

**Tanım:** Kullanıcı Google Maps fotoğraflarından birini seçip "Bu restoran nasıl görünüyor?" diye AI'a sorabilsin.

**Katacağı değer:**
- Claude'un vision yeteneklerini kullanır (`claude-haiku-4-5` multimodal destekliyor)
- Rakip uygulamalarda mevcut değil
- Kullanıcı için "karar verme güvencesi" — fotoğraf gördüm, ama nasıl?
- Implementasyon: `/api/recommendations/analyze-photo` endpoint; base64 image + placeId → Claude vision

---

### 2.6 Kişisel Yemek Günlüğü (Gizli Koleksiyon Türü)

**Tanım:** "Gittiğim yerler" özel koleksiyonu — kullanıcı ziyaretini loglar, tarih + not ekler, istatistik görür.

**Katacağı değer:**
- "Yılda kaç farklı mutfak denedin?", "En çok hangi semtte yemek yedin?" gibi kişisel istatistikler
- Yıl sonu özeti ("Bu yıl 47 restoran ziyaret ettin") → viral paylaşım potansiyeli (Spotify Wrapped tarzı)
- Mevcut `Favorite` + `Collection` altyapısını genişletir; yeni DB modeli minimal

---

### 2.7 Restoran Sahibi — Anlık Kampanya Gönderimi

**Tanım:** Restoran sahibi, o restoranı favorileyenlere veya daha önce rezervasyon yapanlara anlık "bugün %20 indirim" bildirimi gönderebilsin.

**Katacağı değer:**
- `INSTANT_DISCOUNT` bildirim tipi zaten enum'da tanımlı — backend altyapısı var
- Restoran için doğrudan müşteri dönüşümü (boş masa doldurma)
- Monetization: kampanya gönderimi premium restoran özelliği olabilir
- Rate limit: günde max 1 kampanya (spam önleme)

---

### 2.8 "Arkadaşım Burada" — Gerçek Zamanlı Check-in

**Tanım:** Kullanıcı bir restorana check-in yapabilsin; arkadaşları "X şu an Karaköy Lokantası'nda" bildirimini alabilsin.

**Katacağı değer:**
- Aktivite akışının en güçlü besleyicisi
- "Şu an orada birisi var" sosyal kanıtı → ziyaret kararını hızlandırır
- Backend: `CheckIn(userId, placeId, createdAt, expiresAt)` modeli, 3 saat TTL
- Arkadaş bildirimini mevcut FCM altyapısına bağlamak 1-2 saatlik iş

---

### 2.9 Arama Geçmişi & Kişiselleştirilmiş Öneriler

**Tanım:** Kullanıcının son aramalarını kaydet, bunları AI öneri sistemine sinyal olarak ver.

**Katacağı değer:**
- "Bu hafta 3 kez kebap aradı" bilgisi Claude prompt'una eklenir → daha alakalı öneri
- Kullanıcı deneyimi: "Son aramalar" hızlı erişim
- `SearchHistory(userId, query, type, createdAt)` — `UserLog` genişletmesiyle de yapılabilir
- GDPR/KVKK uyumu: kullanıcı geçmişini silebilmeli

---

### 2.10 Restoran Talep Sistemi ("Bu Restoranı Ekleyin")

**Tanım:** Kullanıcı, Google Places'ta bulunmayan ama bildiği bir mekanı "eklensin" diye talep edebilsin.

**Katacağı değer:**
- Kullanıcı engagement: platform eksikliğini hissettirmez
- Admin paneline "Restoran Talepleri" sekmesi → araştır + elle ekle veya reddedebilsin
- `PlaceRequest(userId, name, address, notes, status)` modeli
- Play Store değerlendirmelerindeki en büyük şikayet: "Bildiğim restoranları bulamıyorum"

---

## BÖLÜM 3 — ÖNCELİKLENDİRME MATRİSİ

| Özellik | Etki | Efor | Öncelik |
|---|---|---|---|
| Konuşmaya dayalı AI refinement | Yüksek | Orta | **P1** |
| Level-up bildirimi tetikleyicisi | Orta | Düşük | **P1** |
| Sosyal aktivite akışı | Yüksek | Orta | **P1** |
| Rezervasyon otomatik son süre | Yüksek | Düşük | **P1** |
| Anlık kampanya gönderimi | Yüksek | Düşük | **P1** |
| Fotoğraf bazlı AI analizi | Yüksek | Orta | **P2** |
| Restoran analitik paneli | Yüksek | Yüksek | **P2** |
| Check-in sistemi | Orta | Orta | **P2** |
| Kişisel yemek günlüğü | Orta | Düşük | **P2** |
| Koleksiyon unique constraint | Düşük | Düşük | **P3** |
| Bildirim tercihleri | Orta | Orta | **P3** |
| Restoran talep sistemi | Düşük | Düşük | **P3** |

---

## ÖZET

Mevcut altyapı **sağlam** — auth, discovery, AI öneri, rezervasyon, sosyal, gamification, premium tüm bileşenler çalışıyor. Odaklanılması gereken üç ana alan:

1. **AI'ı derinleştir:** Tek-adım öneri yetmez; refinement + feedback döngüsü rakiplere karşı en güçlü silahınız
2. **Sosyal dinamiği aktifleştir:** Aktivite akışı + check-in, kullanıcıların her gün uygulamayı açmasının sebebi olabilir
3. **Restoran tarafını güçlendir:** Analytics paneli + anlık kampanya, uygulamayı B2B ürüne taşır ve yeni gelir kapısı açar

---

## BÖLÜM 4 — SPRINT-8 EKLEMELERİ (2026-05-30 sonrası)

Sprint-6 retrospektifinde ve E2E smoke testlerinde yüzeye çıkan, Sprint-7 backlog'una sığmayan ama Sprint-8'in robustluk/temizlik temasına uygun maddeler.

### 4.1 Place Details ile Google `minutesUntilClose` fallback

**Mevcut durum:** S6-5'te kapanışa kalan dakika `RestaurantProfile.openingHours` override'ından önce, yoksa Google `opening_hours.periods` fallback'inden hesaplanıyor. Sorun: Google Nearby Search ve Text Search yanıtları `periods` döndürmüyor — yalnızca `open_now`. Sonuç: Sultanahmet E2E smoke'unda 60 restorandan 0'ında `minutesUntilClose` doluydu.

**Çözüm:** İsteğe bağlı bir Place Details çağrısı (Redis 24h cache) ile `periods` zenginleştirme. Maliyet kontrolü için yalnızca `isOpenNow=true` olan ilk 20 sonuç + sadece liste görünümünde (harita için skip).

**Etki:** "30 dk kapanıyor" FOMO rozeti dormant durumdan kurtulur (şu an sadece sahip claim'i yapmış restoranlarda görünüyor).

**Efor:** Orta (~1 task).

---

### 4.2 Merkezi Prisma mock factory (test altyapısı)

**Mevcut durum:** `buildUserProfileSummary` yeni bir prisma çağrısı eklediğinde (S4-7 `feedbackPreference`, S6-6 `searchHistory`) onu kullanan ~5 test dosyasının mock'unu manuel güncellemek gerekiyor.

**Sorun:** Sürdürülemez. Sprint-7'de vision + checkin + meal log gelirse prompt'a yeni model eklenmesi muhtemel; mock yayılımı bir kez daha yaşanır.

**Çözüm:** `tests/helpers/prismaMock.js` — tüm modelleri default mock'larıyla döndüren factory. Her test gerekli metotları override eder. Yeni model eklendiğinde tek yer dokunulur.

**Efor:** Düşük (~0.5 task) ama erken yapılması Sprint-8 boyunca işi kolaylaştırır.

---

### 4.3 Search analytics admin dashboard

**Mevcut durum:** S6-6 ile `SearchHistory` modeli üretimde yazıyor ama admin paneline yansımıyor.

**Çözüm:** `GET /api/admin/search-analytics` — son 7/30 günde en çok aranan top-20 keyword + en popüler cuisineTag dağılımı. AdminDashboardScreen "İstatistikler" sekmesine yeni "Aramalar" kartı.

**Etki:** Ürün kararları için sinyal (hangi mutfak tipini ekleyelim, hangi keyword'ler eksik kalıyor).

**Efor:** Düşük-orta (~1 task, agreggate query + UI kart).

---

### 4.4 Lint + format script setup

**Mevcut durum:** Ne `neareat-backend/` ne `neareat-mobile/` tarafında `eslint` veya `prettier` yapılandırılmış. `npm run lint` yok.

**Çözüm:** Her iki paket için `eslint` + `prettier` config. CI gateway için faydalı. Mobile için `@react-native/eslint-config`, backend için sade Node config.

**Efor:** Düşük (~0.5 task) ama legacy kodda uyarı tsunamisi olabilir; aşamalı (`--max-warnings`) rollout.

---

### 4.5 `viewMode` persistence — tasarım kararı

**Mevcut durum:** S6-3 persistance'ı `viewMode`'u da kaydediyor. Kullanıcı uygulamayı harita modunda kapatırsa, açtığında yine haritada açılır.

**Soru:** İstenen davranış mı? Liste varsayılan daha mantıklı olabilir.

**Çözüm:** Tek bir karar + `partialize`'dan `viewMode` çıkarmak (1 satır).

**Efor:** Çok düşük (~0.2 task). Tasarım tartışmasından sonra.

---

**Yeni öncelik matrisi maddeleri:**

| Madde | Etki | Efor | Öncelik |
|---|---|---|---|
| Place Details ile minutesUntilClose | Yüksek | Orta | **P2** |
| Merkezi Prisma mock factory | Düşük (DX) | Düşük | **P3** |
| Search analytics dashboard | Orta | Düşük-Orta | **P3** |
| Lint + format setup | Düşük (DX) | Düşük | **P3** |
| viewMode persistence kararı | Düşük | Çok Düşük | **P3** |
