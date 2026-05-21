/**
 * AI öneri motoru prompt yapıcısı (Sprint-1 Task #4).
 *
 * ====================================================================
 * PROMPT MİMARİSİ — CACHE OPTİMİZE EDİLMİŞ
 * ====================================================================
 *
 * Anthropic prompt caching prefix-match çalışır. Tek byte değişiklik,
 * o noktadan sonraki her şeyi cache-invalid yapar. Bu yüzden render
 * sırası: stabil olan önce, değişken olan sonra.
 *
 * Bizim yapı:
 *
 *   [TOOLS]            (yok)
 *   [SYSTEM PROMPT]    ← cache_control burada (cross-user paylaşılır)
 *   [USER MESSAGE]
 *     ├─ profile özet  ← cache_control burada (kullanıcıya özel)
 *     └─ aday + lokasyon + mood (cache YOK — her istekte değişir)
 *
 * Tek istek için 2 breakpoint (max 4 sınırının altında).
 *
 * Token sınırı uyarısı:
 *   - Haiku 4.5: minimum 4096 token prefix gerekli, aksi halde cache
 *     SESSİZCE yazılmaz. Sistem + profil toplamını >=4096 hedefliyoruz.
 *   - Sonnet 4.6: 2048 token minimum (sorun değil).
 *
 * Determinizm:
 *   - Tüm DB sonuçları ID'ye göre sıralı çekilir (5-dk pencerede aynı içerik = aynı bytes)
 *   - Profilde timestamp YOK
 *   - JSON çıktıları stable key sırasıyla
 *   - "Bugünün tarihi" gibi her gün değişen değerler user message'a gider, profile'a değil
 *
 * Detaylı mimari: memory/project_ai_recommender.md
 * ====================================================================
 */

const prisma = require('../utils/prisma');

const MAX_RECENT_REVIEWS = 20;
const MAX_FAVORITES = 25;
const MAX_STAR_EVENTS = 30;
const MAX_FRIEND_CUISINE_TYPES = 5;
const MAX_FEEDBACK_HISTORY = 20;

/**
 * Stabil JSON serializer — anahtarlar alfabetik sıralı.
 * Cache invariant'ı koruyucu (key order farkından bytes farkı çıkmaz).
 */
function stableStringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted = {};
      for (const k of Object.keys(value).sort()) sorted[k] = value[k];
      return sorted;
    }
    return value;
  }, 2);
}

/**
 * Tek text bloğunun tahmini token sayısı (1 token ≈ 4 char İngilizce, ~3 char TR).
 * Sadece dev/log için, gerçek tokenization değil.
 */
function approxTokens(text) {
  return Math.ceil((text || '').length / 3.5);
}

/**
 * SYSTEM PROMPT — Tüm kullanıcılarda aynı. Cross-user cache hedefi.
 *
 * Aşırı uzun değil; LLM'in iyi sonuç vermesi için yeterli detay + Haiku'da
 * tek breakpoint'le birlikte 4096+ token tutturmaya yardım edecek dolgunlukta.
 */
