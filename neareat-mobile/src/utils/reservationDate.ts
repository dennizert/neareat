/**
 * Rezervasyon düzenleme — başlangıç tarihi kararı (NEW-UI01, issue #457).
 *
 * Saf fonksiyon: ekran ve tarih kütüphanesinden bağımsız, doğrudan test edilir.
 *
 * NEDEN AYRI: bu karar yanlış olduğunda hata VERMEZ — kullanıcının dokunmadığı bir
 * alanı sessizce değiştirir. Eski hâli `days.includes(res.date) ? res.date : days[0]`
 * idi; pencereye sığmayan tarih BUGÜNE düşüyor ve kullanıcı yalnızca kişi sayısını
 * değiştirip kaydettiğinde rezervasyonun tarihi de değişiyordu.
 */

export interface InitialDateChoice {
  /** Seçili gelecek tarih. Boş string = seçim yok, kullanıcı açıkça seçmeli. */
  selected: string;
  /** Seçiciye EK olarak eklenecek tarih (pencere dışı ama geçerli). Yoksa null. */
  extraOption: string | null;
  /** Mevcut tarih geçmişte mi — kullanıcıya açıklama gösterilmeli. */
  isPast: boolean;
}

/**
 * Düzenleme ekranı açılırken hangi tarihin seçili geleceğine karar verir.
 *
 * Tarihler `YYYY-MM-DD` biçiminde olduğu için sözlüksel karşılaştırma kronolojik
 * karşılaştırmaya denktir; Date nesnesi kurmaya (ve saat dilimi hatalarına) gerek yok.
 *
 * @param existing  Rezervasyonun mevcut tarihi
 * @param windowDays Seçicinin ürettiği günler (bugünden ileri, sıralı)
 * @param today     Bugünün tarihi — varsayılan olarak pencerenin ilk günü
 */
export function resolveInitialDate(
  existing: string,
  windowDays: string[],
  today: string = windowDays[0] ?? '',
): InitialDateChoice {
  // Tarih bilinmiyorsa seçim yapma; kullanıcı açıkça seçsin.
  if (!existing) return { selected: '', extraOption: null, isPast: false };

  // Olağan durum: tarih pencerede. Davranış değişmiyor.
  if (windowDays.includes(existing)) {
    return { selected: existing, extraOption: null, isPast: false };
  }

  // Pencere dışı ama GELECEKTE: tarih geçerli, kullanıcının verisi. Sessizce
  // değiştirmek yerine seçiciye ekleyip görünür kıl ve koru.
  if (existing > today) {
    return { selected: existing, extraOption: existing, isPast: false };
  }

  // GEÇMİŞ: backend zaten reddeder. Kullanıcı adına bir tarih UYDURMAK yerine
  // seçimi boş bırak ve durumu açıkça söyle — sessiz bir değişiklik, dürüst bir
  // hatadan kötüdür.
  return { selected: '', extraOption: null, isPast: true };
}
