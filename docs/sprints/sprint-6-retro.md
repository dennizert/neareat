# Sprint-6 Retrospektifi — Keşif & Arama + Kişiselleştirme

**Sprint adı:** Sprint-6: Keşif & Arama + Kişiselleştirme
**Başlangıç:** 2026-05-30 (Task #1)
**Bitiş:** 2026-05-30 (Task #8)
**Milestone:** Sprint-6: Kesif & Arama + Kisisellestirme (#6)
**Task'lar:** 8 GitHub issue (#82–#89), her biri ayrı PR ile (PR #131–#137 + bu docs PR #138)

---

## Hedef

Keşfet ekranını "yakındakilere göz at" araç olmaktan "bildiğim/aradığım yeri bul + kişiselleşen öneri" platformuna taşımak:
- **Arama** — Play Store'daki en büyük şikayet "bildiğim yeri bulamıyorum"; isim bazlı + serbest metin arama.
- **Daha pratik filtreleme** — kaba Google `types` yerine "kebap / deniz ürünleri / vejetaryen" gibi kullanıcı dili.
- **FOMO + tazelik sinyalleri** — "30 dk kapanıyor / yeni mekan" rozetleri.
- **Kişiselleştirme** — Filtreler restart sonrası kalsın; AI önerisi son aramalardan sinyal alsın.

---

## Sonuç: ✅ TAMAMLANDI

7 geliştirme task'ı + 1 docs, 7 PR merge edildi. Backend 781 test geçiyor (38 suite, sıfır timeout uyarısı), mobile 159 test geçiyor (9 suite), `tsc` her iki PR setinde temiz.

---

## Ne yapıldı?

### Arama altyapısı

- **S6-1 (#82 / PR #131) — `GET /api/places/search`**: Google Places Text Search wrapper; lat/lng verilirse 25 km konum bias, yoksa global. Redis cache (`placesText:{q}:{lat3}:{lng3}`, 30 dk). Mevcut `passesQualityFilter` (rating + isim elemesi) tekrar kullanılıyor. `/restaurants/nearby` ile aynı response shape (ortak `mapPlaceToResultRow` helper). `optionalAuthenticate` — login olmayanlar da arayabilir. 8 integration test.

- **S6-2 (#83 / PR #132) — Arama UI**: HomeScreen'in üstünde 400 ms debounce'lu arama çubuğu + clear butonu. `restaurantStore`'a `searchQuery` / `searchResults` / `searchLoading` / `searchError` + `performSearch`/`clearSearch` aksiyonları. <2 karakter API'yi tetiklemiyor. Mevcut RestaurantCard + detay nav yeniden kullanıldı. Empty/loading/error halleri ayrı render. 7 store testi.

### Kişiselleştirme

- **S6-3 (#84 / PR #133) — Filtre kalıcılığı**: `restaurantStore` artık `zustand/middleware` persist + AsyncStorage (key `neareat-restaurant-filters`). `partialize` yalnızca `filters` / `sortBy` / `selectedCategory` / `viewMode`'u saklıyor; runtime state (restaurants, searchResults, loading) restart sonrası yeniden yükleniyor. Sekme değişiminde zaten korunuyordu (zustand global) — bu app restart için. `jest.setup.js`'e AsyncStorage Jest mock'u eklendi (gelecek persist kullanan store'lar için hazır).

### Filtre derinliği

- **S6-4 (#85 / PR #134) — Mutfak tipi etiketleri**: Yeni saf `utils/cuisineTags.js` Google `types` + isim keyword'lerinden 13 etiket türetiyor (Pizza, Burger, Kebap, Pide & Lahmacun, Türk Mutfağı, Deniz Ürünleri, Kahvaltı, Tatlı, Sushi/Asya, İtalyan, Vejetaryen/Vegan, Kafe, Fast Food). Türkçe karakter + büyük-küçük harf duyarsız substring eşleme. `mapPlaceToResultRow` her sonuca `cuisineTags` array koyuyor; her iki endpoint `?cuisineTag=Tag1,Tag2` ile sunucu-tarafı filtreleme destekliyor. **Bonus bug fix dahil**: dışlama listesindeki bare `salon` "Antep Kebap Salonu" / "Çay Salonu" gibi yemek bağlamlı kullanımları yanlışlıkla eliyordu — daha spesifik "güzellik salonu" ile değiştirildi (kuaför zaten ayrı). 23 yeni test.

### FOMO etiketleri

- **S6-5 (#86 / PR #135) — Tazelik etiketleri**: Saf `utils/freshnessTags.js` — `minutesUntilClose` önce RestaurantProfile override'dan (TR yerel saat), yoksa Google `opening_hours.periods` fallback'inden hesaplanıyor; aynı gün, gece yarısı geçişi, dünden devam senaryoları ayrı ayrı doğrulandı. `isNewlyOpened` heuristic (`user_ratings_total < 15 AND rating ≥ 3.0`) Google açılış tarihi vermediği için yorum sayısı proxy. Response'a `minutesUntilClose` + `isNewlyOpened` eklendi; mekan kapalıysa `minutesUntilClose` null. Mobile: `Restaurant` tipine alanlar eklendi; HomeScreen `closingSoon` (≤60dk) / `closingVerySoon` (≤30dk) flag'lerini türetip RestaurantCard'a geçiriyor — kart UI'ı zaten badge'leri destekliyordu, sadece data flow eksikti. RestaurantCard'a "✨ Yeni Mekan" badge eklendi. 19 unit test.

### Arama geçmişi + AI sinyali

- **S6-6 (#87 / PR #136) — Backend**: Yeni `SearchHistory(id, userId, query, type, createdAt)` modeli + idempotent migration. `/api/places/search` arama yaptığında fire-and-forget kayıt (anonim atlanır, prisma hatası yutulur). Endpoint'ler: `GET /api/search-history` (son 30), `DELETE /api/search-history` (KVKK toplu), `DELETE /api/search-history/:id` (sahip kontrollü). `promptBuilder.buildUserProfileSummary` son 7 günün top-5 keyword'ünü `profile.recentSearches` olarak prompt'a enjekte ediyor; sistem talimatına yeni "Son Aramalar" bölümü. 11 yeni test + 5 mevcut testin prisma mock'larına `searchHistory` eklendi.

- **S6-7 (#88 / PR #137) — Mobile UI**: Yeni `services/searchHistory.ts` ince istemci. Store'a `searchHistory` / `searchHistoryLoading` + `loadSearchHistory` / `clearSearchHistory` / `deleteSearchHistoryItem` aksiyonları (silme optimistic + rollback). HomeScreen arama çubuğu focus + sorgu <2 karakter olunca "Son Aramalar" dropdown (max 8, satır içi × ile silme); dokun → sorguyu doldurup arar. ProfileScreen'e "Arama Geçmişini Sil" satırı + destructive Alert (KVKK). 4 yeni store testi.

---

## İyi giden

### 1. Önceki ortak altyapı kazandırdı
`mapPlaceToResultRow` helper'ı S6-1'de çıkarıldı; S6-4 (`cuisineTags`) ve S6-5 (`minutesUntilClose`/`isNewlyOpened`) tek bir yerde alan ekleyerek hem nearby hem search yanıtına ulaştı. Sıfır duplikasyon.

### 2. RestaurantCard zaten hazırdı
S6-5'te kart UI'ı için sıfır kod yazılmadı: `closingSoon`/`closingVerySoon`/`minutesUntilClose` props'ları kartta zaten vardı, sadece data flow bağlanması gerekti. Yeni `isNewlyOpened` badge'i tek satırla eklendi.

### 3. Saf çekirdek + ince controller
Hem `cuisineTags` hem `freshnessTags` saf modüller olarak yazıldı, DB/ağ yok. Test edilebilirliği yüksek (toplam 42 unit test), controller'a dokunmak gerekmedi.

### 4. Sprint-5'ten gelen test-altyapı borcu kapandı
Hemen S6 öncesinde 8 jest timeout uyarısı `NODE_ENV !== 'test'` guard'ı ile 0'a düştü; tüm Sprint-6 build'leri sessiz çıktı verdi.

---

## Zorlandığımız / öğrenilen

### 1. Türkçe karakter + Hermes bundle teşhisi
Yanlış bir teşhis (v22 APK eski bundle ile geldiğine dair) gereksiz bir 5dk'lık clean rebuild'e yol açtı — gerçekte iki bundle byte-byte aynıydı. **Ders**: bundle stale-check'inde Türkçe karakter eşleşmesine güvenme; `friend-suggestions`, `matchPercent` gibi ASCII unique-stringle kalibre et.

### 2. Mevcut isim elemesi cuisine filtresine çakıştı
S6-4'te `Antep Kebap Salonu` test fixture'ım daha önce eklediğim bare `salon` keyword'ü tarafından eleniyordu. Test başarısız oldu, gerçek bir false-positive ortaya çıkardı (yemek bağlamlı "X Salonu" kullanımları). `salon` kaldırılıp `guzellik salonu` ile yer değiştirildi. Filter listesini genişletirken **Türkçe çok anlamlı token'lar** için risk değerlendirmesi şart.

### 3. Prisma mock zinciri yayıldı
`buildUserProfileSummary` yeni bir `prisma.searchHistory.findMany` çağırınca onu kullanan 5 test dosyasının mock'larına `searchHistory` satırı eklemek gerekti. Sprint-4'teki `feedbackPreference` eklenmesi sırasında da aynı pattern yaşandı. **Ders**: yeni model + buildUserProfileSummary'ye girişte tüm test mock'larını refactor etmek için bir lint kuralı veya merkezi mock factory düşünülebilir.

### 4. UI doğrulama hâlâ cihazda manuel
S6-2/3/5/7 ekranları (arama bar, persist, freshness rozetleri, son aramalar) emülatör olmadığı için yalnızca tsc + jest ile doğrulandı. Sprint sonu APK build + cihaz testi gerekiyor.

---

## Sürprizler

### 1. "Pizzeria" "pizza"yı substring olarak içermiyor
Pizzeria = p-i-z-z-e-r-i-a, "pizza" yok. Pizza keyword'ü tek başına yetmedi; `pizzeria` ayrı eklenmek zorunda kaldı. Substring eşlemenin görünür hassasiyeti.

### 2. RestaurantCard'da closing-soon UI önceden vardı
Hem badge state'i hem renkli sol kenarlık hem dakika metni S6-5 öncesinde mevcuttu, sadece veri akışı yoktu. Geçmişte hazırlanan UI komponentlerinin tam canlanması için backend tetikleyici tek başına yetiyor.

### 3. AI prompt'a yansıma zincirini test etmek için 5 dosya
SearchHistory'nin yeni satırı `promptBuilder.findMany`'ye girince 5 test dosyası bir anda kırıldı. Mock yayılımı şu ana kadarki en geniş "tek değişiklik / çok dosya" oldu.

---

## Sprint-7 hazırlığı / backlog

1. **APK build + cihaz testi** — Sprint-6 ekranlarının canlı doğrulaması (arama bar, son aramalar dropdown, freshness rozetleri, cuisine filtre).
2. **Sprint-7 hazır**: Sosyal Genişleme + Premium — 8 task (#90 silinmişti, mevcut başlıklar yol haritası memory'sinde).
3. **Mock factory düşünülmeli** — promptBuilder'a her yeni model eklendiğinde 5 dosya güncellemek sürdürülebilir değil.
4. **Lint/format yapılandırması** — hâlâ ne backend ne mobile'da `eslint`/`prettier` script yok; bug değil ama gap olarak duruyor.

---

## Workflow değerlendirmesi

Sprint-6 da **atomik task → branch → PR → merge** döngüsüne sadık kaldı. 8 task, 7 feature PR, user "merge ettim, devam et" ile ilerledi. Backend→mobile bağımlılık zincirleri (S6-1→S6-2, S6-4 + S6-5 backend→mobile, S6-6→S6-7) sıralı çalışmayı gerektirdi; sprint planındaki sıralama bunu öngördü.

Test sayıları (Sprint-6 öncesi → sonrası):
- Backend: **657 → 781** (+124, 34 → 38 suite)
- Mobile: **147 → 159** (+12, 9 suite sabit)

---

**Retro yazarı:** Claude (Opus 4.7)
**Son güncellenme:** 2026-05-30