const SYSTEM_PROMPT = `Sen NearEat uygulamasının kişisel yemek sommelier'ısın.
Kullanıcı sana "Bu akşam ne yesem?" diye soruyor. Senin işin yemek seçmek
değil — kullanıcının damak zevkini, geçmişini, ruh halini bilerek ona
özel bir bakış sunmak. Bir arkadaşının ona restoran tavsiye edişi gibi
düşün: spesifik, kişisel, samimi. Türkçe konuşan, Türkiye'de yaşayan
bir kullanıcıyla iletişim kuruyorsun.

# Sana Verilenler

Sana iki şey verilir:
  1. KULLANICI PROFİLİ — yorum geçmişi, favoriler, mutfak tercihleri,
     yıldız etkinlikleri, daha önce yaptığı öneriler
  2. ADAY LİSTESİ — yakındaki, açık, yüksek puanlı en fazla 20 restoran

Her aday şu alanlarla gelir:
  - placeId (string) — referans için
  - name (string) — restoran adı
  - distance (km, ondalık)
  - rating (Google Places puanı, 1-5)
  - userRatingsTotal (puan sayısı — popülarite sinyali)
  - priceLevel (0-4 arası, Google'ın fiyat seviyesi; null olabilir)
  - types (string[]) — Google Places kategori etiketleri
  - vicinity (string) — yaklaşık adres
  - openNow (true/false/belirsiz)

# Görevin

Aday listesinden en uygun 1-3 tanesini seç ve her biri için 2-3 cümle
kişisel gerekçe yaz. ÇIKTI FORMATINA harfiyen uy (aşağıda).

# Karar Çerçevesi (Sırayla Düşün)

1. **Mood Filtresi**: Kullanıcı bir mood belirttiyse, ona uymayan adayları
   ele. Eşleme rehberi:
   - "hızlı" → fast_food, meal_takeaway, cafe, kebab
   - "şık" → fine_dining, italian_restaurant, steak_house, sushi
   - "romantik" → bar, fine_dining, panoramic/manzaralı yerler
   - "aile" → restaurant + sandalye olan, kafe değil
   - "sağlıklı" → salad, vegetarian, mediterranean
   - "uygun fiyatlı" → priceLevel<=2
   - "lüks" → priceLevel>=3

2. **Kişisel Sinyal**: Profili tara — kullanıcı son aylarda hangi
   mutfaklara ilgi göstermiş? Hangi yıldızlar verilmiş? Tekrarlayan
   tema var mı (örn. çoğunlukla cafe, çoğunlukla et)?

3. **Çeşitlilik vs Tutarlılık**: Eğer profile bakınca kullanıcı belirgin
   bir tutarlılık gösteriyorsa (örn. son 10 yorum İtalyan), o tarzda
   öner — AMA ara sıra "bunu da deneyebilirsin" şeklinde 1 farklı
   tarzda alternatif sunmak iyi olur. Çeşitliliği ZORLAMA, doğal olsun.

4. **Yakınlık vs Kalite Tradeoff'u**: 0.2 km'deki 4.0 ile 1.5 km'deki
   4.7 arasında seçim yaparken kullanıcının önceki davranışına bak:
   uzun yol kat etti mi yoksa yakın yeri mi seçti? Belli değilse
   yakını ve yüksek puanlıyı dengele.

5. **Aday Listesinin Zayıflığı**: Eğer adayların hepsi 3.5-3.8 puanlı
   veya kullanıcının tarzına hiç uymuyorsa, dürüst ol: noteToUser'da
   "Şu an yakınında pek uygun seçenek yok, biraz uzaklaşmaya değer
   olabilir." de ve yine de en iyi 1-2'yi öner.

6. **Arkadaş Sinyalleri (Varsa)**: Kullanıcı profili "friendSignals"
   array'i içeriyorsa, bu anonim arkadaş tercihlerini destekleyici sinyal
   olarak kullan:
   - Zayıf sinyal (reviewCount < 3): karar verici değil, çok hafifçe.
   - Güçlü sinyal (reviewCount ≥ 5 ve avgRating ≥ 4.0): öneri kararını
     güçlendirebilir — aynı tarzı seven arkadaşlar varsa sosyal onay sinyali.
   - Birden çok arkadaş aynı mutfak türünü paylaşıyorsa bu güçlü onay —
     gerekçede "bu tarzı seven çevrenden de var" şeklinde doğal belirtebilirsin.
   - friendSignals YOKSA (free kullanıcı veya opt-in arkadaş yok): tamamen
     görmezden gel, bu bölümü hiç işleme.
   - ASLA: "arkadaş 2 buraya gitmiş", "arkadaş 1 bu puanı vermiş" gibi
     spesifik bilgi ifşa etme. Sadece genel mutfak eğilim seviyesinde kal.
   - ASLA: Anonim label'ları (arkadaş 1, arkadaş 2) kullanıcıya aktarma.

7. **Geçmiş Beğeniler (feedbackHistory, varsa)**: Kullanıcı profili
   "feedbackHistory" içeriyorsa, önceki AI önerilerine 👍/👎 vermiş demektir:
   - likedPlaceIds: Kullanıcının beğendiği placeId'ler — bu tarzda devam
     edebilirsin. Aynı placeId'yi yeniden önerme (kullanıcı zaten biliyor),
     ama aynı mutfak/tarz mantıklı bir seçimdir.
   - dislikedPlaceIds: Kullanıcının beğenmediği placeId'ler — BU placeId'leri
     KESİNLİKLE önerme. Aynı kategoriden birden çok beğenmeme varsa o mutfak
     tarzından uzak dur.
   - feedbackHistory YOKSA: tamamen görmezden gel, bu bölümü hiç işleme.
   - Gerekçede doğrudan "daha önce beğendin" veya "beğenmemiştin" gibi
     sinyale atıf yapabilirsin — bu kullanıcıya şeffaf ve yararlı.

# Gerekçe Yazma Standardı

Her gerekçe 2-3 cümle olmalı. Şu yapıyı izle:
  Cümle 1: Kullanıcının profilinden somut bir bağlantı kur
  Cümle 2-3: Bu adayın o bağlantıyı neden karşıladığını açıkla,
             pratik detay ekle (mesafe, atmosfer ipucu, mutfak)

İYİ ÖRNEKLER:

  "Profilindeki son 4 İtalyan yorumun ortalama 4.7 yıldız — bu
  mutfaktan keyif aldığın belli. Locanda Italian 0.4 km'de, fine
  dining tarzı şık bir mekan. Mood'un 'şık' olduğu için tam yerinde."

  "Geçen hafta verdiğin Burger House yorumunda 'aşırı kalabalık'
  demişsin — bu yüzden cafe tarzında sakin bir yer öneriyorum.
  Mandabatmaz 0.2 km'de, klasik bir İstanbul kafesi."

  "Profilinde hiç sushi yok ama Asian fusion (Tomyum) öneri yapmışsın.
  Cinque Sushi Bar Asian mutfağı seven biri için doğru sonraki adım
  olabilir; 0.6 km uzakta ve premium seviyede."

KÖTÜ ÖRNEKLER (bunlardan kaçın):

  "İyi bir İtalyan restoranı, 4.5 puanı var ve yakın."
  → Çok genel, kişisel bağ yok, listede zaten gözüken bilgi.

  "Sana özel seçtim, çok sevecek bir yer!"
  → Hiç içerik yok, hangi sinyalden geldiğin belli değil.

  "Bu yerin yorumlarına baktım ve müthiş gözüküyor."
  → Sen yorumlara bakamazsın, halüsinasyon riski.

# Çıktı Formatı (KESIN UY)

Sadece geçerli JSON döndür. Hiçbir preamble, açıklama, markdown
kodu (\`\`\`), başlık YOK. Yapı:

{
  "recommendations": [
    {
      "placeId": "<aday listedeki tam placeId string — uydurma yok>",
      "reason": "<2-3 cümle Türkçe kişisel gerekçe>"
    }
  ],
  "noteToUser": "<opsiyonel kısa not: aday listesinin zayıf olduğunu
                  düşünüyorsan, ya da özel bir gözlemini paylaşmak
                  istiyorsan. Yoksa boş string \\\"\\\".>"
}

JSON dışında HİÇBİR şey yazma. Çıktın "{" ile başlasın "}" ile bitsin.

# Kesin Yasaklar

- Listede OLMAYAN bir placeId üretmek (halüsinasyon yasak).
- Aynı placeId'yi 2 kez önermek.
- placeId yerine sadece restoran adı vermek.
- Tek cümlelik veya 4+ cümlelik gerekçe. Sweet spot 2-3 cümle.
- Markdown formatlama: **bold**, # heading, - bullet (gerekçe içinde).
- "priceLevel" kelimesini veya rakamını gerekçede kullanmak. Fiyat hakkında
  konuşmak istersen doğal Türkçe kullan: "ekonomik", "orta fiyatlı", "biraz pahalı",
  "uygun fiyatlı", "₺₺" gibi ifadeler. "priceLevel 2" veya "priceLevel: 3" gibi
  teknik ifadeler KESİNLİKLE yasak.
- "Yorumlarına baktım" / "verilerine baktım" / "konum geçmişini gördüm"
  — sen sadece sana verilen JSON profili görüyorsun, fazlasını uydurma.
- Kullanıcının kişisel verisini gerekçenin dışında tekrar ifşa etmek
  (örn. email, telefon, vs.).
- Restoranı promote etmek için duygusal abartı ("KESİN bayılacaksın!").
- Kullanıcı yaşı/cinsiyeti hakkında varsayım.

# Kısıtlar

- DİL: Türkçe. Doğal, samimi, sommelier tonunda.
- PARA: Gerekirse ₺ (TL). $/€ yok.
- COĞRAFYA: Türkiye, çoğunlukla İstanbul. Yerel referanslar OK
  ("klasik bir İstanbul kafesi" gibi).
- ZAMAN: Şu anki tarih/saat user message'da var. Önerilerin "şu an"
  yapılabilir olsun (örn. saat 23'te kahvaltı yeri önerme).

# Edge Case'ler

- **Yeni kullanıcı (boş profil)**: Profile tamamen veya neredeyse
  tamamen boş gelirse, gerekçeni adayın objektif özelliklerine + mood
  eşleşmesine dayandır. "Yeni başlayan kullanıcı için, ilk denemen
  için sağlam bir seçim olabilir" şeklinde dürüst ol.

- **Çok benzer adaylar**: 3 İtalyan, 4 cafe gibi tek tip lokasyon
  varsa, 1-2'sini seç, çeşitlilik için diğer kategorilerden de.
  Hepsi aynı tipse, en iyi 2-3'ünü seç.

- **Kullanıcı sevmediği bir tarz vermiş**: Profile bakınca 1-2 yıldız
  verdiği yerlerle aynı kategoriden adaylar varsa, onlardan kaçın.
  Profile "kötü deneyim" sinyali oluşturan kayıtlara dikkat et.

- **openNow=false**: Aday listesi zaten filtrelendi, false olanlar
  gelmiyor. Ama belirsiz (null) olanlar gelir — onları normalde
  öner ama gerekçende "açık olduğunu doğrulamanı öneririm" gibi
  ufak uyarı koyma. Listeleyen sistem zaten filtreliyor.

- **Mood ile profil çelişiyor**: Mood "hızlı" ama profil tamamen
  fine-dining ise, mood'a uy ama not'a "normalde tercih ettiğin tarza
  uymuyor, hızlı bir akşam olduğu için" ekleyebilirsin.

# Düşünme Süreci (İç İşleyiş)

JSON döndürmeden ÖNCE içinde şu sırayı izle:
  1. Profili 2-3 kez tara, ana temaları belirle (mutfaklar, fiyat,
     mood pattern, son aktivite)
  2. Aday listesini gözden geçir, ilk elemede potansiyel 5-7'yi işaretle
  3. Mood/profil filtresinden geçir, 3-4'e indir
  4. Final 1-3'ü seç, her biri için somut gerekçe yaz
  5. JSON formatına çevir, kontrolden geçir (placeId mevcut mu?
     gerekçe 2-3 cümle mi? markdown var mı?)

Bu süreç içsel; çıktıda görünmez. Sadece final JSON gelir.

# Türk Mutfak Tipleri Sözlüğü

NearEat'te Google Places types Türk mutfak alt-türlerini detaylı
ayırmıyor; "restaurant" + "food" gelir. Karar verirken restoran adı
ve adres bilgisini Türk damak zevki taksonomisine göre yorumla:

**Et ağırlıklı**:
  - kebap, kebapçı, ocakbaşı → Türk kebap kültürü, akşam yemeği için klasik
  - et lokantası, steakhouse → daha şık, fiyatlı
  - köfteci → günlük, hızlı, makul fiyat
  - dürümcü, döner, çiğköfte → fast food spectrum

**Ev yemeği / lokanta**:
  - lokanta, ev yemekleri, esnaf lokantası → öğle ağırlıklı, mütevazı
  - sulu yemek, çorba salonu → kahvaltı-öğle arası
  - manti, mantıcı → Orta Anadolu lezzetleri

**Deniz ürünleri**:
  - balık, balık restoranı, meyhane → akşam, rakı eşliğinde sosyal
  - midyeci → sokak yemeği, hızlı atıştırma

**Kahvaltı / kafe**:
  - kahvaltı salonu → klasik Türk kahvaltısı, hafta sonu
  - cafe (Google) → çoğunlukla Batı tarzı; içerik adından çıkar
  - mandabatmaz, çay bahçesi → klasik İstanbul kafesi, sakin

**Uluslararası**:
  - italian, pizzeria, pasta → İtalyan
  - sushi, ramen → Japon
  - chinese, asian fusion → Çin/Asya genel
  - burger, fast food → Amerikan
  - mexican, taco → Meksika

**İçecek odaklı**:
  - bar, kokteyl bar → akşam, içki ağırlıklı
  - pub → İngiliz tarzı, food + drink karma
  - night club → çok geç, yemek değil

# Saat Bağımı

Önerirken kullanıcının kullanım saati önemli. Variable bloktaki
"Zaman" değerine bak:

  - **06:00-10:30**: Kahvaltı vakti. Kahvaltı salonu, brunch yerleri,
    cafe (Türk kahvesi + simit gibi) ön planda. Akşam restoranı önerme.
  - **11:00-14:30**: Öğle. Lokanta, sulu yemek, fast-casual ön planda.
    Fine dining genellikle akşama saklanır.
  - **15:00-18:00**: Ara öğün / kahve. Pasta-tatlı, kafe, dondurma.
    Ana yemek önerisi gerekirse erken akşam yemeği gibi düşün.
  - **18:30-23:00**: Akşam yemeği — primary "ne yesem" zamanı. Geniş
    spektrum: kebap, balık, fine dining, hepsi mümkün.
  - **23:00-02:00**: Geç saat. Çorbacı, çiğköfte, açık 7/24 yerler.
    Mood'a göre bar/eğlence düşünülebilir.
  - **02:00-06:00**: Çok geç — sınırlı seçenek, dürüst ol: "Şu saatte
    açık birkaç yer var" diye not ekle.

Eğer aday listesinde saate uymayan yerler varsa (kahvaltı saatinde
fine dining gibi), gerekçende uygun şekilde ele al — "Brunch için bu
yer ideal" gibi açıklayıcı dil kullan.

# Fiyat Seviyesi Yorumu

Google priceLevel (0-4) yorumu:
  - 0 = ücretsiz (nadir, atla)
  - 1 = ucuz (sokak yemeği, hızlı atıştırma — kişi başı ~50-150₺)
  - 2 = orta (ortalama lokanta — kişi başı ~150-400₺)
  - 3 = pahalı (şık restoran — kişi başı ~400-800₺)
  - 4 = çok pahalı (fine dining, premium — kişi başı 800₺+)
  - null = bilgi yok (genelde küçük/yeni yerler)

Kullanıcı "uygun fiyatlı" derse priceLevel 1-2; "lüks/şık" derse 3-4
ön planda. Profile'a bakarak da sinyal al — kullanıcı sürekli
fine dining yorumu yapmışsa priceLevel 3-4 daha uygun olabilir.

# Daha Detaylı İyi Gerekçe Örnekleri

ÖRNEK 1 (Aktif profil, uyumlu mood):
  Profile özet: Son 12 yorum %75 İtalyan, ortalama 4.6 yıldız.
                Mood: 'romantik'.
  Aday: Locanda Italian (4.7 ★, 0.4 km, priceLevel 3)
  İYİ:
    "İtalyan mutfağındaki tutarlılığın profile'ında çok belirgin —
    son 12 yorumun çoğu İtalyan ve ortalama 4.6 yıldız vermişsin.
    Locanda Italian fine dining tarzında, romantik bir akşam için
    panoramik teras alanı ve mum ışığı atmosferiyle tam yerinde."

ÖRNEK 2 (Çelişen sinyaller — açık net konuş):
  Profile: Cafe ağırlıklı (8 yorum), ortalama 4.0
  Mood: 'şık'
  Aday: Mikla (4.6 ★, 0.8 km, priceLevel 4)
  İYİ:
    "Profilinde daha çok cafe ve günlük yer var ama mood 'şık' olduğu
    için bu kez tarzdan çıkmaya değer. Mikla 0.8 km'de, İstanbul'un
    en bilinen modern Türk fine dining adresi — özel bir akşam için."

ÖRNEK 3 (Boş profil — dürüst yaklaşım):
  Profile: Yeni kullanıcı, hiç yorum yok, favoriteCuisines: ["Türk"]
  Mood: belirtilmedi
  Aday: Çiya Sofrası (4.6 ★, 1.2 km, priceLevel 2)
  İYİ:
    "Henüz NearEat'te yorum geçmişin yok ama favori mutfak olarak Türk
    seçmişsin. Çiya Sofrası Anadolu yemekleri açısından şehrin en
    saygın yerlerinden biri; ilk denemen için sağlam, otantik bir seçim."

ÖRNEK 4 (Çeşitlilik önerisi):
  Profile: Son 8 yorum hep aynı kebapçı zinciri
  Aday listesinde: 2 farklı kebapçı + 1 İtalyan + 1 sushi
  İYİ (kebapçı öner):
    "Profil'inden anladığım üzere kebap senin için güvenli liman —
    Köşebaşı 0.3 km'de ve 4.5 puanlı, bildiğin tarzda kaliteli bir
    seçim olacak."
  İYİ (çeşitlilik için sushi öner):
    "Bir alternatif olarak: 8 yorumun da kebap, biraz çıkış yapmak
    istersen Cinque Sushi Bar 0.6 km'de ve 4.7 puanlı, ilk sushi
    deneyimin için sağlam bir başlangıç."

  Bu iki öneriyi birlikte sun, kullanıcı seçsin.

# Açık/Kapalı Bilgisi Kullanımı

Aday listesi zaten "açıkça kapalı" olanları filtreliyor. Listeye giren
adaylar ya AÇIK (openNow=true) ya da BELİRSİZ (openNow=null). Belirsiz
olanlarda Google opening_hours sağlamamış demektir — bu yerleri yine
öner ama gerekçende açıklık imasını yapma. Sistem zaten doğrulamış sayılır.

KESİNLİKLE openNow=false olan bir restoran ÖNERME — listede yoktur,
gelirse sisteme bug raporla anlamında değil ama o kayıt için JSON'a
ekleme yapma.
`;

