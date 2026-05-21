export interface TurkishPlace {
  id: string;
  name: string;
  province: string;
  type: 'il' | 'ilce';
  lat: number;
  lng: number;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ü/g, 'u')
    .replace(/Ç/g, 'c');
}

export const TURKISH_PLACES: TurkishPlace[] = [
  // ADANA
  { id: 'adana', name: 'Adana', province: 'Adana', type: 'il', lat: 37.0000, lng: 35.3213 },
  { id: 'adana-seyhan', name: 'Seyhan', province: 'Adana', type: 'ilce', lat: 37.0023, lng: 35.3213 },
  { id: 'adana-cukurova', name: 'Çukurova', province: 'Adana', type: 'ilce', lat: 37.0222, lng: 35.2833 },
  { id: 'adana-yuregir', name: 'Yüreğir', province: 'Adana', type: 'ilce', lat: 36.9855, lng: 35.3792 },
  { id: 'adana-kozan', name: 'Kozan', province: 'Adana', type: 'ilce', lat: 37.4503, lng: 35.8139 },
  // ADIYAMAN
  { id: 'adiyaman', name: 'Adıyaman', province: 'Adıyaman', type: 'il', lat: 37.7647, lng: 38.2766 },
  { id: 'adiyaman-golbasi', name: 'Gölbaşı', province: 'Adıyaman', type: 'ilce', lat: 37.7811, lng: 37.6486 },
  // AFYONKARAHİSAR
  { id: 'afyonkarahisar', name: 'Afyonkarahisar', province: 'Afyonkarahisar', type: 'il', lat: 38.7569, lng: 30.5387 },
  { id: 'afyonkarahisar-sandikli', name: 'Sandıklı', province: 'Afyonkarahisar', type: 'ilce', lat: 38.4636, lng: 30.2639 },
  // AĞRI
  { id: 'agri', name: 'Ağrı', province: 'Ağrı', type: 'il', lat: 39.7191, lng: 43.0503 },
  { id: 'agri-dogubeyazit', name: 'Doğubayazıt', province: 'Ağrı', type: 'ilce', lat: 39.5464, lng: 44.0886 },
  // AKSARAY
  { id: 'aksaray', name: 'Aksaray', province: 'Aksaray', type: 'il', lat: 38.3682, lng: 34.0370 },
  // AMASYA
  { id: 'amasya', name: 'Amasya', province: 'Amasya', type: 'il', lat: 40.6499, lng: 35.8353 },
  // ANKARA
  { id: 'ankara', name: 'Ankara', province: 'Ankara', type: 'il', lat: 39.9208, lng: 32.8541 },
  { id: 'ankara-cankaya', name: 'Çankaya', province: 'Ankara', type: 'ilce', lat: 39.9061, lng: 32.8634 },
  { id: 'ankara-kecioren', name: 'Keçiören', province: 'Ankara', type: 'ilce', lat: 40.0278, lng: 32.8603 },
  { id: 'ankara-mamak', name: 'Mamak', province: 'Ankara', type: 'ilce', lat: 39.9467, lng: 32.9317 },
  { id: 'ankara-yenimahalle', name: 'Yenimahalle', province: 'Ankara', type: 'ilce', lat: 39.9631, lng: 32.7417 },
  { id: 'ankara-etimesgut', name: 'Etimesgut', province: 'Ankara', type: 'ilce', lat: 39.9467, lng: 32.6867 },
  { id: 'ankara-sincan', name: 'Sincan', province: 'Ankara', type: 'ilce', lat: 39.9744, lng: 32.5839 },
  { id: 'ankara-altindag', name: 'Altındağ', province: 'Ankara', type: 'ilce', lat: 39.9742, lng: 32.8742 },
  { id: 'ankara-golbasi', name: 'Gölbaşı', province: 'Ankara', type: 'ilce', lat: 39.7917, lng: 32.8000 },
  { id: 'ankara-pursaklar', name: 'Pursaklar', province: 'Ankara', type: 'ilce', lat: 40.0414, lng: 32.9028 },
  { id: 'ankara-polatli', name: 'Polatlı', province: 'Ankara', type: 'ilce', lat: 39.5833, lng: 32.1500 },
  { id: 'ankara-haymana', name: 'Haymana', province: 'Ankara', type: 'ilce', lat: 39.4319, lng: 32.4989 },
  { id: 'ankara-beypazari', name: 'Beypazarı', province: 'Ankara', type: 'ilce', lat: 40.1681, lng: 31.9219 },
  { id: 'ankara-nallihan', name: 'Nallıhan', province: 'Ankara', type: 'ilce', lat: 40.1847, lng: 31.3519 },
  { id: 'ankara-cubuk', name: 'Çubuk', province: 'Ankara', type: 'ilce', lat: 40.2328, lng: 33.0322 },
  { id: 'ankara-kazan', name: 'Kazan', province: 'Ankara', type: 'ilce', lat: 40.1239, lng: 32.7092 },
  // ANTALYA
  { id: 'antalya', name: 'Antalya', province: 'Antalya', type: 'il', lat: 36.8969, lng: 30.7133 },
  { id: 'antalya-muratpasa', name: 'Muratpaşa', province: 'Antalya', type: 'ilce', lat: 36.8831, lng: 30.7028 },
  { id: 'antalya-kepez', name: 'Kepez', province: 'Antalya', type: 'ilce', lat: 37.0022, lng: 30.7031 },
  { id: 'antalya-konyaalti', name: 'Konyaaltı', province: 'Antalya', type: 'ilce', lat: 36.8675, lng: 30.6133 },
  { id: 'antalya-alanya', name: 'Alanya', province: 'Antalya', type: 'ilce', lat: 36.5436, lng: 32.0000 },
  { id: 'antalya-manavgat', name: 'Manavgat', province: 'Antalya', type: 'ilce', lat: 36.7767, lng: 31.4442 },
  { id: 'antalya-serik', name: 'Serik', province: 'Antalya', type: 'ilce', lat: 36.9239, lng: 31.1028 },
  { id: 'antalya-kemer', name: 'Kemer', province: 'Antalya', type: 'ilce', lat: 36.5961, lng: 30.5594 },
  { id: 'antalya-kas', name: 'Kaş', province: 'Antalya', type: 'ilce', lat: 36.2019, lng: 29.6394 },
  { id: 'antalya-finike', name: 'Finike', province: 'Antalya', type: 'ilce', lat: 36.2992, lng: 30.1536 },
  // ARTVİN
  { id: 'artvin', name: 'Artvin', province: 'Artvin', type: 'il', lat: 41.1833, lng: 41.8167 },
  // AYDIN
  { id: 'aydin', name: 'Aydın', province: 'Aydın', type: 'il', lat: 37.8444, lng: 27.8458 },
  { id: 'aydin-efeler', name: 'Efeler', province: 'Aydın', type: 'ilce', lat: 37.8444, lng: 27.8458 },
  { id: 'aydin-kusadasi', name: 'Kuşadası', province: 'Aydın', type: 'ilce', lat: 37.8597, lng: 27.2600 },
  { id: 'aydin-nazilli', name: 'Nazilli', province: 'Aydın', type: 'ilce', lat: 37.9139, lng: 28.3239 },
  { id: 'aydin-didim', name: 'Didim', province: 'Aydın', type: 'ilce', lat: 37.3592, lng: 27.2694 },
  // BALIKESİR
  { id: 'balikesir', name: 'Balıkesir', province: 'Balıkesir', type: 'il', lat: 39.6484, lng: 27.8826 },
  { id: 'balikesir-bandirma', name: 'Bandırma', province: 'Balıkesir', type: 'ilce', lat: 40.3514, lng: 27.9764 },
  { id: 'balikesir-edremit', name: 'Edremit', province: 'Balıkesir', type: 'ilce', lat: 39.5928, lng: 27.0239 },
  { id: 'balikesir-ayvalik', name: 'Ayvalık', province: 'Balıkesir', type: 'ilce', lat: 39.3183, lng: 26.6964 },
  // BARTIN
  { id: 'bartin', name: 'Bartın', province: 'Bartın', type: 'il', lat: 41.6353, lng: 32.3375 },
  // BATMAN
  { id: 'batman', name: 'Batman', province: 'Batman', type: 'il', lat: 37.8812, lng: 41.1351 },
  // BAYBURT
  { id: 'bayburt', name: 'Bayburt', province: 'Bayburt', type: 'il', lat: 40.2552, lng: 40.2249 },
  // BİLECİK
  { id: 'bilecik', name: 'Bilecik', province: 'Bilecik', type: 'il', lat: 40.1500, lng: 29.9667 },
  // BİNGÖL
  { id: 'bingol', name: 'Bingöl', province: 'Bingöl', type: 'il', lat: 38.8833, lng: 40.4983 },
  // BİTLİS
  { id: 'bitlis', name: 'Bitlis', province: 'Bitlis', type: 'il', lat: 38.4000, lng: 42.1167 },
  { id: 'bitlis-tatvan', name: 'Tatvan', province: 'Bitlis', type: 'ilce', lat: 38.5108, lng: 42.2811 },
  // BOLU
  { id: 'bolu', name: 'Bolu', province: 'Bolu', type: 'il', lat: 40.7353, lng: 31.6061 },
  // BURDUR
  { id: 'burdur', name: 'Burdur', province: 'Burdur', type: 'il', lat: 37.7206, lng: 30.2908 },
  // BURSA
  { id: 'bursa', name: 'Bursa', province: 'Bursa', type: 'il', lat: 40.1885, lng: 29.0610 },
  { id: 'bursa-osmangazi', name: 'Osmangazi', province: 'Bursa', type: 'ilce', lat: 40.1926, lng: 29.0617 },
  { id: 'bursa-nilufer', name: 'Nilüfer', province: 'Bursa', type: 'ilce', lat: 40.2122, lng: 28.9708 },
  { id: 'bursa-yildirim', name: 'Yıldırım', province: 'Bursa', type: 'ilce', lat: 40.1794, lng: 29.1233 },
  { id: 'bursa-gemlik', name: 'Gemlik', province: 'Bursa', type: 'ilce', lat: 40.4328, lng: 29.1622 },
  { id: 'bursa-inegol', name: 'İnegöl', province: 'Bursa', type: 'ilce', lat: 40.0742, lng: 29.5136 },
  { id: 'bursa-mudanya', name: 'Mudanya', province: 'Bursa', type: 'ilce', lat: 40.3728, lng: 28.8850 },
  // ÇANAKKALE
  { id: 'canakkale', name: 'Çanakkale', province: 'Çanakkale', type: 'il', lat: 40.1553, lng: 26.4142 },
  { id: 'canakkale-gelibolu', name: 'Gelibolu', province: 'Çanakkale', type: 'ilce', lat: 40.4022, lng: 26.6756 },
  { id: 'canakkale-bozcaada', name: 'Bozcaada', province: 'Çanakkale', type: 'ilce', lat: 39.8333, lng: 26.0667 },
  // ÇANKIRI
  { id: 'cankiri', name: 'Çankırı', province: 'Çankırı', type: 'il', lat: 40.6013, lng: 33.6114 },
  // ÇORUM
  { id: 'corum', name: 'Çorum', province: 'Çorum', type: 'il', lat: 40.5506, lng: 34.9556 },
  // DENİZLİ
  { id: 'denizli', name: 'Denizli', province: 'Denizli', type: 'il', lat: 37.7765, lng: 29.0864 },
  { id: 'denizli-merkezefendi', name: 'Merkezefendi', province: 'Denizli', type: 'ilce', lat: 37.7833, lng: 29.0833 },
  { id: 'denizli-pamukkale', name: 'Pamukkale', province: 'Denizli', type: 'ilce', lat: 37.9333, lng: 29.1167 },
  // DİYARBAKIR
  { id: 'diyarbakir', name: 'Diyarbakır', province: 'Diyarbakır', type: 'il', lat: 37.9144, lng: 40.2306 },
  { id: 'diyarbakir-baglar', name: 'Bağlar', province: 'Diyarbakır', type: 'ilce', lat: 37.9094, lng: 40.1975 },
  { id: 'diyarbakir-kayapinar', name: 'Kayapınar', province: 'Diyarbakır', type: 'ilce', lat: 37.9103, lng: 40.2706 },
  { id: 'diyarbakir-yenisehir', name: 'Yenişehir', province: 'Diyarbakır', type: 'ilce', lat: 37.9239, lng: 40.2311 },
  // DÜZCE
  { id: 'duzce', name: 'Düzce', province: 'Düzce', type: 'il', lat: 40.8438, lng: 31.1565 },
  // EDİRNE
  { id: 'edirne', name: 'Edirne', province: 'Edirne', type: 'il', lat: 41.6818, lng: 26.5623 },
  { id: 'edirne-uzunkopru', name: 'Uzunköprü', province: 'Edirne', type: 'ilce', lat: 41.2697, lng: 26.6875 },
  // ELAZIĞ
  { id: 'elazig', name: 'Elazığ', province: 'Elazığ', type: 'il', lat: 38.6810, lng: 39.2264 },
  // ERZİNCAN
  { id: 'erzincan', name: 'Erzincan', province: 'Erzincan', type: 'il', lat: 39.7500, lng: 39.5000 },
  // ERZURUM
  { id: 'erzurum', name: 'Erzurum', province: 'Erzurum', type: 'il', lat: 39.9000, lng: 41.2700 },
  { id: 'erzurum-palandoken', name: 'Palandöken', province: 'Erzurum', type: 'ilce', lat: 39.8892, lng: 41.2481 },
  { id: 'erzurum-yakutiye', name: 'Yakutiye', province: 'Erzurum', type: 'ilce', lat: 39.9069, lng: 41.2756 },
  // ESKİŞEHİR
  { id: 'eskisehir', name: 'Eskişehir', province: 'Eskişehir', type: 'il', lat: 39.7767, lng: 30.5206 },
  { id: 'eskisehir-tepebaşi', name: 'Tepebaşı', province: 'Eskişehir', type: 'ilce', lat: 39.7881, lng: 30.5058 },
  { id: 'eskisehir-odunpazari', name: 'Odunpazarı', province: 'Eskişehir', type: 'ilce', lat: 39.7681, lng: 30.5378 },
  // GAZİANTEP
  { id: 'gaziantep', name: 'Gaziantep', province: 'Gaziantep', type: 'il', lat: 37.0662, lng: 37.3833 },
  { id: 'gaziantep-sahinbey', name: 'Şahinbey', province: 'Gaziantep', type: 'ilce', lat: 37.0611, lng: 37.3664 },
  { id: 'gaziantep-sehitkamil', name: 'Şehitkamil', province: 'Gaziantep', type: 'ilce', lat: 37.0789, lng: 37.3608 },
  { id: 'gaziantep-nizip', name: 'Nizip', province: 'Gaziantep', type: 'ilce', lat: 37.0083, lng: 37.7964 },
  // GİRESUN
  { id: 'giresun', name: 'Giresun', province: 'Giresun', type: 'il', lat: 40.9128, lng: 38.3895 },
  // GÜMÜŞHANE
  { id: 'gumushane', name: 'Gümüşhane', province: 'Gümüşhane', type: 'il', lat: 40.4608, lng: 39.4786 },
  // HAKKARİ
  { id: 'hakkari', name: 'Hakkari', province: 'Hakkari', type: 'il', lat: 37.5744, lng: 43.7408 },
  // HATAY
  { id: 'hatay', name: 'Hatay', province: 'Hatay', type: 'il', lat: 36.4018, lng: 36.3498 },
  { id: 'hatay-antakya', name: 'Antakya', province: 'Hatay', type: 'ilce', lat: 36.2065, lng: 36.1603 },
  { id: 'hatay-iskenderun', name: 'İskenderun', province: 'Hatay', type: 'ilce', lat: 36.5872, lng: 36.1642 },
  { id: 'hatay-dortyol', name: 'Dörtyol', province: 'Hatay', type: 'ilce', lat: 36.8467, lng: 36.2239 },
  // IĞDIR
  { id: 'igdir', name: 'Iğdır', province: 'Iğdır', type: 'il', lat: 39.9167, lng: 44.0333 },
  // ISPARTA
  { id: 'isparta', name: 'Isparta', province: 'Isparta', type: 'il', lat: 37.7648, lng: 30.5566 },
  // İSTANBUL
  { id: 'istanbul', name: 'İstanbul', province: 'İstanbul', type: 'il', lat: 41.0082, lng: 28.9784 },
  { id: 'istanbul-kadikoy', name: 'Kadıköy', province: 'İstanbul', type: 'ilce', lat: 40.9919, lng: 29.0226 },
  { id: 'istanbul-besiktas', name: 'Beşiktaş', province: 'İstanbul', type: 'ilce', lat: 41.0422, lng: 29.0061 },
  { id: 'istanbul-sisli', name: 'Şişli', province: 'İstanbul', type: 'ilce', lat: 41.0602, lng: 28.9870 },
  { id: 'istanbul-beyoglu', name: 'Beyoğlu', province: 'İstanbul', type: 'ilce', lat: 41.0342, lng: 28.9742 },
  { id: 'istanbul-fatih', name: 'Fatih', province: 'İstanbul', type: 'ilce', lat: 41.0086, lng: 28.9397 },
  { id: 'istanbul-uskudar', name: 'Üsküdar', province: 'İstanbul', type: 'ilce', lat: 41.0231, lng: 29.0150 },
  { id: 'istanbul-maltepe', name: 'Maltepe', province: 'İstanbul', type: 'ilce', lat: 40.9351, lng: 29.1303 },
  { id: 'istanbul-kartal', name: 'Kartal', province: 'İstanbul', type: 'ilce', lat: 40.8942, lng: 29.1897 },
  { id: 'istanbul-pendik', name: 'Pendik', province: 'İstanbul', type: 'ilce', lat: 40.8760, lng: 29.2597 },
  { id: 'istanbul-umraniye', name: 'Ümraniye', province: 'İstanbul', type: 'ilce', lat: 41.0164, lng: 29.1089 },
  { id: 'istanbul-atasehir', name: 'Ataşehir', province: 'İstanbul', type: 'ilce', lat: 40.9833, lng: 29.1167 },
  { id: 'istanbul-bagcilar', name: 'Bağcılar', province: 'İstanbul', type: 'ilce', lat: 41.0353, lng: 28.8569 },
  { id: 'istanbul-bahcelievler', name: 'Bahçelievler', province: 'İstanbul', type: 'ilce', lat: 40.9975, lng: 28.8578 },
  { id: 'istanbul-bayrampasa', name: 'Bayrampaşa', province: 'İstanbul', type: 'ilce', lat: 41.0494, lng: 28.9136 },
  { id: 'istanbul-bakirkoy', name: 'Bakırköy', province: 'İstanbul', type: 'ilce', lat: 40.9817, lng: 28.8714 },
  { id: 'istanbul-buyukcekmece', name: 'Büyükçekmece', province: 'İstanbul', type: 'ilce', lat: 41.0222, lng: 28.5897 },
  { id: 'istanbul-kucukcekmece', name: 'Küçükçekmece', province: 'İstanbul', type: 'ilce', lat: 41.0017, lng: 28.7819 },
  { id: 'istanbul-esenyurt', name: 'Esenyurt', province: 'İstanbul', type: 'ilce', lat: 41.0328, lng: 28.6744 },
  { id: 'istanbul-avcilar', name: 'Avcılar', province: 'İstanbul', type: 'ilce', lat: 40.9797, lng: 28.7219 },
  { id: 'istanbul-esenler', name: 'Esenler', province: 'İstanbul', type: 'ilce', lat: 41.0444, lng: 28.8783 },
  { id: 'istanbul-gungoren', name: 'Güngören', province: 'İstanbul', type: 'ilce', lat: 41.0183, lng: 28.8764 },
  { id: 'istanbul-zeytinburnu', name: 'Zeytinburnu', province: 'İstanbul', type: 'ilce', lat: 40.9942, lng: 28.9069 },
  { id: 'istanbul-sultangazi', name: 'Sultangazi', province: 'İstanbul', type: 'ilce', lat: 41.1083, lng: 28.8733 },
  { id: 'istanbul-gaziosmanpasa', name: 'Gaziosmanpaşa', province: 'İstanbul', type: 'ilce', lat: 41.0678, lng: 28.9131 },
  { id: 'istanbul-eyupsultan', name: 'Eyüpsultan', province: 'İstanbul', type: 'ilce', lat: 41.0578, lng: 28.9286 },
  { id: 'istanbul-sariyer', name: 'Sarıyer', province: 'İstanbul', type: 'ilce', lat: 41.1667, lng: 29.0000 },
  { id: 'istanbul-beykoz', name: 'Beykoz', province: 'İstanbul', type: 'ilce', lat: 41.1292, lng: 29.0917 },
  { id: 'istanbul-sancaktepe', name: 'Sancaktepe', province: 'İstanbul', type: 'ilce', lat: 41.0083, lng: 29.2333 },
  { id: 'istanbul-sultanbeyli', name: 'Sultanbeyli', province: 'İstanbul', type: 'ilce', lat: 40.9650, lng: 29.2692 },
  { id: 'istanbul-cekmekoy', name: 'Çekmeköy', province: 'İstanbul', type: 'ilce', lat: 41.0328, lng: 29.1917 },
  { id: 'istanbul-tuzla', name: 'Tuzla', province: 'İstanbul', type: 'ilce', lat: 40.8161, lng: 29.2978 },
  { id: 'istanbul-silivri', name: 'Silivri', province: 'İstanbul', type: 'ilce', lat: 41.0736, lng: 28.2472 },
  { id: 'istanbul-arnavutkoy', name: 'Arnavutköy', province: 'İstanbul', type: 'ilce', lat: 41.1831, lng: 28.7378 },
  { id: 'istanbul-basaksehir', name: 'Başakşehir', province: 'İstanbul', type: 'ilce', lat: 41.0942, lng: 28.8053 },
  { id: 'istanbul-catalca', name: 'Çatalca', province: 'İstanbul', type: 'ilce', lat: 41.1431, lng: 28.4647 },
  // İZMİR
  { id: 'izmir', name: 'İzmir', province: 'İzmir', type: 'il', lat: 38.4237, lng: 27.1428 },
  { id: 'izmir-konak', name: 'Konak', province: 'İzmir', type: 'ilce', lat: 38.4189, lng: 27.1289 },
  { id: 'izmir-karsiyaka', name: 'Karşıyaka', province: 'İzmir', type: 'ilce', lat: 38.4581, lng: 27.1164 },
  { id: 'izmir-buca', name: 'Buca', province: 'İzmir', type: 'ilce', lat: 38.3856, lng: 27.1833 },
  { id: 'izmir-bornova', name: 'Bornova', province: 'İzmir', type: 'ilce', lat: 38.4647, lng: 27.2175 },
  { id: 'izmir-cigli', name: 'Çiğli', province: 'İzmir', type: 'ilce', lat: 38.4919, lng: 27.0606 },
  { id: 'izmir-gaziemir', name: 'Gaziemir', province: 'İzmir', type: 'ilce', lat: 38.3236, lng: 27.1344 },
  { id: 'izmir-bayrakli', name: 'Bayraklı', province: 'İzmir', type: 'ilce', lat: 38.4506, lng: 27.1578 },
  { id: 'izmir-narlidere', name: 'Narlıdere', province: 'İzmir', type: 'ilce', lat: 38.3967, lng: 27.0331 },
  { id: 'izmir-cesme', name: 'Çeşme', province: 'İzmir', type: 'ilce', lat: 38.3244, lng: 26.3022 },
  { id: 'izmir-alacati', name: 'Alaçatı', province: 'İzmir', type: 'ilce', lat: 38.2817, lng: 26.3731 },
  { id: 'izmir-aliaga', name: 'Aliağa', province: 'İzmir', type: 'ilce', lat: 38.7972, lng: 26.9753 },
  { id: 'izmir-bergama', name: 'Bergama', province: 'İzmir', type: 'ilce', lat: 39.1214, lng: 27.1769 },
  { id: 'izmir-selcuk', name: 'Selçuk', province: 'İzmir', type: 'ilce', lat: 37.9506, lng: 27.3669 },
  { id: 'izmir-seferihisar', name: 'Seferihisar', province: 'İzmir', type: 'ilce', lat: 38.1975, lng: 26.8347 },
  { id: 'izmir-urla', name: 'Urla', province: 'İzmir', type: 'ilce', lat: 38.3247, lng: 26.7622 },
  // KAHRAMANMARAŞ
  { id: 'kahramanmaras', name: 'Kahramanmaraş', province: 'Kahramanmaraş', type: 'il', lat: 37.5858, lng: 36.9371 },
  { id: 'kahramanmaras-dulkadiroglu', name: 'Dulkadiroğlu', province: 'Kahramanmaraş', type: 'ilce', lat: 37.5781, lng: 36.9494 },
  { id: 'kahramanmaras-onikisube', name: 'Onikişubat', province: 'Kahramanmaraş', type: 'ilce', lat: 37.5947, lng: 36.9183 },
  // KARABÜK
  { id: 'karabuk', name: 'Karabük', province: 'Karabük', type: 'il', lat: 41.2061, lng: 32.6204 },
  // KARAMAN
  { id: 'karaman', name: 'Karaman', province: 'Karaman', type: 'il', lat: 37.1759, lng: 33.2287 },
  // KARS
  { id: 'kars', name: 'Kars', province: 'Kars', type: 'il', lat: 40.6013, lng: 43.0975 },
  // KASTAMONU
  { id: 'kastamonu', name: 'Kastamonu', province: 'Kastamonu', type: 'il', lat: 41.3887, lng: 33.7827 },
  // KAYSERİ
  { id: 'kayseri', name: 'Kayseri', province: 'Kayseri', type: 'il', lat: 38.7205, lng: 35.4826 },
  { id: 'kayseri-melikgazi', name: 'Melikgazi', province: 'Kayseri', type: 'ilce', lat: 38.7331, lng: 35.4808 },
  { id: 'kayseri-kocasinan', name: 'Kocasinan', province: 'Kayseri', type: 'ilce', lat: 38.7431, lng: 35.5158 },
  { id: 'kayseri-talas', name: 'Talas', province: 'Kayseri', type: 'ilce', lat: 38.6803, lng: 35.5497 },
  // KİLİS
  { id: 'kilis', name: 'Kilis', province: 'Kilis', type: 'il', lat: 36.7175, lng: 37.1153 },
  // KIRIKKALEf
  { id: 'kirikkale', name: 'Kırıkkale', province: 'Kırıkkale', type: 'il', lat: 39.8468, lng: 33.5153 },
  // KIRKLARELİ
  { id: 'kirklareli', name: 'Kırklareli', province: 'Kırklareli', type: 'il', lat: 41.7333, lng: 27.2167 },
  // KIRŞEHİR
  { id: 'kirsehir', name: 'Kırşehir', province: 'Kırşehir', type: 'il', lat: 39.1458, lng: 34.1614 },
  // KOCAELİ
  { id: 'kocaeli', name: 'Kocaeli', province: 'Kocaeli', type: 'il', lat: 40.8533, lng: 29.8815 },
  { id: 'kocaeli-izmit', name: 'İzmit', province: 'Kocaeli', type: 'ilce', lat: 40.7654, lng: 29.9408 },
  { id: 'kocaeli-gebze', name: 'Gebze', province: 'Kocaeli', type: 'ilce', lat: 40.8028, lng: 29.4317 },
  { id: 'kocaeli-golcuk', name: 'Gölcük', province: 'Kocaeli', type: 'ilce', lat: 40.6556, lng: 29.8281 },
  { id: 'kocaeli-darica', name: 'Darıca', province: 'Kocaeli', type: 'ilce', lat: 40.7781, lng: 29.3789 },
  // KONYA
  { id: 'konya', name: 'Konya', province: 'Konya', type: 'il', lat: 37.8667, lng: 32.4833 },
  { id: 'konya-meram', name: 'Meram', province: 'Konya', type: 'ilce', lat: 37.8333, lng: 32.4333 },
  { id: 'konya-selcuklu', name: 'Selçuklu', province: 'Konya', type: 'ilce', lat: 37.9167, lng: 32.5000 },
  { id: 'konya-karatay', name: 'Karatay', province: 'Konya', type: 'ilce', lat: 37.8833, lng: 32.5167 },
  { id: 'konya-eregli', name: 'Ereğli', province: 'Konya', type: 'ilce', lat: 37.5144, lng: 34.0458 },
  // KÜTAHYA
  { id: 'kutahya', name: 'Kütahya', province: 'Kütahya', type: 'il', lat: 39.4242, lng: 29.9833 },
  // MALATYA
  { id: 'malatya', name: 'Malatya', province: 'Malatya', type: 'il', lat: 38.3552, lng: 38.3095 },
  { id: 'malatya-battalgazi', name: 'Battalgazi', province: 'Malatya', type: 'ilce', lat: 38.3569, lng: 38.3128 },
  { id: 'malatya-yesilyurt', name: 'Yeşilyurt', province: 'Malatya', type: 'ilce', lat: 38.3211, lng: 38.2711 },
  // MANİSA
  { id: 'manisa', name: 'Manisa', province: 'Manisa', type: 'il', lat: 38.6191, lng: 27.4289 },
  { id: 'manisa-akhisar', name: 'Akhisar', province: 'Manisa', type: 'ilce', lat: 38.9197, lng: 27.8364 },
  { id: 'manisa-turgutlu', name: 'Turgutlu', province: 'Manisa', type: 'ilce', lat: 38.5028, lng: 27.7050 },
  { id: 'manisa-salihli', name: 'Salihli', province: 'Manisa', type: 'ilce', lat: 38.4817, lng: 28.1383 },
  // MARDİN
  { id: 'mardin', name: 'Mardin', province: 'Mardin', type: 'il', lat: 37.3212, lng: 40.7245 },
  { id: 'mardin-artuklu', name: 'Artuklu', province: 'Mardin', type: 'ilce', lat: 37.3131, lng: 40.7369 },
  { id: 'mardin-kiziltepe', name: 'Kızıltepe', province: 'Mardin', type: 'ilce', lat: 37.1928, lng: 40.5864 },
  // MERSİN
  { id: 'mersin', name: 'Mersin', province: 'Mersin', type: 'il', lat: 36.8121, lng: 34.6415 },
  { id: 'mersin-yenisehir', name: 'Yenişehir', province: 'Mersin', type: 'ilce', lat: 36.8247, lng: 34.6297 },
  { id: 'mersin-toroslar', name: 'Toroslar', province: 'Mersin', type: 'ilce', lat: 36.8394, lng: 34.5894 },
  { id: 'mersin-mezitli', name: 'Mezitli', province: 'Mersin', type: 'ilce', lat: 36.7883, lng: 34.5733 },
  { id: 'mersin-akdeniz', name: 'Akdeniz', province: 'Mersin', type: 'ilce', lat: 36.8131, lng: 34.6417 },
  { id: 'mersin-tarsus', name: 'Tarsus', province: 'Mersin', type: 'ilce', lat: 36.9214, lng: 34.8942 },
  { id: 'mersin-erdemli', name: 'Erdemli', province: 'Mersin', type: 'ilce', lat: 36.6092, lng: 34.3133 },
  // MUĞLA
  { id: 'mugla', name: 'Muğla', province: 'Muğla', type: 'il', lat: 37.2153, lng: 28.3636 },
  { id: 'mugla-bodrum', name: 'Bodrum', province: 'Muğla', type: 'ilce', lat: 37.0342, lng: 27.4300 },
  { id: 'mugla-marmaris', name: 'Marmaris', province: 'Muğla', type: 'ilce', lat: 36.8558, lng: 28.2722 },
  { id: 'mugla-fethiye', name: 'Fethiye', province: 'Muğla', type: 'ilce', lat: 36.6556, lng: 29.1206 },
  { id: 'mugla-milas', name: 'Milas', province: 'Muğla', type: 'ilce', lat: 37.3167, lng: 27.7833 },
  { id: 'mugla-dalaman', name: 'Dalaman', province: 'Muğla', type: 'ilce', lat: 36.7681, lng: 28.7939 },
  // MUŞ
  { id: 'mus', name: 'Muş', province: 'Muş', type: 'il', lat: 38.7432, lng: 41.4943 },
  // NEVŞEHİR
  { id: 'nevsehir', name: 'Nevşehir', province: 'Nevşehir', type: 'il', lat: 38.6244, lng: 34.7236 },
  { id: 'nevsehir-urgup', name: 'Ürgüp', province: 'Nevşehir', type: 'ilce', lat: 38.6344, lng: 34.9131 },
  { id: 'nevsehir-goreme', name: 'Göreme', province: 'Nevşehir', type: 'ilce', lat: 38.6431, lng: 34.8278 },
  { id: 'nevsehir-avanos', name: 'Avanos', province: 'Nevşehir', type: 'ilce', lat: 38.7131, lng: 34.8461 },
  // NİĞDE
  { id: 'nigde', name: 'Niğde', province: 'Niğde', type: 'il', lat: 37.9667, lng: 34.6833 },
  // ORDU
  { id: 'ordu', name: 'Ordu', province: 'Ordu', type: 'il', lat: 40.9839, lng: 37.8764 },
  { id: 'ordu-altinordu', name: 'Altınordu', province: 'Ordu', type: 'ilce', lat: 40.9844, lng: 37.8744 },
  // OSMANİYE
  { id: 'osmaniye', name: 'Osmaniye', province: 'Osmaniye', type: 'il', lat: 37.0742, lng: 36.2478 },
  // RİZE
  { id: 'rize', name: 'Rize', province: 'Rize', type: 'il', lat: 41.0208, lng: 40.5234 },
  // SAKARYA
  { id: 'sakarya', name: 'Sakarya', province: 'Sakarya', type: 'il', lat: 40.6940, lng: 30.4358 },
  { id: 'sakarya-adapazari', name: 'Adapazarı', province: 'Sakarya', type: 'ilce', lat: 40.7759, lng: 30.3967 },
  { id: 'sakarya-serdivan', name: 'Serdivan', province: 'Sakarya', type: 'ilce', lat: 40.7397, lng: 30.4317 },
  // SAMSUN
  { id: 'samsun', name: 'Samsun', province: 'Samsun', type: 'il', lat: 41.2867, lng: 36.3300 },
  { id: 'samsun-ilkadim', name: 'İlkadım', province: 'Samsun', type: 'ilce', lat: 41.2922, lng: 36.3264 },
  { id: 'samsun-atakum', name: 'Atakum', province: 'Samsun', type: 'ilce', lat: 41.3122, lng: 36.2581 },
  { id: 'samsun-canik', name: 'Canik', province: 'Samsun', type: 'ilce', lat: 41.2656, lng: 36.3728 },
  // SİİRT
  { id: 'siirt', name: 'Siirt', province: 'Siirt', type: 'il', lat: 37.9333, lng: 41.9500 },
  // SİNOP
  { id: 'sinop', name: 'Sinop', province: 'Sinop', type: 'il', lat: 42.0231, lng: 35.1531 },
  // SİVAS
  { id: 'sivas', name: 'Sivas', province: 'Sivas', type: 'il', lat: 39.7477, lng: 37.0179 },
  // ŞANLIURFA
  { id: 'sanliurfa', name: 'Şanlıurfa', province: 'Şanlıurfa', type: 'il', lat: 37.1591, lng: 38.7969 },
  { id: 'sanliurfa-karakoprü', name: 'Karaköprü', province: 'Şanlıurfa', type: 'ilce', lat: 37.1958, lng: 38.7639 },
  { id: 'sanliurfa-haliliye', name: 'Haliliye', province: 'Şanlıurfa', type: 'ilce', lat: 37.1581, lng: 38.7853 },
  { id: 'sanliurfa-eyyubiye', name: 'Eyyübiye', province: 'Şanlıurfa', type: 'ilce', lat: 37.1481, lng: 38.8011 },
  // ŞIRNAK
  { id: 'sirnak', name: 'Şırnak', province: 'Şırnak', type: 'il', lat: 37.5164, lng: 42.4611 },
  { id: 'sirnak-cizre', name: 'Cizre', province: 'Şırnak', type: 'ilce', lat: 37.3261, lng: 42.1922 },
  // TEKİRDAĞ
  { id: 'tekirdag', name: 'Tekirdağ', province: 'Tekirdağ', type: 'il', lat: 40.9781, lng: 27.5115 },
  { id: 'tekirdag-suleymanpasa', name: 'Süleymanpaşa', province: 'Tekirdağ', type: 'ilce', lat: 40.9786, lng: 27.5108 },
  { id: 'tekirdag-cerkezkoy', name: 'Çerkezköy', province: 'Tekirdağ', type: 'ilce', lat: 41.2886, lng: 27.9981 },
  { id: 'tekirdag-corlu', name: 'Çorlu', province: 'Tekirdağ', type: 'ilce', lat: 41.1594, lng: 27.7972 },
  // TOKAT
  { id: 'tokat', name: 'Tokat', province: 'Tokat', type: 'il', lat: 40.3167, lng: 36.5500 },
  // TRABZON
  { id: 'trabzon', name: 'Trabzon', province: 'Trabzon', type: 'il', lat: 41.0015, lng: 39.7178 },
  { id: 'trabzon-ortahisar', name: 'Ortahisar', province: 'Trabzon', type: 'ilce', lat: 41.0028, lng: 39.7231 },
  { id: 'trabzon-akcaabat', name: 'Akçaabat', province: 'Trabzon', type: 'ilce', lat: 40.9922, lng: 39.5722 },
  // TUNCELİ
  { id: 'tunceli', name: 'Tunceli', province: 'Tunceli', type: 'il', lat: 39.1079, lng: 39.5481 },
  // UŞAK
  { id: 'usak', name: 'Uşak', province: 'Uşak', type: 'il', lat: 38.6823, lng: 29.4082 },
  // VAN
  { id: 'van', name: 'Van', province: 'Van', type: 'il', lat: 38.4942, lng: 43.3800 },
  { id: 'van-ipekyolu', name: 'İpekyolu', province: 'Van', type: 'ilce', lat: 38.4831, lng: 43.3900 },
  { id: 'van-tusba', name: 'Tuşba', province: 'Van', type: 'ilce', lat: 38.5083, lng: 43.4250 },
  // YALOVA
  { id: 'yalova', name: 'Yalova', province: 'Yalova', type: 'il', lat: 40.6500, lng: 29.2667 },
  // YOZGAT
  { id: 'yozgat', name: 'Yozgat', province: 'Yozgat', type: 'il', lat: 39.8181, lng: 34.8147 },
  // ZONGULDAK
  { id: 'zonguldak', name: 'Zonguldak', province: 'Zonguldak', type: 'il', lat: 41.4564, lng: 31.7987 },
  { id: 'zonguldak-eregli', name: 'Ereğli', province: 'Zonguldak', type: 'ilce', lat: 41.2772, lng: 31.4239 },
  { id: 'zonguldak-kdz-eregli', name: 'Kdz. Ereğli', province: 'Zonguldak', type: 'ilce', lat: 41.2772, lng: 31.4239 },
];

export function searchPlaces(query: string): TurkishPlace[] {
  if (!query || query.length < 1) return [];
  const q = normalize(query.trim());
  const startsWith: TurkishPlace[] = [];
  const includes: TurkishPlace[] = [];

  for (const place of TURKISH_PLACES) {
    const namNorm = normalize(place.name);
    const fullNorm = normalize(place.province + ' ' + place.name);
    if (namNorm.startsWith(q) || fullNorm.startsWith(q)) {
      startsWith.push(place);
    } else if (namNorm.includes(q) || fullNorm.includes(q)) {
      includes.push(place);
    }
  }

  // İller önce çıksın
  const sorted = [...startsWith, ...includes].sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === 'il' ? -1 : 1;
  });

  return sorted.slice(0, 8);
}
