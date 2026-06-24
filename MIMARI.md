# Eatlas (NearEat) — Mimari Dokümanı

> Bu doküman, projeyi hiç bilmeyen birinin tüm sistemi kafasında canlandırabilmesi için
> yazılmıştır. Tüm diyagramlar [Mermaid](https://mermaid.js.org/) formatındadır; GitHub,
> VS Code (Mermaid eklentisi) ve birçok Markdown görüntüleyici bunları otomatik çizer.

---

## İçindekiler
1. [Tek bakışta sistem](#1-tek-bakışta-sistem)
2. [Bileşenler ve dış servisler](#2-bileşenler-ve-dış-servisler)
3. [Backend istek boru hattı](#3-backend-istek-boru-hattı)
4. [Backend katman mimarisi](#4-backend-katman-mimarisi)
5. [Mobil uygulama mimarisi](#5-mobil-uygulama-mimarisi)
6. [Üç rol ve ekran ağacı](#6-üç-rol-ve-ekran-ağacı)
7. [Veri modeli (ER diyagramı)](#7-veri-modeli-er-diyagramı)
8. [Önemli akışlar (sequence diyagramları)](#8-önemli-akışlar)
9. [Zamanlanmış işler (cron)](#9-zamanlanmış-işler-cron)
10. [Dağıtım ve ölçeklenme](#10-dağıtım-ve-ölçeklenme)

---

## 1. Tek bakışta sistem

Eatlas, **yapay zekâ destekli bir restoran keşif uygulamasıdır.** İki ana program tek bir Git
deposunda (monorepo) durur: telefondaki uygulama (`neareat-mobile`) ve sunucudaki beyin
(`neareat-backend`). Telefon "aptal ve hızlı" tutulur — sadece gösterir ve ister; tüm gizli
anahtarlar, kurallar ve hesaplar backend'dedir.

```mermaid
graph TB
    subgraph Client["📱 İSTEMCİ — Kullanıcının elinde"]
        MOB["neareat-mobile<br/>React Native + Expo<br/>Zustand state"]
    end

    subgraph Cloud["☁️ RAILWAY BULUTU"]
        BE["neareat-backend<br/>Node.js + Express"]
        PG[("PostgreSQL<br/>kalıcı veri")]
        RD[("Redis<br/>önbellek + kilit")]
    end

    subgraph Ext["🌐 DIŞ SERVİSLER"]
        GP["Google Places<br/>restoran verisi"]
        AI["Anthropic Claude<br/>AI öneri"]
        FB["Firebase<br/>Google ile giriş"]
        RS["Resend<br/>e-posta"]
        GPLAY["Google Play<br/>abonelik (IAP)"]
        S3["AWS S3<br/>foto galeri"]
        SE["Sentry<br/>hata izleme"]
    end

    MOB -- "HTTPS / JSON<br/>+ SSE akışı" --> BE
    BE --> PG
    BE --> RD
    BE --> GP
    BE --> AI
    BE --> FB
    BE --> RS
    BE --> GPLAY
    BE --> S3
    BE --> SE

    style MOB fill:#fde2c8
    style BE fill:#cde7ff
    style PG fill:#d6f5d6
    style RD fill:#ffe0e0
```

**Benzetme:** Mobil = garson (müşteriyle konuşur, mutfak deposuna asla girmez). Backend =
mutfak (asıl işi yapar, depodan/tedarikçiden malzeme alır). PostgreSQL = ana depo (kalıcı).
Redis = tezgahtaki hazır malzeme (hızlı ama geçici).

---

## 2. Bileşenler ve dış servisler

| Bileşen | Teknoloji | Görevi |
|---------|-----------|--------|
| **neareat-mobile** | React Native (Expo ~52), Zustand, TypeScript | Kullanıcı arayüzü (Android APK) |
| **neareat-backend** | Node.js, Express, Prisma | Tüm iş mantığı + API |
| **PostgreSQL** | Prisma ORM | Kullanıcı verisi (yorum, favori, rezervasyon...) |
| **Redis** | ioredis | Önbellek (Google/AI maliyet kalkanı) + cron kilidi + oturum |
| **Google Places** | REST | Restoran arama, detay, fotoğraf — *restoranlar DB'de tutulmaz* |
| **Anthropic Claude** | SSE streaming | AI öneri (Haiku/Sonnet) + restoran iş raporu |
| **Firebase** | Admin SDK | Google OAuth ile giriş doğrulama |
| **Resend** | REST | E-posta doğrulama / şifre sıfırlama / hoş geldin |
| **Google Play** | androidpublisher | Premium abonelik doğrulama + RTDN webhook |
| **AWS S3** | SDK | Restoran fotoğraf galerisi |
| **Sentry** | DSN | Hata ve güvenlik olayı izleme (env-gated) |

---

## 3. Backend istek boru hattı

Gelen **her** HTTP isteği, [app.js](neareat-backend/src/app.js) içinde tanımlı sırayla bir
dizi "kapıdan" geçer (havaalanı güvenlik kontrolü gibi). Sıra önemlidir: önce ölç ve koru,
sonra işle.

```mermaid
flowchart TD
    REQ([İstek gelir]) --> RID["requestId<br/>takip numarası ver"]
    RID --> MET["metrics<br/>süre/durum ölç"]
    MET --> HLM["helmet + CORS<br/>güvenlik başlıkları"]
    HLM --> CMP["compression (gzip)<br/>SSE hariç"]
    CMP --> MRG["morgan<br/>HTTP log"]
    MRG --> RL["rate-limit<br/>auth 20/15dk · API 120/dk"]
    RL --> BP["body-parse<br/>JSON oku (5mb / auth 10kb)"]
    BP --> SAN["sanitize<br/>zararlı girdi temizle"]
    SAN --> ROUTE{"route eşleştir<br/>/api/..."}

    ROUTE --> AUTH["auth middleware<br/>JWT veya Firebase doğrula"]
    AUTH --> ROLE["roles check<br/>USER / RESTAURANT / ADMIN"]
    ROLE --> CTRL["controller<br/>iş mantığı"]
    CTRL --> SVC["service layer<br/>DB / Redis / Google / AI"]
    SVC --> RESP([Yanıt])

    CTRL -. hata .-> ERR["errorHandler<br/>düzgün hata + Sentry"]
    SVC -. hata .-> ERR
    ERR --> RESP

    style REQ fill:#cde7ff
    style RESP fill:#d6f5d6
    style ERR fill:#ffe0e0
    style AUTH fill:#fff3c4
    style ROLE fill:#fff3c4
```

**Önemli detaylar:**
- **Rate limiting katmanlı:** `authLimiter` (giriş brute-force koruması), `apiLimiter`
  (genel), `adminLoginLimiter` (admin'e ekstra sıkı), ayrıca AI uçlarında Redis tabanlı
  `aiRateLimit` — Redis düşerse **fail-closed** (düşük in-memory tavan ile harcamayı kısar).
- **`/health`** ucu: DB + Redis pingler; kapanış sırasında (`isShuttingDown`) **503** döner
  ki yük dengeleyici trafiği başka replikaya kaydırsın (sıfır kesintili deploy).
- **SSE muafiyeti:** AI akışları (`text/event-stream`) gzip'lenmez — buffering keepalive
  ping'lerini geciktirirdi.

---

## 4. Backend katman mimarisi

Her klasörün tek bir işi vardır. Bağımlılık hep tek yönlüdür: route → controller → service →
(DB/dış servis). Saf hesaplama `utils/`'e ayrılır ve kolayca test edilir.

```mermaid
flowchart LR
    subgraph R["routes/"]
        direction TB
        r1["auth.js"]
        r2["restaurants.js"]
        r3["recommendations.js"]
        r4["...23 router"]
    end
    subgraph M["middleware/"]
        m1["auth · roles"]
        m2["rateLimit · sanitize"]
        m3["validate (zod)"]
    end
    subgraph C["controllers/"]
        c1["restaurantController"]
        c2["recommendationController"]
        c3["...domain başına 1"]
    end
    subgraph S["services/"]
        s1["googlePlaces"]
        s2["recommendationService"]
        s3["redis · firebase · email · s3"]
    end
    subgraph U["utils/ (saf, test edilebilir)"]
        u1["haversine · cuisineTags"]
        u2["premiumCheck · stars"]
    end
    subgraph DATA["Veri & Dış"]
        pg[("PostgreSQL<br/>Prisma")]
        rd[("Redis")]
        ext["Google / Claude"]
    end

    R --> M --> C
    C --> S
    C --> U
    S --> pg
    S --> rd
    S --> ext

    style R fill:#e8eaf6
    style C fill:#cde7ff
    style S fill:#fff3c4
    style U fill:#d6f5d6
```

**Anahtar desen — "saf çekirdek + kabuk":** Karmaşık karar mantığı dış dünyaya dokunmayan saf
fonksiyonlara taşınır (`utils/restaurantAnalytics.js`, `services/personalizationService.js`,
`services/friendSuggestionService.js`). Böylece 1100+ test, gerçek Google/AI çağrısı yapmadan
"şu girdi → bu çıktı mı?" diye saniyeler içinde koşar (`tests/setup.js` Firebase/Resend/
Anthropic'i mock'lar).

---

## 5. Mobil uygulama mimarisi

Veri akışı **tek yönlüdür**: Ekran → Store → Service → API → backend, sonra ters yönde state
güncellenir ve ekran otomatik yeniden çizilir.

```mermaid
flowchart TD
    SCR["📺 Screen (component)<br/>sadece gösterir"]
    STORE["🧠 Store (Zustand)<br/>uygulama hafızası"]
    SVC["🔌 service (services/*.ts)<br/>HTTP isteği hazırlar"]
    API["services/api.ts<br/>her isteğe Bearer token ekler"]
    BE["☁️ Backend"]

    SCR -->|"aksiyon çağır<br/>(login, fetchNearby)"| STORE
    STORE -->|"servisi çağır"| SVC
    SVC -->|"axios"| API
    API -->|"HTTPS"| BE
    BE -->|"JSON / SSE"| API
    API --> SVC
    SVC -->|"state güncelle"| STORE
    STORE -->|"re-render"| SCR

    style SCR fill:#fde2c8
    style STORE fill:#ffe0e0
    style SVC fill:#fff3c4
    style BE fill:#cde7ff
```

**Zustand store'ları (uygulamanın hafızası):**

| Store | Tutar |
|-------|-------|
| `authStore` | Oturum + rol (USER/RESTAURANT/ADMIN) |
| `restaurantStore` | Keşfet listesi + önbellek (stale-while-revalidate) |
| `aiRecommendationStore` | AI SSE akış durumu |
| `favoriteStore`, `collectionStore`, `friendStore` | Favori / liste / arkadaş |
| `messageStore`, `notificationStore` | Mesaj / bildirim |
| `themeStore` | Karanlık/aydınlık tema |

**Performans cilaları:**
- **Stale-while-revalidate (S15-P2):** Açılışta son listeyi diskten *anında* boyar, arka
  planda yenisini çekip sessizce değiştirir → skeleton bekleme yok (`utils/listCache.ts`).
- **Tipli API katmanı:** Servisler `src/types`'taki paylaşılan arayüzlere göre tiplenir
  (`tsc --noEmit` temiz).
- **Liste performansı:** `theme/listPerf.ts` ortak props + `React.memo`'lu kart satırları.

---

## 6. Üç rol ve ekran ağacı

Aynı uygulama, giriş yapan kişinin rolüne göre **tamamen farklı** bir ekran ağacı yükler
([navigation/index.tsx](neareat-mobile/src/navigation/index.tsx)).

```mermaid
flowchart TD
    APP([Uygulama açılır]) --> AUTHQ{Giriş yapıldı mı?}
    AUTHQ -- Hayır --> ONB["Onboarding<br/>+ RestaurantRegister"]
    AUTHQ -- Evet --> ROLEQ{user.role?}

    ROLEQ -- USER --> TABS["Bottom Tab (5 sekme)"]
    TABS --> t1["Keşfet (Home)"]
    TABS --> t2["Favoriler"]
    TABS --> t3["Listeler"]
    TABS --> t4["Mesajlar"]
    TABS --> t5["Profil"]

    ROLEQ -- RESTAURANT --> RAPQ{Onaylı mı?}
    RAPQ -- Hayır --> PEND["RestaurantPending<br/>(beklemede)"]
    RAPQ -- Evet --> RDASH["Restaurant Dashboard"]
    RDASH --> rd1["Analitik · Rezervasyon"]
    RDASH --> rd2["Kampanya · Menü · İndirim"]
    RDASH --> rd3["Yorum cevapları · Claude rapor"]

    ROLEQ -- ADMIN --> ADASH["Admin Dashboard"]
    ADASH --> ad1["Kullanıcı/restoran yönetimi"]
    ADASH --> ad2["Başvuru onayı"]
    ADASH --> ad3["Loglar · Metrikler · Job tetikleme"]

    style TABS fill:#d6f5d6
    style RDASH fill:#fff3c4
    style ADASH fill:#ffe0e0
```

Backend tarafında `middleware/roles.js` aynı yetkiyi her istekte sunucuda da doğrular —
istemciye asla güvenilmez.

---

## 7. Veri modeli (ER diyagramı)

**Kritik tasarım kararı:** Restoranların kendisi DB'de saklanmaz! Restoran verisi Google
Places'ten anlık gelir; DB sadece **kullanıcı verisini** tutar ve restorana bir `placeId`
(Google kimliği) ile bağlar. `User` her şeyin merkezindedir.

```mermaid
erDiagram
    User ||--o| Subscription : "premium tier"
    User ||--o{ Favorite : sahip
    User ||--o{ Review : yazar
    User ||--o{ Reservation : yapar
    User ||--o{ Collection : oluşturur
    User ||--o{ FriendRequest : "gönderir/alır"
    User ||--o{ AiRecommendationLog : "günlük limit"
    User ||--o{ ActivityEvent : "sosyal akış"
    User ||--o| RestaurantProfile : "B2B (restoran rolü)"
    User ||--o{ StarEvent : "oyunlaştırma"
    User ||--o{ UserReward : kazanır
    User ||--o{ Notification : alır
    User ||--o{ Message : "gönderir/alır"
    User ||--o{ PlaceView : "son baktıkların"
    User ||--o| FeedbackPreference : "AI zevk profili"

    Collection ||--o{ CollectionItem : içerir
    Collection ||--o{ CollectionShare : paylaşılır
    RestaurantProfile ||--o{ RestaurantPhoto : galeri
    RestaurantProfile ||--o{ RestaurantMenu : menü
    Review ||--o| ReviewReply : cevap
    MealGroup ||--o{ MealGroupMember : üye
    MealGroup ||--o{ RestaurantPoll : oylama
    RestaurantPoll ||--o{ PollOption : seçenek
    PollOption ||--o{ PollVote : oy

    Favorite }o--|| GooglePlaces : "placeId (DB dışı)"
    Review }o--|| GooglePlaces : "placeId (DB dışı)"
    Reservation }o--|| GooglePlaces : "placeId (DB dışı)"

    GooglePlaces {
        string placeId "Google'da tutulur"
        string name
        float rating
    }
```

> Toplam ~40 tablo var. Yukarıda en önemli ilişkiler gösterildi. `Subscription` premium tier'i
> kontrol eder (ücretsiz limitler `utils/premiumCheck.js`'te uygulanır); `PurchaseEvent` IAP
> satın alma defteridir (token HMAC-hash'li); `UserLog` admin denetim izidir.

---

## 8. Önemli akışlar

### 8.1 Giriş (iki yol → aynı JWT)

```mermaid
sequenceDiagram
    participant U as 📱 Mobil
    participant A as authController
    participant DB as PostgreSQL
    participant FB as Firebase

    alt E-posta + Şifre
        U->>A: POST /api/auth/login {email, password}
        A->>DB: kullanıcıyı bul
        A->>A: bcrypt ile şifre doğrula
    else Google ile giriş
        U->>FB: Google OAuth
        FB-->>U: Firebase idToken
        U->>A: POST /api/auth/google {idToken}
        A->>FB: idToken doğrula
        A->>DB: kullanıcı bul/oluştur
    end
    A->>A: JWT üret (imzalı)
    A-->>U: { token, user }
    Note over U: token saklanır →<br/>sonraki her istekte<br/>otomatik gönderilir
```

İki yol da **aynı JWT'yi** üretir; sonraki tüm uçlar fark gözetmez.

### 8.2 Yakındaki restoranlar (Redis maliyet kalkanı)

```mermaid
sequenceDiagram
    participant U as 📱 Mobil
    participant C as restaurantController
    participant RD as Redis
    participant GP as Google Places

    U->>C: GET /restaurants/nearby?lat&lng
    C->>RD: "nearby4:{tile}" var mı?
    alt Önbellekte VAR
        RD-->>C: hazır liste
        Note over C: Google'a para yok ✓
    else Önbellekte YOK
        C->>GP: 3 tip paralel<br/>(restaurant/cafe/takeaway)
        GP-->>C: ham yerler
        C->>C: passesQualityFilter<br/>(isim/tip/puan elemesi)
        C->>C: mesafe + tazelik etiketleri
        C->>RD: 2 saat TTL ile kaydet
        C->>C: recordExternalCall('google', cost)
    end
    C-->>U: filtrelenmiş liste (≤60)
```

Redis burada **maliyet kalkanı**: aynı bölgeden gelen yüzlerce kişiye Google bir kez ödenir.

### 8.3 AI yemek önerisi (katmanlı maliyet koruması + streaming)

```mermaid
sequenceDiagram
    participant U as 📱 Mobil
    participant C as recommendationController
    participant RD as Redis
    participant PB as promptBuilder
    participant CL as Claude (Anthropic)

    U->>C: POST /recommendations/... (SSE aç)
    C->>RD: 1) günlük limit? (free 1 Haiku / premium 30 Sonnet)
    alt limit aşıldı & cache yok
        C-->>U: 429 AI_DAILY_LIMIT
    else
        C->>RD: 2) rec-cache:{user}:{tile} var mı?
        alt kısa-TTL cache HIT
            RD-->>C: önceki öneri
            C-->>U: cached:true kartları (Claude'a $0)
        else MISS
            C->>PB: zevk profili topla<br/>(favori+yorum+arama+arkadaş+feedback)
            PB-->>C: sistem promptu
            C->>CL: SSE streaming başlat
            loop her parça
                CL-->>C: kart parçası
                C-->>U: card / note event (anında)
            end
            C-->>U: done
            Note over C,U: 15sn'de bir keepalive ping<br/>(Railway proxy timeout'u önler)
            C->>RD: sonucu cache'le + maliyet kaydet
        end
    end
```

Sıralama bilinçli: **önce limit, sonra cache, en son AI.** AI en pahalı kaynak olduğundan en
sona bırakılır.

---

## 9. Zamanlanmış işler (cron)

`jobs/` altındaki görevler kimse tetiklemese de zamanında çalışır. Çoklu replikada **aynı turun
iki kez çalışmaması** için Redis tabanlı kilit (`withCronLock`) kullanılır.

```mermaid
flowchart LR
    subgraph CRON["node-cron + withCronLock"]
        j1["reservationReminders<br/>saatlik: 24h+ bekleyen rez."]
        j2["smartNotifications<br/>kapanış/oylama hatırlat"]
        j3["feedbackAggregator<br/>haftalık: AI zevk profili"]
        j4["friendSuggestions<br/>her gece 03:00 (chunk'lı)"]
        j5["notificationCleanup<br/>eski bildirim temizliği"]
    end
    LOCK{"Redis kilidi al<br/>SET NX PX"}
    CRON --> LOCK
    LOCK -- "kazandı" --> RUN["bu replika çalıştırır"]
    LOCK -- "kaybetti" --> SKIP["atla (başka replika çalışıyor)"]
    LOCK -. "Redis down" .-> FAILOPEN["fail-open: çalıştır<br/>(tek-instance varsayımı)"]

    style RUN fill:#d6f5d6
    style SKIP fill:#eeeeee
    style FAILOPEN fill:#fff3c4
```

İkinci savunma hattı her işin **idempotency** kontrolüdür (ör. `pendingReminderSentAt` damgası
→ aynı hatırlatma iki kez gönderilmez). Admin manuel tetiklemeleri kilidi atlar, hep çalışır.

---

## 10. Dağıtım ve ölçeklenme

```mermaid
flowchart TB
    DEV["git push origin master"] --> RW["Railway otomatik<br/>derle + dağıt"]
    RW --> R1["backend replika 1"]
    RW --> R2["backend replika 2"]
    R1 --> PG[("PostgreSQL<br/>+ PgBouncer havuz")]
    R2 --> PG
    R1 --> RD[("Redis<br/>allkeys-lru")]
    R2 --> RD

    LB["Yük dengeleyici"] --> R1
    LB --> R2
    LB -. "/health 503 → drain" .-> R1

    APK["Android AAB/APK<br/>gradlew assembleRelease"] -. "elle dağıtım" .-> STORE["Play Store / cihaz"]

    style RW fill:#cde7ff
    style PG fill:#d6f5d6
    style RD fill:#ffe0e0
```

**10k kullanıcı hedefi için yapılanlar (Sprint-16):**
- **gzip sıkıştırma** (SSE muaf) · keep-alive timeout ayarı (502 önleme)
- **AI maliyet tavanı** (premium günlük cap) + kısa-TTL response cache
- **Google çağrı azaltma** (5 tip → 3 tip, %40 tasarruf) + 2 saat cache
- **friend-suggestions batch** (chunk'lı, tek Redis pipeline)
- **cron leader-lock** (replika-güvenli)
- **DB bağlantı havuzu** (`url`=pooler / `directUrl`=direct, PgBouncer)
- **yatay ölçeklenme** (graceful shutdown + `/health` drain → sıfır kesintili deploy)
- **metrik/alarm** (`GET /api/admin/metrics`: p50/p95/p99, hata oranı, dış API maliyeti)
- **k6 yük testleri** (sadece staging, production-guard'lı)

---

## Tek cümlede özet

> **Eatlas = "aptal ve hızlı" bir mobil arayüz (React Native + Zustand) + "akıllı ve korumalı"
> bir backend (Express + katmanlı boru hattı); backend kullanıcı verisini PostgreSQL'de tutar,
> restoranı Google'dan çeker ve Redis ile ucuzlatır, Claude ile kişiye özel öneri üretir
> (katman katman maliyet koruması), üç rolü (kullanıcı/restoran/admin) tek sistemde yönetir ve
> Railway'de replika-güvenli şekilde ölçeklenir.**
