# Eatlas web paneli: bileşenler ve token'lar

Faz 0 adım 2 çıktısı. Frontend (`neareat-web`) bu belgeyi ve `eatlas-web.css` dosyasını doğrudan kullanır.
Prototipi açmak için `index.html` dosyasını tarayıcıda açın; her ekranda üstteki kesikli
"Prototip durumu" çubuğu o ekranın durumlarını değiştirir (bu çubuk üretime taşınmaz).

| Dosya | İçerik |
|---|---|
| `eatlas-web.css` | Token'lar (açık/koyu) ve bütün bileşen sınıfları. Tek kaynak budur. |
| `proto.js` | Tema anahtarı, mobil çekmece, sekme, dialog. Yalnız davranış örneği; API yok. |
| `index.html` | Ekran listesi ve bileşen galerisi (tüm durumlar) |
| `giris.html` … `admin-loglar.html` | 11 ekran |
| `_kaynak/` | Ekranları üreten betik (`python3 _kaynak/build.py .`). Ekran HTML'ini elle değil buradan değiştirin. |

Dış kaynak: yalnız Google Fonts (Plus Jakarta Sans). Font yüklenmezse sistem fontuna düşer.

---

## 1. Token'lar

Temel `lezzet-renk-sistemi.css`. Marka çekirdeği değişmedi. Web'de **erişilebilirlik düzeltmesi** yapılan değerler:

| Token | Mobil kaynak | Web | Neden |
|---|---|---|---|
| `--btn-primary-bg` (açık) | `#E84427` | `#C7381E` | Beyaz yazıyla 3.97:1 idi, AA altı. Yeni: 5.23:1 |
| `--text-tertiary` (açık) | `#8C8198` | `#6E6479` | 3.45 → 5.23:1 |
| `--text-tertiary` (koyu) | `#7E7589` | `#9A90A6` | 3.82 → 5.51:1 |
| `--success/--warning/--danger/--info` (açık) | parlak tonlar | `#0F7A55 / #8A5A00 / #B42318 / #0F766E` | Parlak tonlar açık zeminde metin olarak okunmuyordu |

Mobil uygulamada aynı sorun var (açık temada `#E84427` buton). Ayrı iş olarak `mobil-gelistirici`ye bildirilmeli.

### Renk (temaya göre değişir)

Tema: varsayılan sistem tercihi; `<html data-theme="light|dark">` kullanıcı seçimini zorlar. Seçim `localStorage['eatlas-theme']` içinde (try/catch ile).

| Token | Açık | Koyu | Kullanım |
|---|---|---|---|
| `--bg-base` | `#FBF7F2` | `#16121C` | Sayfa zemini |
| `--bg-surface` | `#FFFFFF` | `#211B2A` | Kart, yan menü, input |
| `--bg-elevated` | `#FFFFFF` | `#2D2536` | Modal |
| `--bg-subtle` | `#F4EEE7` | `#1C1724` | Tablo başlığı, iskelet, dropzone |
| `--bg-hover` | `#F1E9E0` | `#2A2333` | Satır ve menü üzerine gelme |
| `--border` / `--border-strong` | %10 / %18 siyah | %10 / %18 beyaz | Kart ve ayraç (dekoratif) |
| `--border-input` | `#8C8198` | `#7E7589` | Form alanı sınırı (3:1 üstü, WCAG 1.4.11) |
| `--text-primary` | `#1F1A24` | `#F7F1EA` | Gövde |
| `--text-secondary` | `#5C5366` | `#B9AEC4` | Açıklama |
| `--text-tertiary` | `#6E6479` | `#9A90A6` | Etiket, ipucu, placeholder |
| `--text-link` | `#B8341A` | `#FF7A5F` | Bağlantı |
| `--btn-primary-bg / -text` | `#C7381E` / beyaz | `#FF5A3C` / `#16121C` | Birincil buton |
| `--btn-primary-hover / -active` | `#B23219` / `#9C2B15` | `#FF6E55` / `#E84427` | |
| `--focus-ring` | `#C7381E` | `#FF7A5F` | 2px outline, 2px ofset |
| `--success` + `-bg` | `#0F7A55` / `#E3F5EE` | `#34D399` / %14 | Onaylı, Müsait |
| `--warning` + `-bg` | `#8A5A00` / `#FFF3D6` | `#FBBF24` / %14 | Bekliyor, Az yer kaldı |
| `--danger` + `-bg` | `#B42318` / `#FDE8E6` | `#F87171` / %14 | Reddedildi, Dolu, hata |
| `--info` + `-bg` | `#0F766E` / `#DFF5F2` | `#2DD4BF` / %14 | Tamamlandı, bilgi |
| `--amber-text` + `--amber-bg` | `#8A5A00` / `#FFF3D6` | `#FFB627` / %16 | Öncelikli kullanıcı rozeti |
| `--bar-track` | `#EDE5DC` | `#3A3344` | İlerleme ve doluluk izi |
| `--bar-available/limited/full` | `#1E9E6A / #E39B00 / #D63A2A` | status tonları | Yalnız doluluk barı dolgusu. Metinde kullanılmaz |
| `--brand-gradient` | coral → turuncu → amber | aynı | Yalnız logo |

