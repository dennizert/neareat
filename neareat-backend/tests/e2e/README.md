# E2E Testleri — "Arayüzsüz Frontend" Testi

Bu paket, **mobil uygulamanın yerine geçerek** backend'i gerçek bir kullanıcı gibi kullanır:
kaydol, giriş yap, restoran ara, rezervasyon yap, restoran onaylasın, katılımı işaretlesin.
Arayüz (React Native) çalıştırılmaz — onun yerine mobilin servis katmanını **birebir yansıtan**
bir API istemcisi kullanılır.

## Neden mevcut `tests/integration` yetmiyor?

| | `tests/integration` | `tests/e2e` (bu paket) |
|---|---|---|
| Veritabanı | **Mock'lu** Prisma | **Gerçek** Postgres |
| Kapsam | Tek uç noktası | Çok adımlı kullanıcı yolculuğu |
| Aktör | Tek | Çoklu (kullanıcı + restoran + admin aynı veri üzerinde) |
| Hız | Saniyeler | ~10 sn (DB kurulumu ister) |
| CI'da | Her PR'da | Her PR'da (ayrı job) |

Mock'lu pakette her Prisma çağrısının dönüşü elle yazılır. Bu, **adımların birbirine
bağlanmasını imkânsız kılar**: "restoranın panelinde gördüğü talep, kullanıcının az önce
oluşturduğu talep midir?" sorusu orada test edilemez, çünkü restoranın gördüğü şey de elle
yazılmış bir stub'dır. Gerçek veritabanı bu zinciri kurar.

İkisi birbirinin yerine geçmez: mock'lu paket hızlı ve altyapısızdır (kenar durumlar, hata
dalları için ideal), E2E ise akışların gerçekten birlikte çalıştığını gösterir.

## Kurulum

E2E paketi **çalışan bir PostgreSQL** ister. Veritabanı adında `test` geçmelidir —
`setup/database.js` bunu zorunlu tutar (paket `TRUNCATE` çalıştırdığı için yanlış
veritabanına bağlanmak geri alınamaz veri kaybı demektir).

### Seçenek 1 — Docker (en kolay)

```bash
docker run -d --name neareat-test-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=neareat_test \
  -p 5433:5432 postgres:16

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/neareat_test"
npm run test:e2e
```

### Seçenek 2 — Yerel PostgreSQL

```bash
createdb neareat_test
export DATABASE_URL="postgresql://$USER@127.0.0.1:5432/neareat_test"
npm run test:e2e
```

`DATABASE_URL` verilmezse varsayılan `postgresql://postgres:postgres@127.0.0.1:5433/neareat_test`
denenir. Migration'lar paket başlarken otomatik uygulanır.

## Yapı

```
tests/e2e/
  setup/
    env.js          # Ortam değişkenleri — uygulama YÜKLENMEDEN önce çalışır
    globalSetup.js  # Migration'ları bir kez uygular
    database.js     # TRUNCATE + güvenlik kilidi (test-dışı DB reddedilir)
    externals.js    # Dış servis sahteleri + yakalanan e-posta kutusu
    jestSetup.js    # Mock kurulumu + her testten önce DB sıfırlama
  client/
    apiClient.js    # ARAYÜZ SİMÜLATÖRÜ — mobil services/ katmanının aynası
  factories.js      # Sahne hazırlığı: kullanıcı, restoran, admin, arkadaşlık
  journeys/
    *.e2e.js        # Kullanıcı yolculukları
```

## Yolculuk nasıl yazılır

Testler **kullanıcı eylemi** gibi okunmalı, HTTP ayrıntısı gibi değil:

```js
const { client: user } = await createUser(app, { starCount: 120 });
const { profile, client: restaurant } = await createRestaurant(app, { seatCapacity: 50 });

const created = await user.reservations.create({ placeId: profile.placeId, date, time, guestCount: 4 });
const pending = await restaurant.reservations.getForRestaurant('PENDING');
expect(pending[0].id).toBe(created.id);   // restoran, kullanıcının YAZDIĞI kaydı görüyor
```

