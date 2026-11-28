// Mobil `neareat-mobile/src/components/PrivacyPolicyModal.tsx` metinlerinin BİREBİR kopyası (V5).
// Betikle çıkarıldı; mobilde metin değişirse burası da güncellenmeli.
export type LegalBlock = { t: string; x: string };
export const PRIVACY_POLICY: LegalBlock[] = [
  {
    "t": "docTitle",
    "x": "Gizlilik Politikası"
  },
  {
    "t": "docDate",
    "x": "Son güncelleme: Mayıs 2026"
  },
  {
    "t": "p",
    "x": "Eatlas (\"Uygulama\", \"biz\" veya \"platform\"), kullanıcılarının gizliliğine saygı duymayı ve kişisel verilerini korumayı temel prensip olarak benimsemektedir. Bu Gizlilik Politikası, Eatlas mobil uygulamasını kullandığınızda hangi bilgilerin toplandığını, nasıl kullanıldığını ve korunduğunu açıklamaktadır."
  },
  {
    "t": "h",
    "x": "1. Toplanan Bilgiler"
  },
  {
    "t": "p",
    "x": "Hizmetimizi sunabilmek için aşağıdaki kişisel veriler toplanmaktadır:"
  },
  {
    "t": "li",
    "x": "Ad, soyad ve kullanıcı adı"
  },
  {
    "t": "li",
    "x": "E-posta adresi"
  },
  {
    "t": "li",
    "x": "Profil fotoğrafı (isteğe bağlı)"
  },
  {
    "t": "li",
    "x": "Konum bilgisi (yakın restoranları listelemek için)"
  },
  {
    "t": "li",
    "x": "Cihaz bilgileri ve push bildirim token'ı (FCM)"
  },
  {
    "t": "li",
    "x": "Uygulama içi aktiviteler: yorum, puan, öneri, favori, rezervasyon"
  },
  {
    "t": "li",
    "x": "Mesajlaşma içerikleri (yalnızca kullanıcılar arasında)"
  },
  {
    "t": "li",
    "x": "Abonelik ve ödeme durumu (ödeme bilgileri İyzico tarafından işlenir, Eatlas'ta saklanmaz)"
  },
  {
    "t": "h",
    "x": "2. Bilgilerin Kullanım Amaçları"
  },
  {
    "t": "li",
    "x": "Konum bazlı restoran keşfi ve kişiselleştirilmiş öneriler sunmak"
  },
  {
    "t": "li",
    "x": "Kullanıcı hesabı oluşturmak ve kimlik doğrulamak"
  },
  {
    "t": "li",
    "x": "Sosyal özellikler (arkadaş sistemi, öneri paylaşımı) sunmak"
  },
  {
    "t": "li",
    "x": "Rezervasyon yönetimi ve hatırlatma bildirimleri göndermek"
  },
  {
    "t": "li",
    "x": "Platform güvenliğini sağlamak ve kötüye kullanımı önlemek"
  },
  {
    "t": "li",
    "x": "Hizmet kalitesini iyileştirmek ve analiz yapmak"
  },
  {
    "t": "li",
    "x": "Yasal yükümlülüklerimizi yerine getirmek"
  },
  {
    "t": "h",
    "x": "3. Bilgilerin Paylaşımı"
  },
  {
    "t": "p",
    "x": "Kişisel verileriniz; açık rızanız olmaksızın üçüncü taraflarla ticari amaçla paylaşılmaz. Aşağıdaki hizmet sağlayıcılarla yalnızca hizmetin sunulması amacıyla çalışılmaktadır:"
  },
  {
    "t": "li",
    "x": "Google Firebase — kimlik doğrulama ve push bildirimleri"
  },
  {
    "t": "li",
    "x": "Google Places API — restoran verileri"
  },
  {
    "t": "li",
    "x": "İyzico — ödeme altyapısı (kart bilgileri Eatlas'a iletilmez)"
  },
  {
    "t": "li",
    "x": "Railway / PostgreSQL — güvenli veri depolama altyapısı"
  },
  {
    "t": "p",
    "x": "Yasal zorunluluk halinde ilgili kamu kurumlarıyla paylaşım yapılabilir."
  },
  {
    "t": "h",
    "x": "4. Veri Güvenliği"
  },
  {
    "t": "p",
    "x": "Verileriniz endüstri standardı güvenlik önlemleriyle korunmaktadır. Şifreleriniz bcrypt ile şifrelenerek saklanır; kimlik doğrulama işlemleri JWT ve Firebase Authentication altyapısı üzerinden gerçekleştirilir. Mobil cihazınızdaki oturum bilgileri, işletim sisteminin güvenli depolama alanında (Android Keystore / iOS Keychain) tutulmaktadır."
  },
  {
    "t": "h",
    "x": "5. Konum Verisi"
  },
  {
    "t": "p",
    "x": "Konum bilgisi yalnızca uygulama ön plandayken ve yakın restoran listelemek amacıyla anlık olarak kullanılmaktadır. Konum geçmişi saklanmamakta, üçüncü taraflarla paylaşılmamaktadır. Konum iznini istediğiniz zaman cihaz ayarlarından kaldırabilirsiniz."
  },
  {
    "t": "h",
    "x": "6. Veri Saklama Süresi"
  },
  {
    "t": "p",
    "x": "Kişisel verileriniz, hesabınız aktif olduğu sürece veya yasal saklama yükümlülükleri gerektirdiği süre boyunca saklanmaktadır. Hesabınızı silmeniz durumunda kişisel verileriniz otomatik olarak silinir; yasal zorunluluk içeren veriler ilgili süre sonunda imha edilir."
  },
  {
    "t": "h",
    "x": "7. Haklarınız"
  },
  {
    "t": "li",
    "x": "Kişisel verilerinize erişim talep etme"
  },
  {
    "t": "li",
    "x": "Yanlış verilerin düzeltilmesini isteme"
  },
  {
    "t": "li",
    "x": "Verilerinizin silinmesini talep etme (uygulama içi 'Hesabı Sil' seçeneği)"
  },
  {
    "t": "li",
    "x": "Veri işlemeye itiraz etme"
  },
  {
    "t": "li",
    "x": "Veri taşınabilirliği talep etme"
  },
  {
    "t": "h",
    "x": "8. Politika Değişiklikleri"
  },
  {
    "t": "p",
    "x": "Bu politika zaman zaman güncellenebilir. Önemli değişiklikler uygulama bildirimi veya e-posta yoluyla duyurulacaktır. Güncelleme sonrası uygulamayı kullanmaya devam etmeniz politikayı kabul ettiğiniz anlamına gelir."
  },
  {
    "t": "h",
    "x": "9. İletişim"
  },
  {
    "t": "p",
    "x": "Gizlilik politikamıza ilişkin soru ve talepleriniz için:\n\nNearEat\nE-posta: info@eatlas.app\nKişisel Veri Sorumlusu: Eatlas Yazılım ve Teknoloji Hizmetleri"
  }
];
export const KVKK_TEXT: LegalBlock[] = [
  {
    "t": "docTitle",
    "x": "KVKK Aydınlatma Metni"
  },
  {
    "t": "docDate",
    "x": "6698 Sayılı Kişisel Verilerin Korunması Kanunu Kapsamında"
  },
  {
    "t": "docDate",
    "x": "Son güncelleme: Mayıs 2026"
  },
  {
    "t": "h",
    "x": "1. Veri Sorumlusu"
  },
  {
    "t": "p",
    "x": "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca kişisel verilerinizin veri sorumlusu Eatlas'tır. Veri sorumlusunun iletişim bilgileri: info@eatlas.app"
  },
  {
    "t": "h",
    "x": "2. İşlenen Kişisel Veriler"
  },
  {
    "t": "p",
    "x": "Eatlas tarafından aşağıdaki kategorilerde kişisel verileriniz işlenmektedir:"
  },
  {
    "t": "subHeading",
    "x": "Kimlik Verileri"
  },
  {
    "t": "li",
    "x": "Ad, soyad, kullanıcı adı (görünen ad)"
  },
  {
    "t": "subHeading",
    "x": "İletişim Verileri"
  },
  {
    "t": "li",
    "x": "E-posta adresi"
  },
  {
    "t": "subHeading",
    "x": "Lokasyon Verileri"
  },
  {
    "t": "li",
    "x": "Anlık konum bilgisi (yalnızca uygulama ön plandayken)"
  },
  {
    "t": "subHeading",
    "x": "Görsel Veriler"
  },
  {
    "t": "li",
    "x": "Profil fotoğrafı (isteğe bağlı olarak yüklenen)"
  },
  {
    "t": "subHeading",
    "x": "İşlem Güvenliği Verileri"
  },
  {
    "t": "li",
    "x": "IP adresi, giriş logları, oturum bilgileri"
  },
  {
    "t": "li",
    "x": "Cihaz tanımlayıcı ve push bildirim token'ı"
  },
  {
    "t": "subHeading",
    "x": "Kullanıcı İşlem Verileri"
  },
  {
    "t": "li",
    "x": "Yorum, puan, öneri, favori, koleksiyon ve rezervasyon bilgileri"
  },
  {
    "t": "li",
    "x": "Uygulama içi mesajlaşma içerikleri"
  },
  {
    "t": "li",
    "x": "Abonelik durumu ve işlem geçmişi"
  },
  {
    "t": "h",
    "x": "3. Kişisel Verilerin İşlenme Amaçları"
  },
  {
    "t": "li",
    "x": "Hizmet sözleşmesinin kurulması ve ifası (kullanıcı hesabı oluşturma, giriş, uygulama işlevleri)"
  },
  {
    "t": "li",
    "x": "Konum bazlı restoran keşfi ve öneri hizmetlerinin sunulması"
  },
  {
    "t": "li",
    "x": "Sosyal özelliklerin (arkadaşlık, öneri, mesajlaşma) işletilmesi"
  },
  {
    "t": "li",
    "x": "Rezervasyon yönetimi ve bildirim gönderilmesi"
  },
  {
    "t": "li",
    "x": "Abonelik ve ödeme işlemlerinin yürütülmesi"
  },
  {
    "t": "li",
    "x": "Uygulama güvenliğinin sağlanması, kötüye kullanımın tespiti ve önlenmesi"
  },
  {
    "t": "li",
    "x": "Yasal yükümlülüklerin yerine getirilmesi"
  },
  {
    "t": "li",
    "x": "Şikâyet ve taleplerin yönetimi"
  },
  {
    "t": "h",
    "x": "4. Kişisel Verilerin Toplanma Yöntemi ve Hukuki Sebebi"
  },
  {
    "t": "p",
    "x": "Kişisel verileriniz; Eatlas mobil uygulaması aracılığıyla elektronik ortamda, aşağıdaki hukuki sebepler kapsamında toplanmakta ve işlenmektedir:"
  },
  {
    "t": "li",
    "x": "Sözleşmenin kurulması veya ifası (KVKK m. 5/2-c): Hesap oluşturma, giriş ve temel uygulama işlevleri"
  },
  {
    "t": "li",
    "x": "Açık rıza (KVKK m. 5/1): Konum verisi, profil fotoğrafı, pazarlama iletişimleri"
  },
  {
    "t": "li",
    "x": "Meşru menfaat (KVKK m. 5/2-f): Platform güvenliği, sahteciliğin önlenmesi"
  },
  {
    "t": "li",
    "x": "Hukuki yükümlülük (KVKK m. 5/2-ç): Yasal saklama yükümlülükleri"
  },
  {
    "t": "h",
    "x": "5. Kişisel Verilerin Aktarıldığı Taraflar ve Aktarım Amacı"
  },
  {
    "t": "p",
    "x": "Kişisel verileriniz, yurt içi ve yurt dışındaki aşağıdaki taraflarla, hizmetin sunulması amacıyla ve KVKK'nın 8. ve 9. maddeleri kapsamında paylaşılabilmektedir:"
  },
  {
    "t": "li",
    "x": "Google LLC (Firebase) — kimlik doğrulama ve push bildirim hizmetleri için yurt dışına aktarım"
  },
  {
    "t": "li",
    "x": "Google LLC (Places API) — restoran verilerinin sağlanması için yurt dışına aktarım"
  },
  {
    "t": "li",
    "x": "İyzico Ödeme Hizmetleri A.Ş. — abonelik ödeme işlemleri için yurt içi aktarım"
  },
  {
    "t": "li",
    "x": "Railway Technologies, Inc. — güvenli veri depolama altyapısı için yurt dışına aktarım"
  },
  {
    "t": "li",
    "x": "Yetkili kamu kurum ve kuruluşları — yasal yükümlülükler kapsamında"
  },
  {
    "t": "p",
    "x": "Yurt dışına aktarımlar, KVKK'nın 9. maddesi uyarınca, aktarılacak ülkede yeterli korumanın bulunması veya veri sorumlularının yeterli korumayı yazılı olarak taahhüt etmesi koşullarından birine dayanmaktadır."
  },
  {
    "t": "h",
    "x": "6. Veri Saklama Süreleri"
  },
  {
    "t": "li",
    "x": "Hesap verileri: Hesabın silinmesine kadar"
  },
  {
    "t": "li",
    "x": "İşlem ve log kayıtları: 2 yıl (yasal yükümlülük)"
  },
  {
    "t": "li",
    "x": "Ödeme işlem kayıtları: 10 yıl (Türk Ticaret Kanunu gereği)"
  },
  {
    "t": "li",
    "x": "Yasal süre sona erdiğinde veriler imha edilir."
  },
  {
    "t": "h",
    "x": "7. KVKK Madde 11 Kapsamında Haklarınız"
  },
  {
    "t": "p",
    "x": "KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:"
  },
  {
    "t": "li",
    "x": "Kişisel verilerinizin işlenip işlenmediğini öğrenme"
  },
  {
    "t": "li",
    "x": "İşlenmişse buna ilişkin bilgi talep etme"
  },
  {
    "t": "li",
    "x": "Verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme"
  },
  {
    "t": "li",
    "x": "Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri öğrenme"
  },
  {
    "t": "li",
    "x": "Eksik veya yanlış işlenmişse düzeltilmesini isteme"
  },
  {
    "t": "li",
    "x": "Verilerinizin silinmesini veya yok edilmesini isteme"
  },
  {
    "t": "li",
    "x": "Düzeltme/silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme"
  },
  {
    "t": "li",
    "x": "İşlenen verilerin münhasıran otomatik sistemler aracılığıyla analiz edilmesi suretiyle aleyhinize bir sonuç ortaya çıkması durumunda buna itiraz etme"
  },
  {
    "t": "li",
    "x": "Kanuna aykırı işleme nedeniyle uğradığınız zararın giderilmesini talep etme"
  },
  {
    "t": "h",
    "x": "8. Başvuru Yolu"
  },
  {
    "t": "p",
    "x": "Yukarıda belirtilen haklarınıza ilişkin başvurularınızı; kimliğinizi doğrulayan bilgilerle birlikte aşağıdaki kanala iletebilirsiniz:"
  },
  {
    "t": "p",
    "x": "E-posta: info@eatlas.app\nKonu: KVKK Başvurusu\n\nBaşvurularınız, talebin niteliğine göre en geç 30 (otuz) gün içinde ücretsiz olarak sonuçlandırılacaktır. Talebin ayrıca bir maliyet gerektirmesi durumunda Kişisel Verileri Koruma Kurulu tarafından belirlenen tarifedeki ücret alınabilir."
  },
  {
    "t": "p",
    "x": "Aynı zamanda Kişisel Verileri Koruma Kurumu'na (www.kvkk.gov.tr) şikâyette bulunma hakkınız saklıdır."
  }
];