/**
 * Sistem prompt'unu Anthropic content block formatında, cache_control marker'lı döner.
 * Cache marker'ı en sonda — buradan önceki her şey (gelecekteki tools dahil) cache'lenir.
 */
function buildSystemBlock() {
  return [
    {
      type: 'text',
      text: SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

/**
 * Premium kullanıcının opt-in arkadaşlarından anonim mutfak sinyalleri toplar.
 *
 * KVKK: shareWithFriendsRecommender=true olmayan arkadaşlar HİÇBİR ŞEKİLDE dahil edilmez.
 * Deterministik: queryler ID sıralı; label'lar ID sırasından türetilir → aynı veri = aynı çıktı.
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function buildFriendSignals(userId) {
  // Adım 1: Kabul edilmiş arkadaş isteği kayıtları
  const friendRequests = await prisma.friendRequest.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    orderBy: { id: 'asc' },
    select: { fromUserId: true, toUserId: true },
  });

  if (!friendRequests.length) return [];

  // Eşsiz arkadaş ID'leri — deterministik sıra için sort
  const rawIds = friendRequests.map((fr) =>
    fr.fromUserId === userId ? fr.toUserId : fr.fromUserId
  );
  const uniqueFriendIds = [...new Set(rawIds)].sort();

  // Adım 2: Sadece opt-in olanlar (KVKK)
  const optInFriends = await prisma.user.findMany({
    where: { id: { in: uniqueFriendIds }, shareWithFriendsRecommender: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  if (!optInFriends.length) return [];

  const optInIds = optInFriends.map((f) => f.id);

  // Adım 3: Mutfak sinyalleri + puan geçmişi (paralel)
  const [friendRecs, friendReviews] = await Promise.all([
    prisma.recommendation.findMany({
      where: { fromUserId: { in: optInIds } },
      orderBy: { id: 'asc' },
      select: { fromUserId: true, placeTypes: true },
    }),
    prisma.review.findMany({
      where: { userId: { in: optInIds } },
      orderBy: { id: 'asc' },
      select: { userId: true, rating: true },
    }),
  ]);

  // Adım 4: Her arkadaş için anonim sinyal objesi (ID sırası → deterministik label)
  const signals = [];
  for (let i = 0; i < optInIds.length; i++) {
    const fid = optInIds[i];
    const fRecs = friendRecs.filter((r) => r.fromUserId === fid);
    const fReviews = friendReviews.filter((r) => r.userId === fid);

    // Mutfak tipi frekansı
    const typeCounts = new Map();
    for (const rec of fRecs) {
      for (const t of rec.placeTypes || []) {
        const k = String(t).toLowerCase();
        typeCounts.set(k, (typeCounts.get(k) || 0) + 1);
      }
    }
    const topCuisineTypes = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_FRIEND_CUISINE_TYPES)
      .map(([type]) => type);

    const avgRating = fReviews.length
      ? Number(
          (fReviews.reduce((s, r) => s + r.rating, 0) / fReviews.length).toFixed(2)
        )
      : null;

    // Sinyal yoksa dahil etme
    if (topCuisineTypes.length === 0 && fReviews.length === 0) continue;

    signals.push({
      label: `arkadaş ${i + 1}`,
      topCuisineTypes,
      avgRating,
      reviewCount: fReviews.length,
    });
  }

  return signals;
}

/**
 * Son MAX_FEEDBACK_HISTORY adet beğeni/beğenmeme kaydını döner.
 * Deterministik: ID'ye göre sıralı (zaman filtresi yok — cache stabilitesi için).
 *
 * @param {string} userId
 * @returns {Promise<{ liked: string[], disliked: string[] }>}
 */
async function buildFeedbackHistory(userId) {
  const records = await prisma.recommendationFeedback.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    take: MAX_FEEDBACK_HISTORY,
    select: { placeId: true, sentiment: true },
  });

  const liked = records.filter((r) => r.sentiment === 'positive').map((r) => r.placeId);
  const disliked = records.filter((r) => r.sentiment === 'negative').map((r) => r.placeId);

  return { liked, disliked };
}

/**
 * Kullanıcı profil özetini DB'den deterministik şekilde topla.
 *
 * DETERMİNİZM KURALLARI:
 *   - Tüm queryler ID'ye göre sıralı (zaman değil) — aynı kullanıcı, aynı record set → aynı output
 *   - createdAt/updatedAt timestamp'ler sona çıkarılmaz, sadece tarihten yıl-ay (YYYY-MM)
 *   - JSON.stringify yerine kendi stable serializer
 *   - Cache pencere (~5dk) içinde aynı bytes → cache hit
 *
 * Kullanıcı yeni yorum yazarsa profil değişir → cache miss → yeniden yazılır. Beklenen davranış.
 *
 * @param {string} userId
 * @param {{ tier?: 'free' | 'premium' }} [options]
 */
async function buildUserProfileSummary(userId, { tier = 'free' } = {}) {
  const isPremium = tier === 'premium';

  const [user, reviews, favorites, starEvents, sentRecs, friendSignalsData, feedbackData] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        favoriteCuisines: true,
        starCount: true,
        city: true,
        bio: true,
      },
    }),
    prisma.review.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
      take: MAX_RECENT_REVIEWS,
      select: { placeId: true, rating: true, body: true, createdAt: true },
    }),
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
      take: MAX_FAVORITES,
      select: { placeId: true, placeName: true, placeRating: true },
    }),
    prisma.starEvent.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
      take: MAX_STAR_EVENTS,
      select: { type: true, description: true, amount: true },
    }),
    prisma.recommendation.findMany({
      where: { fromUserId: userId },
      orderBy: { id: 'asc' },
      take: 20,
      select: { placeName: true, placeTypes: true, message: true },
    }),
    // Premium only — free tier'da friend signals yok (cache key stabil kalır)
    isPremium ? buildFriendSignals(userId) : Promise.resolve([]),
    buildFeedbackHistory(userId),
  ]);

  if (!user) {
    throw new Error(`promptBuilder: user not found: ${userId}`);
  }

  // Reviewer eğilimi — kullanıcı sert mi yumuşak mı?
  const avgRating = reviews.length
    ? Number(
        (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2)
      )
    : null;

  // Mutfak tipi sinyallerini topla (Recommendation'dan)
  const cuisineSignals = new Map();
  for (const r of sentRecs) {
    for (const t of r.placeTypes || []) {
      const k = String(t).toLowerCase();
      cuisineSignals.set(k, (cuisineSignals.get(k) || 0) + 1);
    }
  }
  const topCuisineSignals = [...cuisineSignals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([type, count]) => ({ count, type }));

  // Profil verisi — JSON yapısında, deterministik
  const profile = {
    displayName: user.displayName,
    statedFavoriteCuisines: user.favoriteCuisines || [],
    starCount: user.starCount || 0,
    city: user.city || null,
    bio: user.bio || null,
    reviewerStats: {
      totalReviews: reviews.length,
      avgRating,
    },
    recentReviews: reviews.map((r) => ({
      placeId: r.placeId,
      rating: r.rating,
      monthYear: r.createdAt.toISOString().slice(0, 7), // YYYY-MM only — daha stabil
      excerpt: (r.body || '').slice(0, 200),
    })),
    favorites: favorites.map((f) => ({
      placeId: f.placeId,
      name: f.placeName,
      rating: f.placeRating != null ? Number(f.placeRating) : null,
    })),
    starHistory: starEvents.map((s) => ({
      type: s.type,
      amount: s.amount,
      description: (s.description || '').slice(0, 120),
    })),
    cuisineSignalsFromRecommendations: topCuisineSignals,
    sentRecommendations: sentRecs.map((r) => ({
      placeName: r.placeName,
      types: (r.placeTypes || []).slice(0, 5),
      message: (r.message || '').slice(0, 200),
    })),
  };

  // Arkadaş sinyalleri — sadece premium ve sinyal varsa (KVKK: opt-in only)
  if (isPremium && friendSignalsData.length > 0) {
    profile.friendSignals = friendSignalsData;
  }

  // Geçmiş beğeniler — tüm tier'lar, sadece kayıt varsa
  if (feedbackData.liked.length > 0 || feedbackData.disliked.length > 0) {
    profile.feedbackHistory = {
      likedPlaceIds: feedbackData.liked,
      dislikedPlaceIds: feedbackData.disliked,
    };
  }

  const text =
    '# Kullanıcı Profili\n\n' +
    'Aşağıda kullanıcının NearEat üzerindeki yemek geçmişi var. Önerilerini\n' +
    'buradaki sinyallere göre kişiselleştir. Bu profil 5-10 dakika içindeki\n' +
    'sonraki sorularında da değişmeyecek (cache).\n\n' +
    '```json\n' +
    stableStringify(profile) +
    '\n```\n';

  return {
    text,
    profile,
    tokenEstimate: approxTokens(text),
  };
}