**Kurallar:**

1. **Yolculuğun konusu olan her adım istemci üzerinden yapılır.** Fabrikalar yalnızca
   *ön koşul* kurar (onaylı restoran, belirli seviyede kullanıcı). Test edilen akışı
   fabrikayla kurarsanız test hiçbir şey doğrulamaz.
2. **Hatalar mobilin gördüğü gibi doğrulanır.** İstemci 2xx dışı yanıtta `status` ve `body`
   taşıyan bir hata fırlatır; mobil `err.body.code`'a dallandığı için testler de öyle yapar:
   ```js
   await expect(user.reservations.create({...})).rejects.toMatchObject({ status: 403 });
   expect(err.body.code).toBe('LEVEL_REQUIRED');
   ```
3. **Yeni uç eklerken `apiClient.js`'e de ekleyin.** İstemci mobilin `services/*.ts`
   katmanının aynasıdır; senkron kalması sözleşmenin test edilmesini sağlar.
4. **E-posta gerektiren akışlarda gelen kutusunu okuyun** — kullanıcının linke tıklamasının
   karşılığı budur:
   ```js
   const mail = lastEmailTo(email);
   await client.auth.verifyEmail(extractTokenFromEmail(mail));
   ```

## Bilinen kısıtlar

- **Testler paralel çalışmaz** (`maxWorkers: 1`). Aynı veritabanını paylaşıp aralarında
  `TRUNCATE` ettikleri için bir dosyanın temizliği diğerinin verisini silerdi.
- **Hız limiti bütçesi dosya başına.** Uygulamanın rate limit'i test modunda kapatılmaz
  (bazı mevcut testler 429 davranışına dayanıyor; üretim kodunu test için gevşetmek doğru
  olmazdı). Jest her test dosyasına ayrı modül kaydı verdiğinden sayaçlar dosya başına
  sıfırlanır: **~120 `/api` ve ~20 `/api/auth` isteği**. Bir dosya bu bütçeye yaklaşırsa
  yolculukları yeni bir `.e2e.js` dosyasına bölün.
- **Redis kasıtlı olarak yapılandırılmamıştır.** Uygulama Redis'siz fail-open davranır ve
  E2E bu yolu kullanır. Ölçüldü: mevcut yolculuklar Redis'e hiç yazmıyor (koşu öncesi/sonrası
  `dbsize` 0), çünkü cache'li uçlar bu yolculukların konusu değil — CI'a Redis servisi
  eklemek bugün sıfır kapsam kazandırırdı. Cache'e dayanan bir yolculuk yazarsanız
  `REDIS_URL` verin (gerçek Redis'le de yeşil doğrulandı) ve CI job'ına servis ekleyin.
- **`--forceExit` KULLANILMIYOR** (hızlı paketten farklı olarak). Sızan bir handle'ı
  maskelemek yerine görmek istiyoruz. Bunun bedeli: teardown'dan sonra `console` yazan
  her şey Jest'te "Cannot log after tests are done" hatasına ve **testler geçse bile
  çıkış kodu 1**'e yol açar. Bu yüzden `jestSetup.js` `afterAll`'da Prisma'nın yanı sıra
  **Redis bağlantısını da kapatır** — ioredis erişilemeyen sunucuya arka planda yeniden
  bağlanmayı deneyip her denemede log yazıyordu ve bu loglar dosya sınırından sonra
  düşebiliyordu. Arka planda iş başlatan yeni bir bağımlılık eklerseniz onu da burada
  kapatın.
- **Dış servisler sahtedir** (Google Places, Anthropic, Firebase, Resend, S3). Gerçek
  entegrasyonları doğrulamak bu paketin işi değil; burada doğrulanan, *bizim* akışlarımızın
  birlikte çalışması.
