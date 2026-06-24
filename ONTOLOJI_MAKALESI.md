# Bir Mobil Restoran Keşif Platformunun OWL Ontolojisi ile Modellenmesi: Eatlas (NearEat) Örneği

> Bu makale, **Eatlas (NearEat)** projesini referans alarak ontoloji ve OWL kavramlarını
> açıklar, projeden çıkarılan somut OWL ontolojisini ([neareat-ontology.ttl](neareat-ontology.ttl))
> adım adım ele alır ve sonuçta neyin elde edildiğini değerlendirir.

---

## İçindekiler

1. [Ontoloji nedir?](#1-ontoloji-nedir)
2. [OWL nedir?](#2-owl-nedir)
3. [Eatlas projesi kısaca](#3-eatlas-projesi-kısaca)
4. [Bu projede OWL neden kullanılır?](#4-bu-projede-owl-neden-kullanılır)
5. [Bu projede OWL nasıl kullanıldı? (Prisma → OWL eşlemesi)](#5-bu-projede-owl-nasıl-kullanıldı-prisma--owl-eşlemesi)
6. [Ontolojinin anatomisi](#6-ontolojinin-anatomisi)
7. [Çıkarım (reasoning) örnekleri](#7-çıkarım-reasoning-örnekleri)
8. [Örnek SPARQL sorguları](#8-örnek-sparql-sorguları)
9. [Sonuç olarak ne oldu?](#9-sonuç-olarak-ne-oldu)
10. [Kaynaklar ve araçlar](#10-kaynaklar-ve-araçlar)

---

## 1. Ontoloji nedir?

**Ontoloji**, bilgisayar bilimi ve yapay zekâ bağlamında, bir *alanı* (domain) oluşturan
**kavramları, bu kavramların özelliklerini ve aralarındaki ilişkileri** biçimsel (formal) ve
makine tarafından işlenebilir bir şekilde tanımlayan bir yapıdır. Felsefedeki "varlık bilimi"
teriminden ödünç alınır; ama bilişimde pratik bir anlamı vardır:

> Ontoloji = **paylaşılan bir kavramsallaştırmanın açık ve biçimsel betimlemesi**
> (Gruber'in klasik tanımı: *"an explicit specification of a shared conceptualization"*).

Bir ontolojinin temel yapı taşları şunlardır:

| Yapı taşı | Karşılığı | Eatlas örneği |
|-----------|-----------|---------------|
| **Sınıf (Class)** | Kavram / nesne türü | `Kullanıcı`, `Restoran`, `Yorum`, `Rezervasyon` |
| **Birey (Individual)** | Sınıfın somut örneği | "Deniz" adlı kullanıcı, "Balkon Restaurant" mekanı |
| **Özellik (Property)** | İlişki veya nitelik | `yorumYazdı`, `arkadaşı`, `puanDeğeri` |
| **Aksiyom (Axiom)** | Mantıksal kural/kısıt | "Bir yorumun puanı 1–5 arasındadır" |

Ontoloji ile **veri tabanı şeması** arasındaki fark önemlidir: Bir DB şeması veriyi *nasıl
sakladığımızı* söyler (tablolar, kolonlar, foreign key'ler). Ontoloji ise verinin *ne anlama
geldiğini* ve hangi mantıksal sonuçların çıkarılabileceğini söyler. Ontoloji **çıkarım
yapabilir** (reasoning): açıkça yazmadığınız gerçekleri mantıkla türetir. Veri tabanı bunu
yapmaz.

---

## 2. OWL nedir?

**OWL (Web Ontology Language)**, W3C tarafından standartlaştırılmış, ontolojileri yazmak için
kullanılan resmi bir dildir. Semantik Web yığınının (Semantic Web Stack) üst katmanlarında yer
alır:

```
        ┌──────────────────────────────┐
        │   OWL  (sınıflar, mantık,     │  ← çıkarım gücü en yüksek katman
        │        kısıtlar, çıkarım)     │
        ├──────────────────────────────┤
        │   RDFS (sınıf/özellik         │
        │        hiyerarşisi)           │
        ├──────────────────────────────┤
        │   RDF  (özne–yüklem–nesne     │  ← "üçlü" (triple) veri modeli
        │        üçlüleri)              │
        ├──────────────────────────────┤
        │   URI / IRI + XML/Turtle      │  ← adlandırma ve serileştirme
        └──────────────────────────────┘
```

- **RDF**, her bilgiyi `(özne, yüklem, nesne)` üçlüsü olarak ifade eder:
  `(Deniz, yorumYazdı, review_123)`.
- **RDFS**, sınıf/alt-sınıf ve özellik hiyerarşisi (`rdfs:subClassOf`, `rdfs:domain`,
  `rdfs:range`) ekler.
- **OWL**, bunların üzerine **betimleyici mantık (Description Logic)** tabanlı zengin
  yapılar ekler: ayrıklık (disjoint), kardinalite kısıtları (en fazla 5 favori), eşdeğer
  sınıflar, tersine özellikler (inverse), simetrik/geçişli özellikler, numaralandırmalar
  (`oneOf`) vb.

**OWL'un asıl gücü çıkarımdır (inference/reasoning).** Bir *reasoner* (HermiT, Pellet, ELK,
Fact++ gibi) ontolojiyi okur ve:
- Tutarlılığı kontrol eder (çelişki var mı?),
- Sınıf hiyerarşisini otomatik tamamlar,
- Bireyleri uygun sınıflara otomatik yerleştirir (classification),
- Açıkça yazılmamış ilişkileri türetir.

OWL'un farklı **profilleri** vardır (ifade gücü ↔ karar verilebilirlik dengesi):
**OWL 2 EL** (büyük ama basit ontolojiler, hızlı çıkarım), **OWL 2 QL** (veri tabanı/SPARQL
odaklı), **OWL 2 RL** (kural motorları), ve tam ifade gücü için **OWL 2 DL/Full**. Bu projedeki
ontoloji OWL 2 DL kapsamındadır.

OWL ontolojileri çeşitli **serileştirme** biçimlerinde yazılabilir: RDF/XML, **Turtle (.ttl)**,
JSON-LD, Manchester Syntax. Bu projede okunabilirliği yüksek olan **Turtle** seçilmiştir.

---

## 3. Eatlas projesi kısaca

**Eatlas (kod adı NearEat)**, yapay zekâ destekli, mobil öncelikli bir **restoran keşif
platformudur**. İki paketli bir monorepo'dur:

- **`neareat-backend`** — Node.js + Express + Prisma + PostgreSQL + Redis (Railway'de).
- **`neareat-mobile`** — React Native (Expo) + Zustand (Android).

Üç kullanıcı rolü vardır: **normal kullanıcı**, **restoran sahibi**, **admin**. Arayüz
Türkçedir.

Projenin **en kritik tasarım kararı** ontoloji açısından da belirleyicidir:

> **Restoranların kendisi veritabanında saklanmaz.** Restoran verisi Google Places'ten
> anlık olarak gelir; veritabanı yalnızca **kullanıcı-üretimli veriyi** (yorum, favori,
> rezervasyon, koleksiyon...) tutar ve her birini restorana bir `placeId` (Google kimliği)
> ile bağlar.

Bu karar, alanda **iki tür varlık** olduğunu söyler: (1) sistemin sahibi olduğu veri (kullanıcı
verisi) ve (2) sisteme dışarıdan gelen, yalnızca referansla bilinen varlık (mekan/restoran).
Ontolojide bu ikilik, soyut bir `ne:Place` (Mekan) sınıfı ve ona köprü kuran `ne:aboutPlace`
özelliği ile temiz biçimde modellenir.

---

## 4. Bu projede OWL neden kullanılır?

Eatlas pratikte ilişkisel bir veritabanı (PostgreSQL/Prisma) üzerinde çalışır; OWL üretim
sisteminin parçası değildir. Peki neden bir OWL ontolojisi çıkarmaya değer? Birkaç güçlü
gerekçe:

1. **Anlamsal (semantik) netlik ve ortak dil.** ~40 Prisma modeli, enum'lar, foreign key'ler
   ve dağınık iş kuralları (premium limitler, rezervasyon durum makinesi, rol yetkileri)
   tek bir biçimsel modelde toplanır. Yeni bir geliştirici, analist veya paydaş "sistem
   neyi neyle ilişkilendiriyor?" sorusunu tek bir kaynaktan, belirsizlik olmadan yanıtlar.

2. **İş kurallarını veriden bağımsız, makine-doğrulanabilir biçimde ifade etmek.**
   "Ücretsiz kullanıcı en fazla 5 favori ekleyebilir", "bir yorumun puanı 1–5 arasıdır",
   "bir kullanıcının en fazla bir restoran profili olur" gibi kurallar OWL kardinalite ve
   veri-aralığı kısıtlarına çevrilir. Bir reasoner bu kuralları test verisi üzerinde
   **otomatik doğrulayabilir** ve çelişkileri yakalayabilir.

3. **Çıkarım (inference) ile gizli bilgiyi açığa çıkarmak.** Veritabanı "Deniz'in aktif
   aboneliği var" der; ontoloji bundan **"Deniz bir PremiumUser'dır"** sonucunu otomatik
   türetir. "Deniz, Ayşe'nin arkadaşıdır" yazıldığında simetri kuralıyla tersi de türetilir.
   Bu, öneri/yetkilendirme mantığının deklaratif (bildirimsel) olarak ifade edilebileceği
   anlamına gelir.

4. **Bilgi grafiği (knowledge graph) ve gelişmiş öneri için temel.** Eatlas zaten bir
   kişiselleştirme/öneri motoru içeriyor (mutfak tercihleri, arkadaş sinyalleri, feedback
   aggregate'i). Mekanlar, mutfak etiketleri, kullanıcılar ve tercihler bir grafa
   dönüştürüldüğünde, "arkadaşımın beğendiği, benim sevdiğim mutfaktan, yakındaki yerler"
   gibi sorgular **graf/anlamsal düzeyde** ifade edilebilir.

5. **Birlikte çalışabilirlik (interoperability) ve veri entegrasyonu.** OWL/RDF standart
   olduğu için, Eatlas verisi `schema.org/Restaurant`, `FOAF` (arkadaşlık), `SKOS` (mutfak
   etiketi taksonomisi) gibi dış kelime dağarcıklarıyla eşlenebilir; başka veri kaynaklarıyla
   birleştirilebilir.

6. **Dokümantasyon ve eğitim değeri.** Ontoloji, kod tabanından bağımsız, kalıcı ve görselleştirilebilir
   (Protégé/WebVOWL) bir alan haritasıdır.

---

## 5. Bu projede OWL nasıl kullanıldı? (Prisma → OWL eşlemesi)

Ontoloji, doğrudan projenin **gerçek kaynaklarından** türetildi: `neareat-backend/prisma/schema.prisma`
(tek doğruluk kaynağı, ~40 model), `CLAUDE.md` mimari notları ve `MIMARI.md`. İzlenen eşleme
yöntemi sistematiktir:

| Prisma / mimari öğesi | OWL karşılığı | Örnek |
|------------------------|----------------|-------|
| `model` (tablo) | `owl:Class` | `User` → `ne:User`, `Reservation` → `ne:Reservation` |
| Birebir/bire-çok ilişki (FK) | `owl:ObjectProperty` (+ `owl:inverseOf`) | `Review.userId` → `ne:reviewAuthor` |
| Skaler kolon | `owl:DatatypeProperty` | `Review.rating` → `ne:ratingValue` |
| `enum` | `owl:Class` + `owl:oneOf` (numaralandırılmış bireyler) | `ReservationStatus` → 5 birey |
| `@unique` (tekil FK) | `owl:FunctionalProperty` / `owl:InverseFunctionalProperty` | `ownsRestaurantProfile` 1–1 |
| `UserRole` enum | Ayrık + kapsayıcı alt sınıflar | `RegularUser`/`RestaurantOwner`/`Admin` |
| İş kuralı (premium limit) | `owl:Restriction` (kardinalite) | `FreeTierUser ⊑ ≤5 hasFavorite` |
| Değer aralığı (`rating` 1–5) | `rdfs:Datatype` + `withRestrictions` | `ne:ratingValue` ∈ [1,5] |
| Google Places `placeId` (DB-dışı) | Soyut sınıf + köprü özellik | `ne:Place` + `ne:aboutPlace` |

**Namespace:** `http://www.eatlas.com/ontology/neareat#`, kısaltması `ne:`.

Eşlemede dikkat edilen birkaç tasarım kararı:

- **`UserRole`'ü düz bir enum yerine alt sınıf hiyerarşisi yaptık.** Çünkü rol, kullanıcının
  *davranışını ve sahip olabileceği ilişkileri* belirler (yalnızca `RestaurantOwner` bir
  `RestaurantProfile`'a sahiptir). `RegularUser`, `RestaurantOwner`, `Admin` birbirinden
  **ayrıktır** (`owl:AllDisjointClasses`) ve birlikte `User`'ı tam kaplar (`owl:unionOf`).

- **Premium/ücretsiz kademe iş kuralı kısıt olarak modellendi.** `FreeTierUser`, "en fazla 5
  favori" ve "en fazla 1 koleksiyon" kardinalite kısıtlarıyla tanımlandı; `PremiumUser` ise
  **aktif aboneliği olan kullanıcı** olarak *tanımlı (defined) sınıf* yapıldı. Böylece
  reasoner, abonelik durumuna bakarak kullanıcıyı otomatik premium olarak sınıflandırır.

- **Google Places ayrımı korundu.** Mekanlar `ne:Place` soyut sınıfıyla temsil edildi; favori,
  yorum, rezervasyon gibi içerikler ona `ne:aboutPlace` (ve alt-özelliği `ne:linkedToPlace`,
  `ne:suggestedPlace`) ile bağlandı — tıpkı kodda `placeId` ile bağlanması gibi.

---

## 6. Ontolojinin anatomisi

Üretilen [neareat-ontology.ttl](neareat-ontology.ttl) dosyası şu bölümlerden oluşur:

### 6.1 Üst düzey (soyut) sınıflar

Tüm somut sınıflar anlamsal gruplara toplanır:
`ne:Agent` (Kullanıcı/Restoran), `ne:Place` (mekan), `ne:UserGeneratedContent`,
`ne:SocialInteraction`, `ne:CommerceConcept`, `ne:GroupActivity`, `ne:AiArtifact`,
`ne:SystemRecord`. Bu üst sınıflar, ~40 modeli kafada toplanabilir 8 kategoriye indirger.

### 6.2 Kullanıcı ve roller

```turtle
ne:RegularUser     rdfs:subClassOf ne:User .
ne:RestaurantOwner rdfs:subClassOf ne:User .
ne:Admin           rdfs:subClassOf ne:User .

[] a owl:AllDisjointClasses ;
   owl:members ( ne:RegularUser ne:RestaurantOwner ne:Admin ) .

ne:User owl:equivalentClass
   [ a owl:Class ; owl:unionOf ( ne:RegularUser ne:RestaurantOwner ne:Admin ) ] .

# Tanımlı sınıf: restoran profili olan kullanıcı = RestaurantOwner
ne:RestaurantOwner owl:equivalentClass
   [ owl:intersectionOf ( ne:User
       [ a owl:Restriction ; owl:onProperty ne:ownsRestaurantProfile ;
         owl:someValuesFrom ne:RestaurantProfile ] ) ] .
```

### 6.3 Premium kademe (iş kuralı → mantık)

```turtle
ne:FreeTierUser rdfs:subClassOf ne:User ,
   [ a owl:Restriction ; owl:onProperty ne:hasFavorite ;
     owl:maxCardinality "5"^^xsd:nonNegativeInteger ] ,
   [ a owl:Restriction ; owl:onProperty ne:ownsCollection ;
     owl:maxCardinality "1"^^xsd:nonNegativeInteger ] ;
   owl:disjointWith ne:PremiumUser .

ne:PremiumUser owl:equivalentClass
   [ owl:intersectionOf ( ne:User
       [ a owl:Restriction ; owl:onProperty ne:hasSubscription ;
         owl:someValuesFrom ne:ActiveSubscription ] ) ] .
```

### 6.4 Numaralandırmalar (enum'lar)

Her Prisma enum'ı, `owl:oneOf` ile kapalı bir değer kümesine dönüştü:
`SubscriptionStatus`, `PlanType`, `FriendRequestStatus`, `ReservationStatus`,
`ApprovalStatus`, `StarEventType`, `RewardType`, `RestaurantPhotoKind`. Ayrıca mutfak
etiketleri `ne:CuisineTag` altında **SKOS** kavramları olarak verildi (`skos:prefLabel`).

### 6.5 Nesne ve veri özellikleri

- **Nesne özellikleri:** `ne:reviewAuthor` (fonksiyonel), `ne:ownsRestaurantProfile`
  (1–1: fonksiyonel + ters-fonksiyonel), `ne:isFriendOf` (**simetrik + irreflexive**),
  `ne:replyTo` (1–1), `ne:aboutPlace` (DB-dışı köprü) ve onun alt-özellikleri vb.
- **Veri özellikleri:** `ne:ratingValue` (1–5 kısıtlı tam sayı), `ne:email` (fonksiyonel),
  `ne:starCount`, `ne:placeId`, `ne:aiModel`, `ne:guestCount` vb.

### 6.6 Kısıtlar (aksiyomlar)

- Yorum: tam 1 puan + tam 1 yazar + en az 1 mekan.
- Rezervasyon: durumu yalnızca `ReservationStatus`, tam 1 restoran + tam 1 sahip.
- `ApprovedRestaurant`: durumu `AP_APPROVED` olan restoran profili (tanımlı sınıf).

### 6.7 Örnek bireyler (ABox)

Gösterim için birkaç birey eklendi: `ne:user_deniz` (aktif abonelikli normal kullanıcı),
`ne:user_ayse`, `ne:owner_kebapci` (+ `ne:profile_kebapci`), `ne:place_balkon`,
`ne:review_deniz_balkon` ve bir AI öneri logu. Bunlar reasoner çıkarımlarını sergilemek
içindir (bkz. sonraki bölüm).

---

## 7. Çıkarım (reasoning) örnekleri

Ontoloji bir reasoner'a (örneğin Protégé içinde **HermiT**) verildiğinde, **açıkça
yazılmamış** şu gerçekler otomatik türetilir:

1. **Premium sınıflandırma.** `ne:user_deniz`'in aboneliği `active` durumdadır →
   `ne:sub_deniz` bir `ne:ActiveSubscription`'dır → `ne:user_deniz` bir **`ne:PremiumUser`**
   olarak sınıflandırılır. (Hiçbir yerde "Deniz premium'dur" yazılmadı.)

2. **Simetrik arkadaşlık.** `ne:user_deniz ne:isFriendOf ne:user_ayse` yazıldı; `isFriendOf`
   simetrik olduğundan **`ne:user_ayse ne:isFriendOf ne:user_deniz`** türetilir.

3. **Restoran sahibi çıkarımı.** Eğer bir bireyin `ne:ownsRestaurantProfile` ile bir restoran
   profiline bağlandığı bilinseydi (ve `User` olduğu), reasoner onu **`ne:RestaurantOwner`**
   olarak sınıflandırırdı (tanımlı sınıf).

4. **Onaylı restoran.** `ne:profile_kebapci`'nin durumu `AP_APPROVED` olduğundan, o bir
   **`ne:ApprovedRestaurant`**'tır (yani rezervasyon kabul edebilecek adaydır).

5. **Tutarlılık denetimi.** Eğer bir kullanıcıya hem `RegularUser` hem `Admin` denilirse,
   bu sınıflar ayrık olduğu için reasoner **tutarsızlık** raporlar. Aynı şekilde bir
   `FreeTierUser`'a 6. favori eklenmeye çalışılırsa kardinalite kısıtı ihlal edilir.

Bu örnekler OWL'un katma değerini özetler: **veriyi tekrar yazmadan, kuralların mantıksal
sonuçlarını makineye türettirmek.**

---

## 8. Örnek SPARQL sorguları

Ontoloji + bireyler bir üçlü deposunda (triple store) tutulduğunda SPARQL ile sorgulanabilir:

```sparql
PREFIX ne: <http://www.eatlas.com/ontology/neareat#>

# 1) Premium kullanıcılar (reasoner sonrası — açıkça işaretlenmemiş olsalar bile)
SELECT ?user WHERE { ?user a ne:PremiumUser . }

# 2) Bir kullanıcının arkadaşlarının yorumladığı mekanlar (sosyal keşif)
SELECT DISTINCT ?placeName WHERE {
  ne:user_deniz ne:isFriendOf ?friend .
  ?review ne:reviewAuthor ?friend ;
          ne:aboutPlace ?place .
  ?place ne:placeName ?placeName .
}

# 3) Deniz'in sevdiği mutfaktan, onaylı restoranlar
SELECT ?placeName WHERE {
  ne:user_deniz ne:prefersCuisine ?tag .
  ?place ne:hasCuisineTag ?tag ; ne:placeName ?placeName .
  ?profile ne:linkedToPlace ?place ; a ne:ApprovedRestaurant .
}

# 4) AI önerilerinde premium model (Sonnet) maliyet izleme
SELECT ?log ?tokens WHERE {
  ?log a ne:AiRecommendationLog ;
       ne:aiModel "claude-sonnet-4-6" ;
       ne:promptTokens ?tokens .
}
```

---

## 9. Sonuç olarak ne oldu?

Bu çalışmada, gerçek bir üretim projesi olan **Eatlas (NearEat)**'in alan modeli, kod
tabanından (özellikle Prisma şemasından ve mimari dokümanlardan) sistematik biçimde
çıkarılarak **biçimsel bir OWL 2 DL ontolojisine** dönüştürüldü. Somut çıktılar:

- **[neareat-ontology.ttl](neareat-ontology.ttl)** — Turtle biçiminde, içinde:
  - **8 üst düzey soyut sınıf** + **40+ somut sınıf** (kullanıcı/rol, içerik, sosyal,
    ticaret, grup, AI, sistem, restoran B2B),
  - **9 numaralandırma** (`owl:oneOf`) ve SKOS mutfak etiketleri,
  - **30+ nesne özelliği** (fonksiyonel, ters, simetrik, irreflexive karakteristikleriyle)
    ve **25+ veri özelliği** (değer-aralığı kısıtlı puan dâhil),
  - rol ayrıklığı, premium/ücretsiz kademe kardinalite kuralları, onaylı restoran ve
    rezervasyon durum kısıtları gibi **iş kurallarının mantıksal aksiyomları**,
  - çıkarımı sergileyen **örnek bireyler (ABox)**.
- **[ONTOLOJI_MAKALESI.md](ONTOLOJI_MAKALESI.md)** — bu makale (kavramsal çerçeve + eşleme
  yöntemi + çıkarım/SPARQL örnekleri).

**Kazanımlar:**

1. Dağınık (kod, enum, FK, yorum satırları) hâldeki alan bilgisi **tek, biçimsel ve
   makine-okunur bir modelde** toplandı.
2. Daha önce yalnızca controller kodunda gömülü olan **iş kuralları açık aksiyomlara**
   dönüştü; artık bir reasoner ile doğrulanabilir, tutarsızlık tespit edilebilir.
3. OWL'un asıl katma değeri olan **çıkarım** somut örneklerle gösterildi (premium
   sınıflandırma, simetrik arkadaşlık, onaylı restoran).
4. Sistem, **bilgi grafiği / anlamsal öneri / dış kelime dağarcıklarıyla entegrasyon**
   gibi ileri çalışmalar için sağlam bir temele kavuştu.

**Önemli bir not:** Ontoloji projenin üretim mimarisini *değiştirmez* — Eatlas ilişkisel
veritabanıyla çalışmaya devam eder. Ontoloji, sistemin **anlamını** yakalayan tamamlayıcı
bir katman, bir *anlamsal sözleşmedir*: dokümantasyon, doğrulama ve gelecekteki akıllı
özellikler için ortak ve kesin bir zemin.

**Olası sonraki adımlar:** ontolojiyi Protégé'de bir reasoner ile koşturup classification
sonuçlarını görselleştirmek; `schema.org`/`FOAF`/`SKOS` ile hizalama (alignment); Prisma
verisini RDF üçlülerine dönüştüren bir ETL (R2RML benzeri) ile gerçek veriyi ontolojiye
beslemek; ve öneri motorunun bazı kurallarını SWRL/SPARQL kuralları olarak deklaratif ifade
etmek.

---

## 10. Kaynaklar ve araçlar

- **Proje kaynakları:** `neareat-backend/prisma/schema.prisma`, `CLAUDE.md`, `MIMARI.md`.
- **Standartlar:** W3C OWL 2 (Web Ontology Language), RDF 1.1, RDFS, SKOS, SPARQL 1.1, Turtle.
- **Düzenleme/görselleştirme:** [Protégé](https://protege.stanford.edu/) (ontoloji editörü +
  gömülü HermiT reasoner), WebVOWL (görselleştirme).
- **Reasoner'lar:** HermiT, Pellet, ELK, FaCT++.
- **Önerilen kullanım:** `neareat-ontology.ttl` dosyasını Protégé ile açın, *Reasoner →
  HermiT → Start reasoner* deyin; `user_deniz`'in çıkarılan türleri arasında `PremiumUser`'ı,
  `profile_kebapci` için `ApprovedRestaurant`'ı görün.
