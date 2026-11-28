# Yasal ve kurumsal sayfa taslakları (Faz 0, adım 3)

> **Durum: Taslak — hukukçu veya mali müşavir onayı bekliyor.** Bu klasördeki hiçbir metin onaysız yayınlanmaz. Metinler ajan tarafından yazıldı ve hukuki ya da vergisel geçerliliği doğrulanmadı.

Bağlayıcı kararlar (IS-EMRI.md, "Kullanıcı kararları — 2026-11-27"):

- **K2:** Şirket bilgileri yer tutucu.
- **K3:** Fatura mali müşavirden elle kesilir, KDV durumu yer tutucu.
- **K4:** 15 gün kartsız deneme süresi. Deneme süresinde abone olan işletmeden ilk ücret deneme süresinin bittiği gün çekilir.
- **K5:** 3 gün tolerans, dönem sonu iptal, kısmi iade yok.

## Dosyalar

| Dosya | Sayfa | Web'de önerilen yol |
|---|---|---|
| [01-abonelik-kosullari.md](01-abonelik-kosullari.md) | Abonelik Koşulları (teslimat / hizmetin sunulması bölümü dahil) | `/yasal/abonelik-kosullari` |
| [02-on-bilgilendirme-formu.md](02-on-bilgilendirme-formu.md) | Ön Bilgilendirme Formu | `/yasal/on-bilgilendirme` |
| [03-mesafeli-hizmet-sozlesmesi.md](03-mesafeli-hizmet-sozlesmesi.md) | Mesafeli Hizmet Sözleşmesi | `/yasal/mesafeli-hizmet-sozlesmesi` |
| [04-iptal-ve-iade-politikasi.md](04-iptal-ve-iade-politikasi.md) | İptal ve İade Politikası | `/yasal/iptal-ve-iade` |
| [05-kvkk-odeme-aydinlatma-eki.md](05-kvkk-odeme-aydinlatma-eki.md) | KVKK Aydınlatma Eki — Ödeme Verileri ve iyzico | `/yasal/kvkk-odeme` |
| [06-iletisim-ve-sirket-bilgileri.md](06-iletisim-ve-sirket-bilgileri.md) | İletişim ve Şirket Bilgileri (Hakkımızda dahil) | `/iletisim` |

Ön bilgilendirme formu ile mesafeli sözleşme, ödeme sayfasında iki ayrı onay kutusu olarak gösterildiği için ayrı dosyalara bölündü. Yollar öneridir; kesin yolları `frontend-gelistirici` Faz 3'te belirler.

## iyzico başvurusunun istediği sayfalar ↔ dosyalar

Liste, iyzico üye işyeri başvurularında yaygın olarak istenen kalemlere göre hazırlandı. **iyzico'nun güncel başvuru kontrol listesiyle doğrulanmadı.** Sandbox hesabı açılırken iyzico'dan güncel liste istenmeli.

| iyzico'nun beklediği | Karşılayan | Durum |
|---|---|---|
| Hakkımızda / kurumsal bilgiler (unvan, adres, VKN, MERSİS) | 06 | Taslak, yer tutucular boş |
| İletişim (adres, telefon, e-posta) | 06 | Taslak, yer tutucular boş |
| Mesafeli satış / hizmet sözleşmesi | 03 | Taslak |
| Ön bilgilendirme formu | 02 | Taslak |
| İptal ve iade koşulları | 04 | Taslak |
| Teslimat koşulları | 01 madde 8, 02 madde 6, 03 madde 6 | Taslak (dijital hizmet, fiziksel teslimat yok) |
| Gizlilik politikası / KVKK aydınlatma metni | Yayındaki `docs/privacy-policy.html` + 05 | Ek taslak. Ana politika güncellenmeli (aşağıya bakın) |
| Hizmet ve fiyatın sitede görünmesi | 01 madde 2 ve 4, 06 | Metin hazır. Web abonelik sayfasında da gösterilmeli |
| Satın almadan önce sözleşmelerin onaylatılması | 02 ve 03 sonundaki onay kutuları | Metin hazır, uygulama Faz 3 |
| iyzico / kart logoları bandı, SSL | 06'da yer tutucu | Kapsam dışı: Faz 3 frontend |
| Çerez politikası | 05 madde 6 (yalnızca web paneli) | Kısmi. Ayrı çerez sayfası istenirse yazılmalı |

## Yayındaki sayfalarda gereken güncellemeler

Bu taslaklar yayınlanırken `docs/privacy-policy.html` ile çelişmemeli:

1. **Veri sorumlusu:** Gerçek kişi ve kişisel e-posta adresi yazıyor. Şirket bilgileriyle değiştirilmeli (H11).
2. **Bölüm 2.8 "Abonelik Bilgileri":** Yalnızca Google Play'den söz ediyor. iyzico ve web paneli eklenmeli; 05'e bağlantı verilmeli.
3. **Bölüm 4, üçüncü taraflar tablosu:** iyzico ve mali müşavir eklenmeli. Google Play Billing satırı K6'ya göre geçiş dönemi notuyla kalmalı.
4. **Bölüm 7 "Çerezler":** "Web çerezi kullanılmaz" ifadesi web paneliyle geçersiz kalıyor.
5. **Yurt dışı aktarım paragrafı:** Hukukçu görüşüne göre güncellenmeli (H10).
6. **Hesap silme sayfası:** "Aktif abonelik iptal edilir, iade yapılmaz" ifadesi 01 ve 04 ile uyumlu, değişiklik gerekmiyor.