/**
 * Kullanıcı profil özetini cache_control marker'lı Anthropic content block olarak döner.
 * Sistemden sonraki ikinci cache breakpoint — her kullanıcı için ayrı cache entry.
 */
function buildProfileBlock(profileText) {
  return {
    type: 'text',
    text: profileText,
    cache_control: { type: 'ephemeral' },
  };
}

/**
 * Ham priceLevel (0-4) → Türkçe doğal dil.
 * Claude'a gönderilen aday listesinde "priceLevel: 2" yerine "orta fiyatlı (₺₺)" görünür.
 */
function formatPriceTR(level) {
  const map = { 0: 'ücretsiz', 1: 'ekonomik (₺)', 2: 'orta fiyatlı (₺₺)', 3: 'pahalı (₺₺₺)', 4: 'çok pahalı (₺₺₺₺)' };
  return (level != null && map[level]) ? map[level] : 'fiyat bilgisi yok';
}

/**
 * USER MESSAGE'IN DEĞİŞKEN KISMI — Cache yok.
 * Bu blok her istekte değişir: konum, aday liste, mood, tarih.
 */
function buildVariableBlock({ candidates, location, mood, now, routeContext }) {
  const nowIso = now || new Date().toISOString();
  const localTime = new Date(nowIso).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  const candidateLines = candidates.map((c, i) => {
    return (
      `${i + 1}. ${c.name}\n` +
      `   placeId: ${c.placeId}\n` +
      `   mesafe: ${c.distanceKm} km\n` +
      `   puan: ${c.rating ?? 'N/A'} (${c.userRatingsTotal ?? 0} oy)\n` +
      `   fiyat: ${formatPriceTR(c.priceLevel)}\n` +
      `   kategoriler: ${(c.types || []).slice(0, 6).join(', ')}\n` +
      `   adres: ${c.vicinity ?? '—'}\n` +
      `   durum: ${c.openNow === false ? 'KAPALI' : c.openNow === true ? 'AÇIK' : 'belirsiz'}`
    );
  });

  let text =
    '# Şu Anki Sorgu\n\n' +
    `Zaman: ${localTime} (Türkiye saati)\n` +
    `Konum: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}\n\n` +
    '# Aday Restoranlar\n\n' +
    `Toplam ${candidates.length} aday. Sıralama bizim skor algoritmamızdan; sen kendi mantığına göre değerlendir.\n\n` +
    candidateLines.join('\n\n') +
    '\n\n# Görev\n\n' +
    'Yukarıdaki adaylardan en uygun 1-3 tanesini seç ve her biri için 2-3\n' +
    'cümle kişisel gerekçe yaz. Sistem promptundaki ÇIKTI FORMATINA harfiyen uy.\n' +
    'Sadece JSON döndür.';

  if (routeContext) {
    text += '\n\n# Rota Bağlamı\n\n' + routeContext;
  }

  return {
    type: 'text',
    text,
  };
}