### Tipografi

`--font-sans`: Plus Jakarta Sans, sistem yedeği. Rakamlarda `.num` (tabular-nums).

| Token | Boyut / satır | Kullanım |
|---|---|---|
| `--fs-xs` | 12/16 | Rozet, ipucu, hata metni |
| `--fs-sm` | 14/20 | Tablo, buton, etiket |
| `--fs-md` | 16/24 | Gövde, input (iOS'ta yakınlaştırmayı önler) |
| `--fs-lg` | 18/26 | Kart başlığı (h3) |
| `--fs-xl` | 22/30 | h2; telefonda h1 |
| `--fs-2xl` | 28/36 | h1, stat değeri |
| `--fs-3xl` | 36/44 | Fiyat |

Ağırlık: 400 / 500 / 600 / 700, logo 800.

### Boşluk, köşe, boyut

- Boşluk: `--space-1..12` = 4, 8, 12, 16, 20, 24, 32, 40, 48 px. Tek seferlik değer kullanılmaz.
- Köşe: `--radius-sm` 8 · `--radius-md` 12 (buton, input) · `--radius-lg` 18 (kart, modal) · `--radius-pill`.
- `--control-h` 44px: bütün buton ve input'ların alt sınırı (dokunma hedefi). `--control-h-sm` 36px yalnız masaüstü tabloda; `pointer: coarse` cihazda 44'e çıkar.
- `--sidebar-w` 248 · `--topbar-h` 60 · `--content-max` 1200.
- Gölge: `--shadow-sm` (kart), `--shadow-md` (toast), `--shadow-lg` (modal, çekmece).

### Kırılım noktaları

| Genişlik | Davranış |
|---|---|
| > 960px | Yan menü sabit, içerik sağda |
| ≤ 960px | Yan menü çekmece olur (hamburger, arka perde, Esc kapatır) |
| ≤ 720px | `.table-stack` tablolar satır başına karta dönüşür |
| ≤ 600px | İçerik iç boşluğu 16px, h1 22px, sayfa başı butonu tam genişlik |
| ≤ 480px | Modal alttan açılan sayfa olur, footer butonları eşit genişlikte |

---

## 2. Bileşenler

Her bileşenin bütün durumları `index.html` galerisinde görünür. Önerilen React adları parantez içinde.

### Düzen

| Bileşen | Sınıflar | Not |
|---|---|---|
| Uygulama kabuğu (`AppShell`) | `.app > .sidebar + .drawer-backdrop + .main > .topbar + main.content` | Mobilde çekmece: `.app[data-drawer="open"]`. Açılınca odak ilk menü öğesine, kapanınca hamburger'e döner. "İçeriğe atla" bağlantısı (`.skip-link`) var. |
| Yan menü (`SideNav`) | `.nav-group`, `.nav-group-title`, `.nav-link[aria-current="page"]`, `.nav-link .badge` | Restoran: Genel, İşletme, Büyüme, Hesap. Admin: Genel, Yönetim, Sistem. Bekleyen sayısı rozetle. |
| Üst çubuk (`TopBar`) | `.topbar`, `.menu-btn`, `.topbar-title`, `.topbar-actions`, `.avatar` | Ortada restoran adı ya da "Sistem Yöneticisi" (mobil AppHeader ile aynı). |
| Giriş düzeni (`AuthLayout`) | `.auth > .auth-card(.wide) > .auth-head + .card + .auth-foot` | Tema düğmesi `.theme-float`. |
| Sayfa başı (`PageHeader`) | `.page-head` (h1 + p, sağda eylem) | |
| Izgara | `.grid.grid-2` (≥320px sütun), `.grid.grid-stats` (≥150px; telefonda 2 sütun) | |

### Eylem

| Bileşen | Sınıflar | Durumlar |
|---|---|---|
| Buton (`Button`) | `.btn` + `.btn-primary / -secondary / -ghost / -danger / -success / -google` + `.btn-sm / -block / -icon` | varsayılan, `:hover`, `:active`, `:focus-visible`, `:disabled` / `aria-disabled`, yükleniyor `aria-busy="true"` (dönen gösterge, metin gizli, tıklama kapalı). İkon butonunda `aria-label` zorunlu. |
| Tema düğmesi (`ThemeToggle`) | `[data-theme-toggle]` + `.ico-moon/.ico-sun` | `aria-pressed` koyu temada true. |

### Form

| Bileşen | Sınıflar | Durumlar ve kurallar |
|---|---|---|
| Alan (`Field`) | `.field > .label + control + .hint / .error-text` | Hata: `aria-invalid="true"` + `aria-describedby` hata metnine. İsteğe bağlı: `.label .opt`. |
| Metin, seçim, çok satır | `.input`, `.select`, `.textarea` | varsayılan, hover, focus (halka), hata, disabled |
| Şifre (`PasswordInput`) | `.input-group` + `.input-action[data-toggle-password]` | göster/gizle, `aria-pressed` |
| Onay kutusu, radyo | `.check > input + span` | 44px satır yüksekliği |
| 2FA kodu (`OtpInput`) | `.input.otp`, `inputmode="numeric" autocomplete="one-time-code"` | |
| Dosya yükleme (`FileDrop`) | `label.dropzone` + gizli `input[type=file]` | `data-state="done"` / `"error"` |
| Tarih gezgini (`DateNav`) | `.date-nav` (önceki, `input[type=date]`, sonraki, Bugün) | |
| Adım göstergesi (`Stepper`) | `ol.stepper > li[data-done] / li[aria-current="step"]` + `.stepper-label` | |

### Veri gösterimi

| Bileşen | Sınıflar | Not |
|---|---|---|
| Kart (`Card`) | `.card`, `.card-header`, `.card-flush` (tablo için iç boşluksuz) | |
| Rozet (`StatusBadge`) | `.badge` + `-success / -warning / -danger / -info / -priority`, `.no-dot` | Durum hiçbir zaman yalnız renkle verilmez, metin her zaman var. |
| Duyarlı tablo (`DataTable`) | `table.table.table-stack`, her `td` için `data-label`, ilk hücre `.cell-primary`, eylemler `.cell-actions` | 720px altında kart. Mobilde eylem butonları tam genişlik ve 44px. `caption.sr-only` ekleyin. |
| Sekmeli filtre (`StatusTabs`) | `.tabs[role=tablist] > .tab[role=tab][aria-selected] > .count` | Ok tuşlarıyla gezilir. Mobilde yatay kayar. |
| İstatistik kutusu (`StatTile`) | `.stat > .stat-label + .stat-value + .stat-meta`, eşik aşımı `data-status="breach"` | Eşik aşımı rozetle de yazılır. |
| İlerleme (`ProgressBar`) | `.progress > span` + `role="progressbar"` ve `aria-value*` | Trial sayacı |
| Doluluk satırı (`OccupancyRow`) | `ul.occ-list > li.occ-row[data-band="available/limited/full"]` | Bar `role="img"` ve tam metin `aria-label` taşır. Bant etiketi her satırda yazılı. Bant mantığı mobil `utils/occupancyBand.ts` ile birebir: <%70 Müsait, %70+ Az yer kaldı, %100 Dolu. |
| Özet listesi (`SummaryList`) | `dl.summary > dt + dd` | Modal ve başvuru özeti |
| Uyarı ve banner (`Alert`) | `.alert` + `-success / -warning / -danger`, `.alert-body`, `.alert-action` | Hata `role="alert"`, bilgi `role="status"`. |
| Boş durum (`EmptyState`) | `.empty > .empty-icon + h2 + p + .btn` | |
| İskelet (`Skeleton`) | `.skeleton` | `prefers-reduced-motion` altında animasyon kapalı |
| Toast (`Toast`) | `.toast-region > .toast[role=status]` | Mobil `useToast` karşılığı |

### Katman

| Bileşen | Sınıflar | Davranış |
|---|---|---|
| Modal (`Dialog`) | yerel `dialog.modal` + `.modal-header / -body / -footer` | `showModal()`: odak kapanı, Esc ile kapanma ve arka perde tarayıcıdan gelir. `aria-labelledby` başlığa. 480px altında alttan sayfa. |
| Çekmece | `.sidebar` + `.drawer-backdrop` | Esc ve perdeye tıklama kapatır |

---

## 3. Ekranlar ve davranış notları

| Ekran | Dosya | Durumlar | Kaynak |
|---|---|---|---|
| Giriş | `giris.html` | normal, hatalı şifre, yanlış rol (USER panele giremez), 429 kilidi, admin 2FA | `routes/auth.js`, ADR (2FA) |
| Şifre sıfırlama | `sifre-sifirla.html` | talep, gönderildi (hesap var/yok aynı mesaj, enumeration yok), yeni şifre (eşleşmeme hatası), başarılı, geçersiz/süresi dolmuş bağlantı | S14-B1 throttle 3/saat |
| Restoran başvurusu | `kayit.html` | 5 adım: Hesap, İşletme (vergi no 10 hane), Vergi levhası (JPG/PNG/PDF, 5 MB), Restoran seçimi, Özet + koşul onayı; "inceleniyor" | Mobil `RestaurantRegisterScreen`, `RestaurantPendingScreen` (K7) |
| Genel bakış | `panel.html` | trial bitiyor banner'ı, abonelik yok banner'ı (`SUBSCRIPTION_REQUIRED`), banner yok | Mobil `RestaurantDashboardScreen` |
| Rezervasyonlar | `rezervasyonlar.html` | Bekleyen / Onaylı / Tamamlandı / Reddedildi / Tümü; onay modalı (rezerve koltuk, varsayılan `guestCount`, 1-5000, kapasite aşımı uyarısı); red modalı (neden zorunlu); katılım (Geldi/Gelmedi) onayı; L3+ "Öncelikli kullanıcı" rozeti | Mobil `RestaurantReservationsScreen`, S19-3/S19-4 |
| Doluluk | `doluluk.html` | normal, yükleniyor, kapasite girilmemiş, abonelik gerekli | Mobil `RestaurantOccupancyScreen`, S19-5 |
| Abonelik | `abonelik.html` | deneme (kartsız, sayaç), deneme + abone (ilk çekim deneme bitiminde, K4), aktif, ödeme sorunu (3 gün tolerans, K5), iptal (dönem sonuna kadar, kısmi iade yok, K5), Google Play abonesi (K6) | Faz 3, ADR |
| Admin metrikler | `admin-metrikler.html` | alarm banner'ı, stat'lar (S16-2 eşikleri), maliyet, platform sayıları, job tetikleme (onay modalı) | `GET /api/admin/metrics` |
| Restoran onayları | `admin-onaylar.html` | Bekleyen / Onaylı / Reddedilen, inceleme modalı (levha önizleme, not; redde not zorunlu) | Mobil `AdminRestaurantDetailScreen` |
| Kullanıcılar | `admin-kullanicilar.html` | arama, rol ve durum filtresi, askıya alma modalı, sayfalama | `routes/admin.js` |
| Loglar | `admin-loglar.html` | e-posta, seviye, tarih filtresi, CSV, daha fazla yükle | Mobil `AdminLogsScreen` |

Yan menüdeki soluk öğeler (Bilgiler, Saatler, Menü, Yorumlar, İndirim, Kampanya, Analitik, Moderasyon, Yer talepleri) bu prototipte çizilmedi. Hepsi form ve liste ekranıdır; yukarıdaki bileşenlerle mobil ekranlardaki alanlar birebir kurulur.

### iyzico ödeme alanı

- Gömme noktası: `<div id="iyzipay-checkout-form" class="responsive">` (`.payment-slot` içinde). Form, iki yasal onay kutusu işaretlenmeden yüklenmez.
- Kart verisi hiçbir zaman bizim DOM'umuza ya da sunucumuza gelmez (PCI SAQ-A). Akışın teknik ayrıntısı ADR-001'dedir.
- En az yükseklik 420px; telefonda tam genişlik.

### Metin ve biçim kuralları

- Para: `1.299,90 ₺` (nokta binlik, virgül ondalık, sembol sonda). Yüzde: `%22`. Tarih: `28 Kas 2026` ya da `28 Kasım 2026, Cuma`. Saat: `19:00`.
- Hata mesajları mobil ve backend ile aynı metni kullanır (ör. "Red nedeni girilmesi zorunludur.", "Vergi numarası 10 haneli olmalı.", "Rezerve koltuk 1-5000 arasında olmalıdır.").
- Marka adı arayüzde "Eatlas". Logo gradyan metindir, erişilebilir adı `aria-label="Eatlas"`.

---

## 4. Erişilebilirlik doğrulaması

WCAG 2.1 kontrast oranları betikle hesaplandı (göz kararı değil):

| Çift | Açık | Koyu |
|---|---|---|
| Gövde metni / zemin | 15.99 | 16.46 |
| İkincil metin / yüzey | 6.83 | 7.90 |
| Üçüncül metin / zemin | 5.23 | 5.51 (yüzeyde), 4.84 (modalda) |
| Birincil buton metni | 5.23 | 5.96 |
| Bağlantı | 5.56 | 6.54 |
| Rozet metni / kendi zemini (en düşük) | 4.72 (success) | 4.89 (danger) |
| Input sınırı / yüzey (1.4.11, ≥3) | 3.68 | 3.82 |

- Dokunma hedefi: bütün buton, input, menü öğesi, sekme ve onay kutusu satırı en az 44px.
- Odak: her etkileşimli öğede görünür 2px halka (`:focus-visible`).
- Durum bilgisi renk + metin (+ rozet noktası) ile verilir.
- `prefers-reduced-motion` altında geçişler ve iskelet animasyonu kapalı.
- Devre dışı buton metni (2.9:1) WCAG kapsamı dışındadır (etkin olmayan bileşen).
- Ekran okuyucu ile test edilmedi.