Ayrıca genel bir **Kullanım Koşulları** (bireysel kullanıcılar için) metni yok. iyzico bunu isterse ayrı iş olarak açılmalı.

## Hukukçuya sorulacaklar

| No | Soru | Etkilediği dosyalar |
|---|---|---|
| **H1** | **Alıcı işletme olduğu için tüketici mevzuatı (6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği) uygulanır mı?** Şahıs işletmeleri ve esnaf için durum farklı mı? Cevap; ön bilgilendirme formunun zorunluluğunu, cayma hakkını ve iade kurallarını belirler. | 01, 02, 03, 04 |
| H2 | Ödeme sırasında "işletmem adına ve ticari amaçla satın alıyorum" beyanının onaylatılması ticari nitelendirme için yeterli mi? | 03 |
| H3 | "Dönem sonu iptal, kısmi iade yok" ve haklı fesihte iade yapılmaması geçerli mi? Tüketici sayılırsa cayma hakkı nasıl yazılmalı? Hizmetin hemen açılması ve kartsız deneme süresi cayma hakkını etkiler mi? | 02, 03, 04 |
| H4 | Deneme süresinden ücretli aboneliğe otomatik geçiş için kart girişi sırasında alınan onay yeterli mi? Deneme bitmeden hatırlatma zorunlu mu? | 01 |
| H5 | Fiyat ve koşul değişikliği için bildirim süresi (öneri 30 gün) ve "iptal etmezseniz kabul" kurgusu yeterli mi? | 01, 03 |
| H6 | Sorumluluk sınırı maddesi nasıl yazılmalı? (Taslakta bilerek boş.) | 03 |
| H7 | Uygulanacak hukuk, yetkili mahkeme ve dava öncesi arabuluculuk nasıl yazılmalı? | 02, 03 |
| H8 | Elektronik sözleşmenin saklanması ve alıcıya iletilmesi için e-posta yeterli mi? Onay kanıtı olarak ne kayıt altına alınmalı? | 03, 05 |
| H9 | iyzico'nun rolü (ayrı veri sorumlusu mu, veri işleyen mi) ve hukuki sebeplerin eşleştirmesi doğru mu? | 05 |
| H10 | Railway ve Resend için yurt dışı aktarımın güncel kurallara göre güvencesi ve metni. | 05, privacy-policy |
| H11 | Veri sorumlusunun şirkete geçirilmesi, VERBİS kaydı gerekliliği. | 05, privacy-policy |
| H12 | Ödeme, fatura ve sözleşme onay kayıtlarının saklama süreleri. | 05 |
| H13 | Kötüye kullanım nedeniyle hesap kapatmada iade kuralı ve Eatlas kaynaklı uzun kesintide iade. | 01, 04 |

Metinlerde bilerek hiçbir kanun maddesi numarası verilmedi. Atıflar hukukçu tarafından eklenmeli.

## Mali müşavire sorulacaklar

| No | Soru | Etkilediği dosyalar |
|---|---|---|
| M1 | 1.299,90 TL KDV dahil mi gösterilmeli, oran nedir? | 01, 02, 03, 06 |
| M2 | Elle kesilecek fatura: alıcıya göre e-fatura mı e-arşiv mi? Düzenleme süresi ve gönderim yolu? | 01, 03 |
| M3 | Tam iadede iade faturası mı, fatura iptali mi? | 04 |
| M4 | Fatura ve ödeme kayıtlarının saklama süresi (Gizlilik Politikası'nda 10 yıl yazıyor). | 05 |

## iyzico'ya sorulacaklar (sandbox açılırken)

- Güncel üye işyeri başvuru kontrol listesi ve sitede bulunması gereken sayfalar
- Abonelik ürününde aylık yenileme günü kuralı (ayın 29-31'i), başarısız ödemede yeniden deneme davranışı
- Deneme süresiyle başlayan abonelikte kart girişinde provizyon ya da doğrulama çekimi yapılıp yapılmadığı
- Alıcıdan zorunlu istenen alanlar (kimlik / vergi numarası, adres)
- Bize dönen kart bilgisi (marka, son 4 hane) ve iade süreleri
- Altbilgi logo bandı görselleri ve tam şirket unvanı

## Doldurulacak yer tutucular

Kullanıcı (K2): şirket unvanı, türü, adresi, vergi dairesi, VKN, MERSİS, ticaret sicili, destek ve KVKK e-posta adresleri, telefon, alan adı. Hukukçu ve mali müşavir: yukarıdaki sorulara bağlı alanlar. iyzico: unvanı ve ürün davranışına bağlı alanlar. Yer tutucuları listelemek için:

```bash
grep -n "YER TUTUCU" planning/web-panel/yasal/*.md
```