/**
 * Anthropic `messages.create()` çağrısı için tam payload üretir.
 *
 * @param {object} params
 * @param {object} params.profileSummary - buildUserProfileSummary() çıktısı
 * @param {Array} params.candidates - candidateService.getCandidates() candidates dizisi
 * @param {{lat:number,lng:number}} params.location
 * @param {string} [params.mood]
 * @param {string} [params.now] - test/determinism için override edilebilir ISO string
 * @returns {{ system, messages, tokenEstimate: object }}
 */
function buildClaudeRequest({ profileSummary, candidates, location, mood, now, routeContext }) {
  const system = buildSystemBlock();
  const profileBlock = buildProfileBlock(profileSummary.text);
  const variableBlock = buildVariableBlock({ candidates, location, mood, now, routeContext });

  const messages = [
    {
      role: 'user',
      content: [profileBlock, variableBlock],
    },
  ];

  return {
    system,
    messages,
    tokenEstimate: {
      system: approxTokens(SYSTEM_PROMPT),
      profile: profileSummary.tokenEstimate,
      variable: approxTokens(variableBlock.text),
    },
  };
}

module.exports = {
  // public
  buildUserProfileSummary,
  buildClaudeRequest,
  // constants for tests/inspection
  SYSTEM_PROMPT,
  MAX_RECENT_REVIEWS,
  MAX_FAVORITES,
  MAX_STAR_EVENTS,
  // testable internals
  __test: {
    stableStringify,
    approxTokens,
    buildSystemBlock,
    buildProfileBlock,
    buildVariableBlock,
    buildFriendSignals,
    buildFeedbackHistory,
  },
};
