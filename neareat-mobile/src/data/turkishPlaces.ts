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
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ü/g, 'u')
    .replace(/Ç/g, 'c')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ç/g, 'c');
}

export const TURKISH_PLACES: TurkishPlace[] = [
  // ADANA
  { id: 'adana', name: 'Adana', province: 'Adana', type: 'il', lat: 37.0000, lng: 35.3213 },
  { id: 'adana-seyhan', name: 'Seyhan', province: 'Adana', type: 'ilce', lat: 37.0023, lng: 35.3213 },
  { id: 'adana-cukurova', name: 'Çukurova', province: 'Adana', type: 'ilce', lat: 37.0222, lng: 35.2833 },
  { id: 'adana-yuregir', name: 'Yüreğir', province: 'Adana', type: 'ilce', lat: 36.9855, lng: 35.3792 },
  { id: 'adana-kozan', name: 'Kozan', province: 'Adana', type: 'ilce', lat: 37.4503, lng: 35.8139 },
  { id: 'adana-ceyhan', name: 'Ceyhan', province: 'Adana', type: 'ilce', lat: 37.0253, lng: 35.8139 },
  { id: 'adana-saricam', name: 'Sarıçam', province: 'Adana', type: 'ilce', lat: 37.0833, lng: 35.3667 },
  { id: 'adana-pozanti', name: 'Pozantı', province: 'Adana', type: 'ilce', lat: 37.4289, lng: 34.8817 },
  { id: 'adana-karatas', name: 'Karataş', province: 'Adana', type: 'ilce', lat: 36.5700, lng: 35.3667 },
  // ADIYAMAN
  { id: 'adiyaman', name: 'Adıyaman', province: 'Adıyaman', type: 'il', lat: 37.7647, lng: 38.2766 },
  { id: 'adiyaman-golbasi', name: 'Gölbaşı', province: 'Adıyaman', type: 'ilce', lat: 37.7811, lng: 37.6486 },
  { id: 'adiyaman-kahta', name: 'Kahta', province: 'Adıyaman', type: 'ilce', lat: 37.7833, lng: 38.6167 },
  { id: 'adiyaman-besni', name: 'Besni', province: 'Adıyaman', type: 'ilce', lat: 37.6906, lng: 37.8564 },
  // AFYONKARAHİSAR
  { id: 'afyonkarahisar', name: 'Afyonkarahisar', province: 'Afyonkarahisar', type: 'il', lat: 38.7569, lng: 30.5387 },
  { id: 'afyonkarahisar-sandikli', name: 'Sandıklı', province: 'Afyonkarahisar', type: 'ilce', lat: 38.4636, lng: 30.2639 },
  { id: 'afyonkarahisar-emirdağ', name: 'Emirdağ', province: 'Afyonkarahisar', type: 'ilce', lat: 39.0167, lng: 31.1500 },
  { id: 'afyonkarahisar-dinar', name: 'Dinar', province: 'Afyonkarahisar', type: 'ilce', lat: 38.0672, lng: 30.1614 },
  { id: 'afyonkarahisar-bolvadin', name: 'Bolvadin', province: 'Afyonkarahisar', type: 'ilce', lat: 38.7108, lng: 31.0592 },
  { id: 'afyonkarahisar-suhut', name: 'Şuhut', province: 'Afyonkarahisar', type: 'ilce', lat: 38.5369, lng: 30.5458 },
  // AĞRI
  { id: 'agri', name: 'Ağrı', province: 'Ağrı', type: 'il', lat: 39.7191, lng: 43.0503 },
  { id: 'agri-dogubeyazit', name: 'Doğubayazıt', province: 'Ağrı', type: 'ilce', lat: 39.5464, lng: 44.0886 },
  { id: 'agri-patnos', name: 'Patnos', province: 'Ağrı', type: 'ilce', lat: 39.2353, lng: 42.8614 },
  { id: 'agri-diyadin', name: 'Diyadin', province: 'Ağrı', type: 'ilce', lat: 39.5406, lng: 43.6714 },
  // AKSARAY
  { id: 'aksaray', name: 'Aksaray', province: 'Aksaray', type: 'il', lat: 38.3682, lng: 34.0370 },
  { id: 'aksaray-eskil', name: 'Eskil', province: 'Aksaray', type: 'ilce', lat: 38.4028, lng: 33.6833 },
  { id: 'aksaray-güzelyurt', name: 'Güzelyurt', province: 'Aksaray', type: 'ilce', lat: 38.2594, lng: 34.3717 },
  // AMASYA
  { id: 'amasya', name: 'Amasya', province: 'Amasya', type: 'il', lat: 40.6499, lng: 35.8353 },
  { id: 'amasya-merzifon', name: 'Merzifon', province: 'Amasya', type: 'ilce', lat: 40.8728, lng: 35.4617 },
  { id: 'amasya-suluova', name: 'Suluova', province: 'Amasya', type: 'ilce', lat: 40.8347, lng: 35.6517 },
  { id: 'amasya-tasova', name: 'Taşova', province: 'Amasya', type: 'ilce', lat: 40.7394, lng: 36.3161 },
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
  { id: 'antalya-kumluca', name: 'Kumluca', province: 'Antalya', type: 'ilce', lat: 36.3700, lng: 30.2861 },
  { id: 'antalya-gazipasa', name: 'Gazipaşa', province: 'Antalya', type: 'ilce', lat: 36.2694, lng: 32.5139 },
  { id: 'antalya-korkuteli', name: 'Korkuteli', province: 'Antalya', type: 'ilce', lat: 37.0614, lng: 30.1972 },
  { id: 'antalya-elmali', name: 'Elmalı', province: 'Antalya', type: 'ilce', lat: 36.7353, lng: 29.9189 },
  { id: 'antalya-akseki', name: 'Akseki', province: 'Antalya', type: 'ilce', lat: 37.0472, lng: 31.7917 },
  // ARTVİN
  { id: 'artvin', name: 'Artvin', province: 'Artvin', type: 'il', lat: 41.1833, lng: 41.8167 },
  { id: 'artvin-hopa', name: 'Hopa', province: 'Artvin', type: 'ilce', lat: 41.4083, lng: 41.4217 },
  { id: 'artvin-borcka', name: 'Borçka', province: 'Artvin', type: 'ilce', lat: 41.3569, lng: 41.6983 },
  { id: 'artvin-ardanuc', name: 'Ardanuç', province: 'Artvin', type: 'ilce', lat: 41.1117, lng: 42.0683 },
  { id: 'artvin-savshat', name: 'Şavşat', province: 'Artvin', type: 'ilce', lat: 41.2383, lng: 42.3644 },
  { id: 'artvin-yusufeli', name: 'Yusufeli', province: 'Artvin', type: 'ilce', lat: 40.8211, lng: 41.5228 },
  // AYDIN
  { id: 'aydin', name: 'Aydın', province: 'Aydın', type: 'il', lat: 37.8444, lng: 27.8458 },
  { id: 'aydin-efeler', name: 'Efeler', province: 'Aydın', type: 'ilce', lat: 37.8444, lng: 27.8458 },
  { id: 'aydin-kusadasi', name: 'Kuşadası', province: 'Aydın', type: 'ilce', lat: 37.8597, lng: 27.2600 },
  { id: 'aydin-nazilli', name: 'Nazilli', province: 'Aydın', type: 'ilce', lat: 37.9139, lng: 28.3239 },
  { id: 'aydin-didim', name: 'Didim', province: 'Aydın', type: 'ilce', lat: 37.3592, lng: 27.2694 },
  { id: 'aydin-soke', name: 'Söke', province: 'Aydın', type: 'ilce', lat: 37.7486, lng: 27.4097 },
  { id: 'aydin-incirliova', name: 'İncirliova', province: 'Aydın', type: 'ilce', lat: 37.8569, lng: 27.7028 },
  { id: 'aydin-germencik', name: 'Germencik', province: 'Aydın', type: 'ilce', lat: 37.8758, lng: 27.5986 },
  { id: 'aydin-cine', name: 'Çine', province: 'Aydın', type: 'ilce', lat: 37.6111, lng: 28.0611 },
  // BALIKESİR
  { id: 'balikesir', name: 'Balıkesir', province: 'Balıkesir', type: 'il', lat: 39.6484, lng: 27.8826 },
  { id: 'balikesir-bandirma', name: 'Bandırma', province: 'Balıkesir', type: 'ilce', lat: 40.3514, lng: 27.9764 },
  { id: 'balikesir-edremit', name: 'Edremit', province: 'Balıkesir', type: 'ilce', lat: 39.5928, lng: 27.0239 },
  { id: 'balikesir-ayvalik', name: 'Ayvalık', province: 'Balıkesir', type: 'ilce', lat: 39.3183, lng: 26.6964 },
  { id: 'balikesir-gonen', name: 'Gönen', province: 'Balıkesir', type: 'ilce', lat: 40.0956, lng: 27.6522 },
  { id: 'balikesir-burhaniye', name: 'Burhaniye', province: 'Balıkesir', type: 'ilce', lat: 39.4992, lng: 26.9806 },
  { id: 'balikesir-erdek', name: 'Erdek', province: 'Balıkesir', type: 'ilce', lat: 40.4014, lng: 27.7933 },
  { id: 'balikesir-susurluk', name: 'Susurluk', province: 'Balıkesir', type: 'ilce', lat: 39.9108, lng: 28.1594 },
  // BARTIN
  { id: 'bartin', name: 'Bartın', province: 'Bartın', type: 'il', lat: 41.6353, lng: 32.3375 },
  { id: 'bartin-amasra', name: 'Amasra', province: 'Bartın', type: 'ilce', lat: 41.7472, lng: 32.3839 },
  { id: 'bartin-ulus', name: 'Ulus', province: 'Bartın', type: 'ilce', lat: 41.5836, lng: 32.6419 },
  // BATMAN
  { id: 'batman', name: 'Batman', province: 'Batman', type: 'il', lat: 37.8812, lng: 41.1351 },
  { id: 'batman-besiri', name: 'Beşiri', province: 'Batman', type: 'ilce', lat: 37.9186, lng: 41.2944 },
  { id: 'batman-kurtalan', name: 'Kurtalan', province: 'Batman', type: 'ilce', lat: 37.9289, lng: 41.7000 },
  { id: 'batman-kozluk', name: 'Kozluk', province: 'Batman', type: 'ilce', lat: 38.1917, lng: 41.4861 },
  // BAYBURT
  { id: 'bayburt', name: 'Bayburt', province: 'Bayburt', type: 'il', lat: 40.2552, lng: 40.2249 },
  { id: 'bayburt-aydintepe', name: 'Aydıntepe', province: 'Bayburt', type: 'ilce', lat: 40.1667, lng: 40.0833 },
  { id: 'bayburt-demirözü', name: 'Demirözü', province: 'Bayburt', type: 'ilce', lat: 40.3667, lng: 39.8667 },
  // BİLECİK
  { id: 'bilecik', name: 'Bilecik', province: 'Bilecik', type: 'il', lat: 40.1500, lng: 29.9667 },
  { id: 'bilecik-bozuyuk', name: 'Bozüyük', province: 'Bilecik', type: 'ilce', lat: 39.9056, lng: 30.0361 },
  { id: 'bilecik-osmaneli', name: 'Osmaneli', province: 'Bilecik', type: 'ilce', lat: 40.3597, lng: 30.0153 },
  { id: 'bilecik-sogut', name: 'Söğüt', province: 'Bilecik', type: 'ilce', lat: 40.0167, lng: 30.1833 },
  // BİNGÖL
  { id: 'bingol', name: 'Bingöl', province: 'Bingöl', type: 'il', lat: 38.8833, lng: 40.4983 },
  { id: 'bingol-genc', name: 'Genç', province: 'Bingöl', type: 'ilce', lat: 38.7433, lng: 40.5583 },
  { id: 'bingol-karliova', name: 'Karlıova', province: 'Bingöl', type: 'ilce', lat: 39.2983, lng: 41.0153 },
  { id: 'bingol-solhan', name: 'Solhan', province: 'Bingöl', type: 'ilce', lat: 38.9583, lng: 41.0628 },
  // BİTLİS
  { id: 'bitlis', name: 'Bitlis', province: 'Bitlis', type: 'il', lat: 38.4000, lng: 42.1167 },
  { id: 'bitlis-tatvan', name: 'Tatvan', province: 'Bitlis', type: 'ilce', lat: 38.5108, lng: 42.2811 },
  { id: 'bitlis-ahlat', name: 'Ahlat', province: 'Bitlis', type: 'ilce', lat: 38.7528, lng: 42.4767 },
  { id: 'bitlis-guroymak', name: 'Güroymak', province: 'Bitlis', type: 'ilce', lat: 38.5833, lng: 42.0000 },
  // BOLU
  { id: 'bolu', name: 'Bolu', province: 'Bolu', type: 'il', lat: 40.7353, lng: 31.6061 },
  { id: 'bolu-gerede', name: 'Gerede', province: 'Bolu', type: 'ilce', lat: 40.8022, lng: 32.1997 },
  { id: 'bolu-goynuk', name: 'Göynük', province: 'Bolu', type: 'ilce', lat: 40.3953, lng: 30.7797 },
  { id: 'bolu-mudurnu', name: 'Mudurnu', province: 'Bolu', type: 'ilce', lat: 40.4583, lng: 31.2128 },
  // BURDUR
  { id: 'burdur', name: 'Burdur', province: 'Burdur', type: 'il', lat: 37.7206, lng: 30.2908 },
  { id: 'burdur-bucak', name: 'Bucak', province: 'Burdur', type: 'ilce', lat: 37.4597, lng: 30.5972 },
  { id: 'burdur-golhisar', name: 'Gölhisar', province: 'Burdur', type: 'ilce', lat: 37.1450, lng: 29.5078 },
  { id: 'burdur-yalvac', name: 'Yeşilova', province: 'Burdur', type: 'ilce', lat: 37.5178, lng: 29.7622 },
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
  { id: 'canakkale-biga', name: 'Biga', province: 'Çanakkale', type: 'ilce', lat: 40.2278, lng: 27.2397 },
  { id: 'canakkale-can', name: 'Çan', province: 'Çanakkale', type: 'ilce', lat: 40.0333, lng: 27.0500 },
  { id: 'canakkale-ezine', name: 'Ezine', province: 'Çanakkale', type: 'ilce', lat: 39.7939, lng: 26.3383 },
  { id: 'canakkale-gokceada', name: 'Gökçeada', province: 'Çanakkale', type: 'ilce', lat: 40.1783, lng: 25.8844 },
  // ÇANKIRI
  { id: 'cankiri', name: 'Çankırı', province: 'Çankırı', type: 'il', lat: 40.6013, lng: 33.6114 },
  { id: 'cankiri-cerkes', name: 'Çerkeş', province: 'Çankırı', type: 'ilce', lat: 40.8153, lng: 32.8928 },
  { id: 'cankiri-ilgaz', name: 'Ilgaz', province: 'Çankırı', type: 'ilce', lat: 40.9194, lng: 33.6194 },
  { id: 'cankiri-kursunlu', name: 'Kurşunlu', province: 'Çankırı', type: 'ilce', lat: 40.8372, lng: 33.2597 },
  // ÇORUM
  { id: 'corum', name: 'Çorum', province: 'Çorum', type: 'il', lat: 40.5506, lng: 34.9556 },
  { id: 'corum-sungurlu', name: 'Sungurlu', province: 'Çorum', type: 'ilce', lat: 40.1608, lng: 34.3711 },
  { id: 'corum-osmancik', name: 'Osmancık', province: 'Çorum', type: 'ilce', lat: 40.9744, lng: 34.8017 },
  { id: 'corum-iskilip', name: 'İskilip', province: 'Çorum', type: 'ilce', lat: 40.7456, lng: 34.4678 },
  { id: 'corum-alaca', name: 'Alaca', province: 'Çorum', type: 'ilce', lat: 40.1658, lng: 35.0000 },
  // DENİZLİ
  { id: 'denizli', name: 'Denizli', province: 'Denizli', type: 'il', lat: 37.7765, lng: 29.0864 },
  { id: 'denizli-merkezefendi', name: 'Merkezefendi', province: 'Denizli', type: 'ilce', lat: 37.7833, lng: 29.0833 },
  { id: 'denizli-pamukkale', name: 'Pamukkale', province: 'Denizli', type: 'ilce', lat: 37.9333, lng: 29.1167 },
  // DİYARBAKIR
  { id: 'diyarbakir', name: 'Diyarbakır', province: 'Diyarbakır', type: 'il', lat: 37.9144, lng: 40.2306 },
  { id: 'diyarbakir-baglar', name: 'Bağlar', province: 'Diyarbakır', type: 'ilce', lat: 37.9094, lng: 40.1975 },
  { id: 'diyarbakir-kayapinar', name: 'Kayapınar', province: 'Diyarbakır', type: 'ilce', lat: 37.9103, lng: 40.2706 },
  { id: 'diyarbakir-yenisehir', name: 'Yenişehir', province: 'Diyarbakır', type: 'ilce', lat: 37.9239, lng: 40.2311 },
  { id: 'diyarbakir-bismil', name: 'Bismil', province: 'Diyarbakır', type: 'ilce', lat: 37.8561, lng: 40.6567 },
  { id: 'diyarbakir-ergani', name: 'Ergani', province: 'Diyarbakır', type: 'ilce', lat: 38.2717, lng: 39.7631 },
  { id: 'diyarbakir-silvan', name: 'Silvan', province: 'Diyarbakır', type: 'ilce', lat: 38.1406, lng: 41.0097 },
  // DÜZCE
  { id: 'duzce', name: 'Düzce', province: 'Düzce', type: 'il', lat: 40.8438, lng: 31.1565 },
  { id: 'duzce-akcakoca', name: 'Akçakoca', province: 'Düzce', type: 'ilce', lat: 41.0844, lng: 31.1183 },
  { id: 'duzce-kaynasli', name: 'Kaynaşlı', province: 'Düzce', type: 'ilce', lat: 40.7408, lng: 31.3392 },
  // EDİRNE
  { id: 'edirne', name: 'Edirne', province: 'Edirne', type: 'il', lat: 41.6818, lng: 26.5623 },
  { id: 'edirne-uzunkopru', name: 'Uzunköprü', province: 'Edirne', type: 'ilce', lat: 41.2697, lng: 26.6875 },
  { id: 'edirne-kesan', name: 'Keşan', province: 'Edirne', type: 'ilce', lat: 41.1881, lng: 26.6344 },
  { id: 'edirne-ipsala', name: 'İpsala', province: 'Edirne', type: 'ilce', lat: 40.9231, lng: 26.3836 },
  { id: 'edirne-havsa', name: 'Havsa', province: 'Edirne', type: 'ilce', lat: 41.5486, lng: 26.8183 },
  // ELAZIĞ
  { id: 'elazig', name: 'Elazığ', province: 'Elazığ', type: 'il', lat: 38.6810, lng: 39.2264 },
  { id: 'elazig-kovancılar', name: 'Kovancılar', province: 'Elazığ', type: 'ilce', lat: 38.7167, lng: 39.8333 },
  { id: 'elazig-keban', name: 'Keban', province: 'Elazığ', type: 'ilce', lat: 38.8014, lng: 38.7444 },
  { id: 'elazig-palu', name: 'Palu', province: 'Elazığ', type: 'ilce', lat: 38.6917, lng: 40.0567 },
  // ERZİNCAN
  { id: 'erzincan', name: 'Erzincan', province: 'Erzincan', type: 'il', lat: 39.7500, lng: 39.5000 },
  { id: 'erzincan-refahiye', name: 'Refahiye', province: 'Erzincan', type: 'ilce', lat: 39.9083, lng: 38.7667 },
  { id: 'erzincan-tercan', name: 'Tercan', province: 'Erzincan', type: 'ilce', lat: 39.7833, lng: 40.3833 },
  { id: 'erzincan-kemah', name: 'Kemah', province: 'Erzincan', type: 'ilce', lat: 39.5789, lng: 38.4808 },
  // ERZURUM
  { id: 'erzurum', name: 'Erzurum', province: 'Erzurum', type: 'il', lat: 39.9000, lng: 41.2700 },
  { id: 'erzurum-palandoken', name: 'Palandöken', province: 'Erzurum', type: 'ilce', lat: 39.8892, lng: 41.2481 },
  { id: 'erzurum-yakutiye', name: 'Yakutiye', province: 'Erzurum', type: 'ilce', lat: 39.9069, lng: 41.2756 },
  { id: 'erzurum-aziziye', name: 'Aziziye', province: 'Erzurum', type: 'ilce', lat: 39.8981, lng: 41.2217 },
  { id: 'erzurum-horasan', name: 'Horasan', province: 'Erzurum', type: 'ilce', lat: 40.0444, lng: 42.1731 },
  { id: 'erzurum-oltu', name: 'Oltu', province: 'Erzurum', type: 'ilce', lat: 40.5497, lng: 41.9900 },
  { id: 'erzurum-ispir', name: 'İspir', province: 'Erzurum', type: 'ilce', lat: 40.4867, lng: 40.9931 },
  // ESKİŞEHİR
  { id: 'eskisehir', name: 'Eskişehir', province: 'Eskişehir', type: 'il', lat: 39.7767, lng: 30.5206 },
  { id: 'eskisehir-tepebaşi', name: 'Tepebaşı', province: 'Eskişehir', type: 'ilce', lat: 39.7881, lng: 30.5058 },
  { id: 'eskisehir-odunpazari', name: 'Odunpazarı', province: 'Eskişehir', type: 'ilce', lat: 39.7681, lng: 30.5378 },
  { id: 'eskisehir-sivrihisar', name: 'Sivrihisar', province: 'Eskişehir', type: 'ilce', lat: 39.4514, lng: 31.5333 },
  { id: 'eskisehir-seyitgazi', name: 'Seyitgazi', province: 'Eskişehir', type: 'ilce', lat: 39.4333, lng: 30.6917 },
  { id: 'eskisehir-cifteler', name: 'Çifteler', province: 'Eskişehir', type: 'ilce', lat: 39.3781, lng: 31.0281 },
  // GAZİANTEP
  { id: 'gaziantep', name: 'Gaziantep', province: 'Gaziantep', type: 'il', lat: 37.0662, lng: 37.3833 },
  { id: 'gaziantep-sahinbey', name: 'Şahinbey', province: 'Gaziantep', type: 'ilce', lat: 37.0611, lng: 37.3664 },
  { id: 'gaziantep-sehitkamil', name: 'Şehitkamil', province: 'Gaziantep', type: 'ilce', lat: 37.0789, lng: 37.3608 },
  { id: 'gaziantep-nizip', name: 'Nizip', province: 'Gaziantep', type: 'ilce', lat: 37.0083, lng: 37.7964 },
  { id: 'gaziantep-islahiye', name: 'İslahiye', province: 'Gaziantep', type: 'ilce', lat: 37.0197, lng: 36.6292 },
  { id: 'gaziantep-nurdagi', name: 'Nurdağı', province: 'Gaziantep', type: 'ilce', lat: 37.1750, lng: 36.7333 },
  { id: 'gaziantep-oguzeli', name: 'Oğuzeli', province: 'Gaziantep', type: 'ilce', lat: 36.9583, lng: 37.5161 },
  // GİRESUN
  { id: 'giresun', name: 'Giresun', province: 'Giresun', type: 'il', lat: 40.9128, lng: 38.3895 },
  { id: 'giresun-bulancak', name: 'Bulancak', province: 'Giresun', type: 'ilce', lat: 40.9408, lng: 38.2314 },
  { id: 'giresun-gorele', name: 'Görele', province: 'Giresun', type: 'ilce', lat: 41.0239, lng: 38.7814 },
  { id: 'giresun-tirebolu', name: 'Tirebolu', province: 'Giresun', type: 'ilce', lat: 40.9928, lng: 38.8178 },
  { id: 'giresun-espiye', name: 'Espiye', province: 'Giresun', type: 'ilce', lat: 40.9500, lng: 38.7167 },
  { id: 'giresun-sebinkarahisar', name: 'Şebinkarahisar', province: 'Giresun', type: 'ilce', lat: 40.2897, lng: 38.4239 },
  // GÜMÜŞHANE
  { id: 'gumushane', name: 'Gümüşhane', province: 'Gümüşhane', type: 'il', lat: 40.4608, lng: 39.4786 },
  { id: 'gumushane-kelkit', name: 'Kelkit', province: 'Gümüşhane', type: 'ilce', lat: 40.1289, lng: 39.4439 },
  { id: 'gumushane-siran', name: 'Şiran', province: 'Gümüşhane', type: 'ilce', lat: 40.1794, lng: 38.9194 },
  { id: 'gumushane-torul', name: 'Torul', province: 'Gümüşhane', type: 'ilce', lat: 40.5622, lng: 39.2967 },
  // HAKKARİ
  { id: 'hakkari', name: 'Hakkari', province: 'Hakkari', type: 'il', lat: 37.5744, lng: 43.7408 },
  { id: 'hakkari-yuksekova', name: 'Yüksekova', province: 'Hakkari', type: 'ilce', lat: 37.5667, lng: 44.2833 },
  { id: 'hakkari-semdinli', name: 'Şemdinli', province: 'Hakkari', type: 'ilce', lat: 37.3083, lng: 44.5750 },
  { id: 'hakkari-cukurca', name: 'Çukurca', province: 'Hakkari', type: 'ilce', lat: 37.2611, lng: 43.6108 },
  // HATAY
  { id: 'hatay', name: 'Hatay', province: 'Hatay', type: 'il', lat: 36.4018, lng: 36.3498 },
  { id: 'hatay-antakya', name: 'Antakya', province: 'Hatay', type: 'ilce', lat: 36.2065, lng: 36.1603 },
  { id: 'hatay-iskenderun', name: 'İskenderun', province: 'Hatay', type: 'ilce', lat: 36.5872, lng: 36.1642 },
  { id: 'hatay-dortyol', name: 'Dörtyol', province: 'Hatay', type: 'ilce', lat: 36.8467, lng: 36.2239 },
  { id: 'hatay-kirikhan', name: 'Kırıkhan', province: 'Hatay', type: 'ilce', lat: 36.4964, lng: 36.3594 },
  { id: 'hatay-reyhanli', name: 'Reyhanlı', province: 'Hatay', type: 'ilce', lat: 36.2644, lng: 36.5697 },
  { id: 'hatay-samandagi', name: 'Samandağ', province: 'Hatay', type: 'ilce', lat: 36.0750, lng: 35.9833 },
  { id: 'hatay-belen', name: 'Belen', province: 'Hatay', type: 'ilce', lat: 36.4917, lng: 36.1869 },
  // IĞDIR
  { id: 'igdir', name: 'Iğdır', province: 'Iğdır', type: 'il', lat: 39.9167, lng: 44.0333 },
  { id: 'igdir-aralik', name: 'Aralık', province: 'Iğdır', type: 'ilce', lat: 39.8803, lng: 44.5239 },
  { id: 'igdir-tuzluca', name: 'Tuzluca', province: 'Iğdır', type: 'ilce', lat: 40.0458, lng: 43.6569 },
  // ISPARTA
  { id: 'isparta', name: 'Isparta', province: 'Isparta', type: 'il', lat: 37.7648, lng: 30.5566 },
  { id: 'isparta-egirdir', name: 'Eğirdir', province: 'Isparta', type: 'ilce', lat: 37.8731, lng: 30.8478 },
  { id: 'isparta-yalvac', name: 'Yalvaç', province: 'Isparta', type: 'ilce', lat: 38.2975, lng: 31.1803 },
  { id: 'isparta-sarkikaraagac', name: 'Şarkikaraağaç', province: 'Isparta', type: 'ilce', lat: 38.0822, lng: 31.3711 },
  { id: 'isparta-senirkent', name: 'Senirkent', province: 'Isparta', type: 'ilce', lat: 38.1053, lng: 30.5500 },
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
  { id: 'izmir-balcova', name: 'Balçova', province: 'İzmir', type: 'ilce', lat: 38.3914, lng: 27.0494 },
  { id: 'izmir-guzelbahce', name: 'Güzelbahçe', province: 'İzmir', type: 'ilce', lat: 38.3178, lng: 26.8972 },
  { id: 'izmir-karsibayrakli', name: 'Karabağlar', province: 'İzmir', type: 'ilce', lat: 38.3561, lng: 27.1333 },
  { id: 'izmir-kemalapasa', name: 'Kemalpaşa', province: 'İzmir', type: 'ilce', lat: 38.4311, lng: 27.4253 },
  { id: 'izmir-odemis', name: 'Ödemiş', province: 'İzmir', type: 'ilce', lat: 38.2236, lng: 27.9689 },
  { id: 'izmir-tire', name: 'Tire', province: 'İzmir', type: 'ilce', lat: 37.9897, lng: 27.7344 },
  { id: 'izmir-torbali', name: 'Torbalı', province: 'İzmir', type: 'ilce', lat: 38.1600, lng: 27.3628 },
  { id: 'izmir-menemen', name: 'Menemen', province: 'İzmir', type: 'ilce', lat: 38.6047, lng: 27.0678 },
  { id: 'izmir-dikili', name: 'Dikili', province: 'İzmir', type: 'ilce', lat: 39.0736, lng: 26.8928 },
  { id: 'izmir-foca', name: 'Foça', province: 'İzmir', type: 'ilce', lat: 38.6703, lng: 26.7547 },
  // KAHRAMANMARAŞ
  { id: 'kahramanmaras', name: 'Kahramanmaraş', province: 'Kahramanmaraş', type: 'il', lat: 37.5858, lng: 36.9371 },
  { id: 'kahramanmaras-dulkadiroglu', name: 'Dulkadiroğlu', province: 'Kahramanmaraş', type: 'ilce', lat: 37.5781, lng: 36.9494 },
  { id: 'kahramanmaras-onikisube', name: 'Onikişubat', province: 'Kahramanmaraş', type: 'ilce', lat: 37.5947, lng: 36.9183 },
  { id: 'kahramanmaras-elbistan', name: 'Elbistan', province: 'Kahramanmaraş', type: 'ilce', lat: 38.2053, lng: 37.1972 },
  { id: 'kahramanmaras-afsin', name: 'Afşin', province: 'Kahramanmaraş', type: 'ilce', lat: 38.2478, lng: 36.9136 },
  { id: 'kahramanmaras-pazarcik', name: 'Pazarcık', province: 'Kahramanmaraş', type: 'ilce', lat: 37.4983, lng: 37.2950 },
  { id: 'kahramanmaras-andirin', name: 'Andırın', province: 'Kahramanmaraş', type: 'ilce', lat: 37.5744, lng: 36.3467 },
  // KARABÜK
  { id: 'karabuk', name: 'Karabük', province: 'Karabük', type: 'il', lat: 41.2061, lng: 32.6204 },
  { id: 'karabuk-safranbolu', name: 'Safranbolu', province: 'Karabük', type: 'ilce', lat: 41.2531, lng: 32.6897 },
  { id: 'karabuk-yenice', name: 'Yenice', province: 'Karabük', type: 'ilce', lat: 41.2006, lng: 32.3281 },
  { id: 'karabuk-eskipazar', name: 'Eskipazar', province: 'Karabük', type: 'ilce', lat: 40.9597, lng: 32.5211 },
  // KARAMAN
  { id: 'karaman', name: 'Karaman', province: 'Karaman', type: 'il', lat: 37.1759, lng: 33.2287 },
  { id: 'karaman-ermenek', name: 'Ermenek', province: 'Karaman', type: 'ilce', lat: 36.6383, lng: 32.8994 },
  { id: 'karaman-kazimkarabekir', name: 'Kazımkarabekir', province: 'Karaman', type: 'ilce', lat: 37.2439, lng: 33.7050 },
  // KARS
  { id: 'kars', name: 'Kars', province: 'Kars', type: 'il', lat: 40.6013, lng: 43.0975 },
  { id: 'kars-sarikamis', name: 'Sarıkamış', province: 'Kars', type: 'ilce', lat: 40.3344, lng: 42.5872 },
  { id: 'kars-kagizman', name: 'Kağızman', province: 'Kars', type: 'ilce', lat: 40.1472, lng: 43.1200 },
  { id: 'kars-ardahan', name: 'Ardahan', province: 'Kars', type: 'ilce', lat: 41.1108, lng: 42.7022 },
  // KASTAMONU
  { id: 'kastamonu', name: 'Kastamonu', province: 'Kastamonu', type: 'il', lat: 41.3887, lng: 33.7827 },
  { id: 'kastamonu-taskopru', name: 'Taşköprü', province: 'Kastamonu', type: 'ilce', lat: 41.5094, lng: 34.2117 },
  { id: 'kastamonu-tosya', name: 'Tosya', province: 'Kastamonu', type: 'ilce', lat: 41.0178, lng: 34.0344 },
  { id: 'kastamonu-inebolu', name: 'İnebolu', province: 'Kastamonu', type: 'ilce', lat: 41.9806, lng: 33.7706 },
  { id: 'kastamonu-cide', name: 'Cide', province: 'Kastamonu', type: 'ilce', lat: 41.8883, lng: 32.9883 },
  // KAYSERİ
  { id: 'kayseri', name: 'Kayseri', province: 'Kayseri', type: 'il', lat: 38.7205, lng: 35.4826 },
  { id: 'kayseri-melikgazi', name: 'Melikgazi', province: 'Kayseri', type: 'ilce', lat: 38.7331, lng: 35.4808 },
  { id: 'kayseri-kocasinan', name: 'Kocasinan', province: 'Kayseri', type: 'ilce', lat: 38.7431, lng: 35.5158 },
  { id: 'kayseri-talas', name: 'Talas', province: 'Kayseri', type: 'ilce', lat: 38.6803, lng: 35.5497 },
  // KİLİS
  { id: 'kilis', name: 'Kilis', province: 'Kilis', type: 'il', lat: 36.7175, lng: 37.1153 },
  { id: 'kilis-elbeyli', name: 'Elbeyli', province: 'Kilis', type: 'ilce', lat: 36.8597, lng: 37.5839 },
  { id: 'kilis-musabeyli', name: 'Musabeyli', province: 'Kilis', type: 'ilce', lat: 36.6908, lng: 37.3742 },
  // KIRIKKALE
  { id: 'kirikkale', name: 'Kırıkkale', province: 'Kırıkkale', type: 'il', lat: 39.8468, lng: 33.5153 },
  { id: 'kirikkale-keskin', name: 'Keskin', province: 'Kırıkkale', type: 'ilce', lat: 39.6708, lng: 33.6094 },
  { id: 'kirikkale-delice', name: 'Delice', province: 'Kırıkkale', type: 'ilce', lat: 39.9461, lng: 33.9194 },
  // KIRKLARELİ
  { id: 'kirklareli', name: 'Kırklareli', province: 'Kırklareli', type: 'il', lat: 41.7333, lng: 27.2167 },
  { id: 'kirklareli-luleburgaz', name: 'Lüleburgaz', province: 'Kırklareli', type: 'ilce', lat: 41.4083, lng: 27.3556 },
  { id: 'kirklareli-babaeski', name: 'Babaeski', province: 'Kırklareli', type: 'ilce', lat: 41.4361, lng: 27.0958 },
  { id: 'kirklareli-vize', name: 'Vize', province: 'Kırklareli', type: 'ilce', lat: 41.5675, lng: 27.7711 },
  // KIRŞEHİR
  { id: 'kirsehir', name: 'Kırşehir', province: 'Kırşehir', type: 'il', lat: 39.1458, lng: 34.1614 },
  { id: 'kirsehir-kaman', name: 'Kaman', province: 'Kırşehir', type: 'ilce', lat: 39.3561, lng: 33.7239 },
  { id: 'kirsehir-mucur', name: 'Mucur', province: 'Kırşehir', type: 'ilce', lat: 39.0614, lng: 34.3819 },
  // KOCAELİ
  { id: 'kocaeli', name: 'Kocaeli', province: 'Kocaeli', type: 'il', lat: 40.8533, lng: 29.8815 },
  { id: 'kocaeli-izmit', name: 'İzmit', province: 'Kocaeli', type: 'ilce', lat: 40.7654, lng: 29.9408 },
  { id: 'kocaeli-gebze', name: 'Gebze', province: 'Kocaeli', type: 'ilce', lat: 40.8028, lng: 29.4317 },
  { id: 'kocaeli-golcuk', name: 'Gölcük', province: 'Kocaeli', type: 'ilce', lat: 40.6556, lng: 29.8281 },
  { id: 'kocaeli-darica', name: 'Darıca', province: 'Kocaeli', type: 'ilce', lat: 40.7781, lng: 29.3789 },
  { id: 'kocaeli-korfez', name: 'Körfez', province: 'Kocaeli', type: 'ilce', lat: 40.6900, lng: 29.6917 },
  { id: 'kocaeli-kartepe', name: 'Kartepe', province: 'Kocaeli', type: 'ilce', lat: 40.7400, lng: 29.9367 },
  { id: 'kocaeli-cayirova', name: 'Çayırova', province: 'Kocaeli', type: 'ilce', lat: 40.7892, lng: 29.3717 },
  { id: 'kocaeli-kandira', name: 'Kandıra', province: 'Kocaeli', type: 'ilce', lat: 41.0761, lng: 30.1522 },
  // KONYA
  { id: 'konya', name: 'Konya', province: 'Konya', type: 'il', lat: 37.8667, lng: 32.4833 },
  { id: 'konya-meram', name: 'Meram', province: 'Konya', type: 'ilce', lat: 37.8333, lng: 32.4333 },
  { id: 'konya-selcuklu', name: 'Selçuklu', province: 'Konya', type: 'ilce', lat: 37.9167, lng: 32.5000 },
  { id: 'konya-karatay', name: 'Karatay', province: 'Konya', type: 'ilce', lat: 37.8833, lng: 32.5167 },
  { id: 'konya-eregli', name: 'Ereğli', province: 'Konya', type: 'ilce', lat: 37.5144, lng: 34.0458 },
  { id: 'konya-aksehir', name: 'Akşehir', province: 'Konya', type: 'ilce', lat: 38.3583, lng: 31.4167 },
  { id: 'konya-beysehir', name: 'Beyşehir', province: 'Konya', type: 'ilce', lat: 37.6739, lng: 31.7228 },
  { id: 'konya-cihanbeyli', name: 'Cihanbeyli', province: 'Konya', type: 'ilce', lat: 38.6583, lng: 32.9250 },
  { id: 'konya-cumra', name: 'Çumra', province: 'Konya', type: 'ilce', lat: 37.5728, lng: 32.7717 },
  { id: 'konya-ilgin', name: 'Ilgın', province: 'Konya', type: 'ilce', lat: 38.2833, lng: 31.9167 },
  { id: 'konya-seydisehir', name: 'Seydişehir', province: 'Konya', type: 'ilce', lat: 37.4178, lng: 31.8483 },
  // KÜTAHYA
  { id: 'kutahya', name: 'Kütahya', province: 'Kütahya', type: 'il', lat: 39.4242, lng: 29.9833 },
  { id: 'kutahya-simav', name: 'Simav', province: 'Kütahya', type: 'ilce', lat: 39.0831, lng: 28.9803 },
  { id: 'kutahya-tavsanli', name: 'Tavşanlı', province: 'Kütahya', type: 'ilce', lat: 39.5467, lng: 29.4794 },
  { id: 'kutahya-gediz', name: 'Gediz', province: 'Kütahya', type: 'ilce', lat: 39.0408, lng: 29.4042 },
  // MALATYA
  { id: 'malatya', name: 'Malatya', province: 'Malatya', type: 'il', lat: 38.3552, lng: 38.3095 },
  { id: 'malatya-battalgazi', name: 'Battalgazi', province: 'Malatya', type: 'ilce', lat: 38.3569, lng: 38.3128 },
  { id: 'malatya-yesilyurt', name: 'Yeşilyurt', province: 'Malatya', type: 'ilce', lat: 38.3211, lng: 38.2711 },
  // MANİSA
  { id: 'manisa', name: 'Manisa', province: 'Manisa', type: 'il', lat: 38.6191, lng: 27.4289 },
  { id: 'manisa-akhisar', name: 'Akhisar', province: 'Manisa', type: 'ilce', lat: 38.9197, lng: 27.8364 },
  { id: 'manisa-turgutlu', name: 'Turgutlu', province: 'Manisa', type: 'ilce', lat: 38.5028, lng: 27.7050 },
  { id: 'manisa-salihli', name: 'Salihli', province: 'Manisa', type: 'ilce', lat: 38.4817, lng: 28.1383 },
  { id: 'manisa-soma', name: 'Soma', province: 'Manisa', type: 'ilce', lat: 39.1833, lng: 27.6000 },
  { id: 'manisa-kirkagac', name: 'Kırkağaç', province: 'Manisa', type: 'ilce', lat: 39.1050, lng: 27.6683 },
  { id: 'manisa-demirci', name: 'Demirci', province: 'Manisa', type: 'ilce', lat: 39.0453, lng: 28.6614 },
  { id: 'manisa-gordes', name: 'Gördes', province: 'Manisa', type: 'ilce', lat: 38.9289, lng: 28.2897 },
  { id: 'manisa-kula', name: 'Kula', province: 'Manisa', type: 'ilce', lat: 38.5483, lng: 28.6472 },
  // MARDİN
  { id: 'mardin', name: 'Mardin', province: 'Mardin', type: 'il', lat: 37.3212, lng: 40.7245 },
  { id: 'mardin-artuklu', name: 'Artuklu', province: 'Mardin', type: 'ilce', lat: 37.3131, lng: 40.7369 },
  { id: 'mardin-kiziltepe', name: 'Kızıltepe', province: 'Mardin', type: 'ilce', lat: 37.1928, lng: 40.5864 },
  { id: 'mardin-nusaybin', name: 'Nusaybin', province: 'Mardin', type: 'ilce', lat: 37.0836, lng: 41.2161 },
  { id: 'mardin-midyat', name: 'Midyat', province: 'Mardin', type: 'ilce', lat: 37.4194, lng: 41.3400 },
  { id: 'mardin-derik', name: 'Derik', province: 'Mardin', type: 'ilce', lat: 37.3672, lng: 40.2792 },
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
  { id: 'mugla-datca', name: 'Datça', province: 'Muğla', type: 'ilce', lat: 36.7136, lng: 27.6881 },
  { id: 'mugla-koyceğiz', name: 'Köyceğiz', province: 'Muğla', type: 'ilce', lat: 36.9611, lng: 28.6894 },
  { id: 'mugla-ortaca', name: 'Ortaca', province: 'Muğla', type: 'ilce', lat: 36.8281, lng: 28.7733 },
  { id: 'mugla-ula', name: 'Ula', province: 'Muğla', type: 'ilce', lat: 37.1083, lng: 28.4167 },
  // MUŞ
  { id: 'mus', name: 'Muş', province: 'Muş', type: 'il', lat: 38.7432, lng: 41.4943 },
  { id: 'mus-malazgirt', name: 'Malazgirt', province: 'Muş', type: 'ilce', lat: 39.1439, lng: 42.5356 },
  { id: 'mus-bulanik', name: 'Bulanık', province: 'Muş', type: 'ilce', lat: 38.9572, lng: 42.2711 },
  { id: 'mus-varto', name: 'Varto', province: 'Muş', type: 'ilce', lat: 39.1736, lng: 41.4556 },
  // NEVŞEHİR
  { id: 'nevsehir', name: 'Nevşehir', province: 'Nevşehir', type: 'il', lat: 38.6244, lng: 34.7236 },
  { id: 'nevsehir-urgup', name: 'Ürgüp', province: 'Nevşehir', type: 'ilce', lat: 38.6344, lng: 34.9131 },
  { id: 'nevsehir-goreme', name: 'Göreme', province: 'Nevşehir', type: 'ilce', lat: 38.6431, lng: 34.8278 },
  { id: 'nevsehir-avanos', name: 'Avanos', province: 'Nevşehir', type: 'ilce', lat: 38.7131, lng: 34.8461 },
  { id: 'nevsehir-hacibektas', name: 'Hacıbektaş', province: 'Nevşehir', type: 'ilce', lat: 38.9575, lng: 34.5581 },
  { id: 'nevsehir-derinkuyu', name: 'Derinkuyu', province: 'Nevşehir', type: 'ilce', lat: 38.3733, lng: 34.7317 },
  // NİĞDE
  { id: 'nigde', name: 'Niğde', province: 'Niğde', type: 'il', lat: 37.9667, lng: 34.6833 },
  { id: 'nigde-bor', name: 'Bor', province: 'Niğde', type: 'ilce', lat: 37.8894, lng: 34.5697 },
  { id: 'nigde-ulukisla', name: 'Ulukışla', province: 'Niğde', type: 'ilce', lat: 37.5492, lng: 34.4847 },
  // ORDU
  { id: 'ordu', name: 'Ordu', province: 'Ordu', type: 'il', lat: 40.9839, lng: 37.8764 },
  { id: 'ordu-altinordu', name: 'Altınordu', province: 'Ordu', type: 'ilce', lat: 40.9844, lng: 37.8744 },
  { id: 'ordu-fatsa', name: 'Fatsa', province: 'Ordu', type: 'ilce', lat: 41.0344, lng: 37.5006 },
  { id: 'ordu-unye', name: 'Ünye', province: 'Ordu', type: 'ilce', lat: 41.1364, lng: 37.2847 },
  { id: 'ordu-perşembe', name: 'Perşembe', province: 'Ordu', type: 'ilce', lat: 41.0678, lng: 37.7583 },
  { id: 'ordu-korgan', name: 'Korgan', province: 'Ordu', type: 'ilce', lat: 40.8194, lng: 37.6139 },
  // OSMANİYE
  { id: 'osmaniye', name: 'Osmaniye', province: 'Osmaniye', type: 'il', lat: 37.0742, lng: 36.2478 },
  { id: 'osmaniye-kadirli', name: 'Kadirli', province: 'Osmaniye', type: 'ilce', lat: 37.3736, lng: 36.0939 },
  { id: 'osmaniye-bahce', name: 'Bahçe', province: 'Osmaniye', type: 'ilce', lat: 37.1958, lng: 36.5764 },
  // RİZE
  { id: 'rize', name: 'Rize', province: 'Rize', type: 'il', lat: 41.0208, lng: 40.5234 },
  { id: 'rize-ardesen', name: 'Ardeşen', province: 'Rize', type: 'ilce', lat: 41.1939, lng: 40.9856 },
  { id: 'rize-cayeli', name: 'Çayeli', province: 'Rize', type: 'ilce', lat: 41.0867, lng: 40.7231 },
  { id: 'rize-pazar', name: 'Pazar', province: 'Rize', type: 'ilce', lat: 41.1750, lng: 40.8833 },
  { id: 'rize-findikli', name: 'Fındıklı', province: 'Rize', type: 'ilce', lat: 41.2889, lng: 41.1489 },
  // SAKARYA
  { id: 'sakarya', name: 'Sakarya', province: 'Sakarya', type: 'il', lat: 40.6940, lng: 30.4358 },
  { id: 'sakarya-adapazari', name: 'Adapazarı', province: 'Sakarya', type: 'ilce', lat: 40.7759, lng: 30.3967 },
  { id: 'sakarya-serdivan', name: 'Serdivan', province: 'Sakarya', type: 'ilce', lat: 40.7397, lng: 30.4317 },
  // SAMSUN
  { id: 'samsun', name: 'Samsun', province: 'Samsun', type: 'il', lat: 41.2867, lng: 36.3300 },
  { id: 'samsun-ilkadim', name: 'İlkadım', province: 'Samsun', type: 'ilce', lat: 41.2922, lng: 36.3264 },
  { id: 'samsun-atakum', name: 'Atakum', province: 'Samsun', type: 'ilce', lat: 41.3122, lng: 36.2581 },
  { id: 'samsun-canik', name: 'Canik', province: 'Samsun', type: 'ilce', lat: 41.2656, lng: 36.3728 },
  { id: 'samsun-tekkeköy', name: 'Tekkeköy', province: 'Samsun', type: 'ilce', lat: 41.2208, lng: 36.4617 },
  { id: 'samsun-bafra', name: 'Bafra', province: 'Samsun', type: 'ilce', lat: 41.5672, lng: 35.9058 },
  { id: 'samsun-carsamba', name: 'Çarşamba', province: 'Samsun', type: 'ilce', lat: 41.1983, lng: 36.7236 },
  { id: 'samsun-havza', name: 'Havza', province: 'Samsun', type: 'ilce', lat: 40.9672, lng: 35.6650 },
  { id: 'samsun-vezirkopru', name: 'Vezirköprü', province: 'Samsun', type: 'ilce', lat: 41.1433, lng: 35.4597 },
  // SİİRT
  { id: 'siirt', name: 'Siirt', province: 'Siirt', type: 'il', lat: 37.9333, lng: 41.9500 },
  { id: 'siirt-kurtalan', name: 'Kurtalan', province: 'Siirt', type: 'ilce', lat: 37.9283, lng: 41.7011 },
  { id: 'siirt-eruh', name: 'Eruh', province: 'Siirt', type: 'ilce', lat: 37.7614, lng: 42.1608 },
  // SİNOP
  { id: 'sinop', name: 'Sinop', province: 'Sinop', type: 'il', lat: 42.0231, lng: 35.1531 },
  { id: 'sinop-boyabat', name: 'Boyabat', province: 'Sinop', type: 'ilce', lat: 41.4658, lng: 34.7772 },
  { id: 'sinop-gerze', name: 'Gerze', province: 'Sinop', type: 'ilce', lat: 41.8033, lng: 35.1906 },
  { id: 'sinop-ayancik', name: 'Ayancık', province: 'Sinop', type: 'ilce', lat: 41.9497, lng: 34.5869 },
  // SİVAS
  { id: 'sivas', name: 'Sivas', province: 'Sivas', type: 'il', lat: 39.7477, lng: 37.0179 },
  { id: 'sivas-zara', name: 'Zara', province: 'Sivas', type: 'ilce', lat: 39.8967, lng: 37.7433 },
  { id: 'sivas-suşehri', name: 'Suşehri', province: 'Sivas', type: 'ilce', lat: 40.1667, lng: 38.0933 },
  { id: 'sivas-sarkisla', name: 'Şarkışla', province: 'Sivas', type: 'ilce', lat: 39.3389, lng: 36.9461 },
  { id: 'sivas-gemerek', name: 'Gemerek', province: 'Sivas', type: 'ilce', lat: 39.1833, lng: 36.0694 },
  { id: 'sivas-koyulhisar', name: 'Koyulhisar', province: 'Sivas', type: 'ilce', lat: 40.3119, lng: 37.8264 },
  // ŞANLIURFA
  { id: 'sanliurfa', name: 'Şanlıurfa', province: 'Şanlıurfa', type: 'il', lat: 37.1591, lng: 38.7969 },
  { id: 'sanliurfa-karakoprü', name: 'Karaköprü', province: 'Şanlıurfa', type: 'ilce', lat: 37.1958, lng: 38.7639 },
  { id: 'sanliurfa-haliliye', name: 'Haliliye', province: 'Şanlıurfa', type: 'ilce', lat: 37.1581, lng: 38.7853 },
  { id: 'sanliurfa-eyyubiye', name: 'Eyyübiye', province: 'Şanlıurfa', type: 'ilce', lat: 37.1481, lng: 38.8011 },
  // ŞIRNAK
  { id: 'sirnak', name: 'Şırnak', province: 'Şırnak', type: 'il', lat: 37.5164, lng: 42.4611 },
  { id: 'sirnak-cizre', name: 'Cizre', province: 'Şırnak', type: 'ilce', lat: 37.3261, lng: 42.1922 },
  { id: 'sirnak-silopi', name: 'Silopi', province: 'Şırnak', type: 'ilce', lat: 37.2519, lng: 42.4683 },
  { id: 'sirnak-idil', name: 'İdil', province: 'Şırnak', type: 'ilce', lat: 37.3394, lng: 41.8864 },
  { id: 'sirnak-beytussebap', name: 'Beytüşşebap', province: 'Şırnak', type: 'ilce', lat: 37.5831, lng: 42.9344 },
  // TEKİRDAĞ
  { id: 'tekirdag', name: 'Tekirdağ', province: 'Tekirdağ', type: 'il', lat: 40.9781, lng: 27.5115 },
  { id: 'tekirdag-suleymanpasa', name: 'Süleymanpaşa', province: 'Tekirdağ', type: 'ilce', lat: 40.9786, lng: 27.5108 },
  { id: 'tekirdag-cerkezkoy', name: 'Çerkezköy', province: 'Tekirdağ', type: 'ilce', lat: 41.2886, lng: 27.9981 },
  { id: 'tekirdag-corlu', name: 'Çorlu', province: 'Tekirdağ', type: 'ilce', lat: 41.1594, lng: 27.7972 },
  { id: 'tekirdag-malkara', name: 'Malkara', province: 'Tekirdağ', type: 'ilce', lat: 41.2939, lng: 26.9039 },
  { id: 'tekirdag-sarkoy', name: 'Şarköy', province: 'Tekirdağ', type: 'ilce', lat: 40.6153, lng: 27.1058 },
  { id: 'tekirdag-muratlı', name: 'Muratlı', province: 'Tekirdağ', type: 'ilce', lat: 41.1678, lng: 27.4983 },
  // TOKAT
  { id: 'tokat', name: 'Tokat', province: 'Tokat', type: 'il', lat: 40.3167, lng: 36.5500 },
  { id: 'tokat-erbaa', name: 'Erbaa', province: 'Tokat', type: 'ilce', lat: 40.6700, lng: 36.5594 },
  { id: 'tokat-niksar', name: 'Niksar', province: 'Tokat', type: 'ilce', lat: 40.5956, lng: 36.9642 },
  { id: 'tokat-zile', name: 'Zile', province: 'Tokat', type: 'ilce', lat: 40.3011, lng: 35.8861 },
  { id: 'tokat-turhal', name: 'Turhal', province: 'Tokat', type: 'ilce', lat: 40.3869, lng: 36.0819 },
  { id: 'tokat-resadiye', name: 'Reşadiye', province: 'Tokat', type: 'ilce', lat: 40.3822, lng: 37.3281 },
  // TRABZON
  { id: 'trabzon', name: 'Trabzon', province: 'Trabzon', type: 'il', lat: 41.0015, lng: 39.7178 },
  { id: 'trabzon-ortahisar', name: 'Ortahisar', province: 'Trabzon', type: 'ilce', lat: 41.0028, lng: 39.7231 },
  { id: 'trabzon-akcaabat', name: 'Akçaabat', province: 'Trabzon', type: 'ilce', lat: 40.9922, lng: 39.5722 },
  { id: 'trabzon-arakli', name: 'Araklı', province: 'Trabzon', type: 'ilce', lat: 40.9361, lng: 40.0442 },
  { id: 'trabzon-of', name: 'Of', province: 'Trabzon', type: 'ilce', lat: 40.9558, lng: 40.2581 },
  { id: 'trabzon-surmene', name: 'Sürmene', province: 'Trabzon', type: 'ilce', lat: 40.9097, lng: 40.1133 },
  { id: 'trabzon-macka', name: 'Maçka', province: 'Trabzon', type: 'ilce', lat: 40.8192, lng: 39.6133 },
  { id: 'trabzon-yomra', name: 'Yomra', province: 'Trabzon', type: 'ilce', lat: 40.9750, lng: 39.8533 },
  // TUNCELİ
  { id: 'tunceli', name: 'Tunceli', province: 'Tunceli', type: 'il', lat: 39.1079, lng: 39.5481 },
  { id: 'tunceli-pertek', name: 'Pertek', province: 'Tunceli', type: 'ilce', lat: 38.8578, lng: 39.3183 },
  { id: 'tunceli-mazgirt', name: 'Mazgirt', province: 'Tunceli', type: 'ilce', lat: 38.9581, lng: 39.5825 },
  { id: 'tunceli-hozat', name: 'Hozat', province: 'Tunceli', type: 'ilce', lat: 39.1175, lng: 38.9833 },
  // UŞAK
  { id: 'usak', name: 'Uşak', province: 'Uşak', type: 'il', lat: 38.6823, lng: 29.4082 },
  { id: 'usak-banaz', name: 'Banaz', province: 'Uşak', type: 'ilce', lat: 38.7278, lng: 29.7464 },
  { id: 'usak-esme', name: 'Eşme', province: 'Uşak', type: 'ilce', lat: 38.3950, lng: 28.9711 },
  { id: 'usak-sivaslı', name: 'Sivaslı', province: 'Uşak', type: 'ilce', lat: 38.5022, lng: 29.6867 },
  // VAN
  { id: 'van', name: 'Van', province: 'Van', type: 'il', lat: 38.4942, lng: 43.3800 },
  { id: 'van-ipekyolu', name: 'İpekyolu', province: 'Van', type: 'ilce', lat: 38.4831, lng: 43.3900 },
  { id: 'van-tusba', name: 'Tuşba', province: 'Van', type: 'ilce', lat: 38.5083, lng: 43.4250 },
  { id: 'van-ercis', name: 'Erciş', province: 'Van', type: 'ilce', lat: 39.0258, lng: 43.3525 },
  { id: 'van-gevas', name: 'Gevaş', province: 'Van', type: 'ilce', lat: 38.2911, lng: 43.1028 },
  { id: 'van-gurpinar', name: 'Gürpınar', province: 'Van', type: 'ilce', lat: 38.3217, lng: 43.4125 },
  { id: 'van-baskale', name: 'Başkale', province: 'Van', type: 'ilce', lat: 38.0439, lng: 44.0122 },
  { id: 'van-caldiran', name: 'Çaldıran', province: 'Van', type: 'ilce', lat: 39.1333, lng: 43.9167 },
  // YALOVA
  { id: 'yalova', name: 'Yalova', province: 'Yalova', type: 'il', lat: 40.6500, lng: 29.2667 },
  { id: 'yalova-altinova', name: 'Altınova', province: 'Yalova', type: 'ilce', lat: 40.6978, lng: 29.5133 },
  { id: 'yalova-cinarcik', name: 'Çınarcık', province: 'Yalova', type: 'ilce', lat: 40.6392, lng: 29.1197 },
  { id: 'yalova-termal', name: 'Termal', province: 'Yalova', type: 'ilce', lat: 40.5994, lng: 29.1783 },
  // YOZGAT
  { id: 'yozgat', name: 'Yozgat', province: 'Yozgat', type: 'il', lat: 39.8181, lng: 34.8147 },
  { id: 'yozgat-sorgun', name: 'Sorgun', province: 'Yozgat', type: 'ilce', lat: 39.8097, lng: 35.1833 },
  { id: 'yozgat-bogazliyan', name: 'Boğazlıyan', province: 'Yozgat', type: 'ilce', lat: 39.1969, lng: 35.2478 },
  { id: 'yozgat-yerköy', name: 'Yerköy', province: 'Yozgat', type: 'ilce', lat: 39.6408, lng: 34.4717 },
  { id: 'yozgat-akdagmadeni', name: 'Akdağmadeni', province: 'Yozgat', type: 'ilce', lat: 39.6611, lng: 35.8819 },
  // ZONGULDAK
  { id: 'zonguldak', name: 'Zonguldak', province: 'Zonguldak', type: 'il', lat: 41.4564, lng: 31.7987 },
  { id: 'zonguldak-kdz-eregli', name: 'Kdz. Ereğli', province: 'Zonguldak', type: 'ilce', lat: 41.2772, lng: 31.4239 },
  { id: 'zonguldak-caycuma', name: 'Çaycuma', province: 'Zonguldak', type: 'ilce', lat: 41.4236, lng: 32.0819 },
  { id: 'zonguldak-devrek', name: 'Devrek', province: 'Zonguldak', type: 'ilce', lat: 41.2242, lng: 31.9611 },
  { id: 'zonguldak-alaplı', name: 'Alaplı', province: 'Zonguldak', type: 'ilce', lat: 41.1858, lng: 31.2156 },
  // ARDAHAN (plate 75 — eksik olduğu için eklendi)
  { id: 'ardahan', name: 'Ardahan', province: 'Ardahan', type: 'il', lat: 41.1108, lng: 42.7022 },
  { id: 'ardahan-merkez', name: 'Merkez', province: 'Ardahan', type: 'ilce', lat: 41.1108, lng: 42.7022 },
  { id: 'ardahan-cildir', name: 'Çıldır', province: 'Ardahan', type: 'ilce', lat: 41.1358, lng: 43.1283 },
  { id: 'ardahan-damal', name: 'Damal', province: 'Ardahan', type: 'ilce', lat: 41.0667, lng: 42.7167 },
  { id: 'ardahan-gole', name: 'Göle', province: 'Ardahan', type: 'ilce', lat: 40.7917, lng: 42.6083 },
  { id: 'ardahan-hanak', name: 'Hanak', province: 'Ardahan', type: 'ilce', lat: 41.0833, lng: 42.5167 },
  { id: 'ardahan-posof', name: 'Posof', province: 'Ardahan', type: 'ilce', lat: 41.5083, lng: 42.7083 },
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

  return sorted.slice(0, 10);
}
