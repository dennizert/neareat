import React from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialSection?: 'privacy' | 'kvkk';
}

export default function PrivacyPolicyModal({ visible, onClose, initialSection = 'privacy' }: Props) {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const scrollRef = React.useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = React.useState<'privacy' | 'kvkk'>(initialSection);

  React.useEffect(() => {
    if (visible) {
      setActiveTab(initialSection);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [visible, initialSection]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Yasal Metinler</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
            onPress={() => { setActiveTab('privacy'); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
          >
            <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
              Gizlilik Politikası
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'kvkk' && styles.tabActive]}
            onPress={() => { setActiveTab('kvkk'); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
          >
            <Text style={[styles.tabText, activeTab === 'kvkk' && styles.tabTextActive]}>
              KVKK Aydınlatma
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
          {activeTab === 'privacy' ? <PrivacyPolicyContent styles={styles} /> : <KVKKContent styles={styles} />}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SectionTitle({ text, styles }: { text: string; styles: ReturnType<typeof makeStyles> }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function Body({ text, styles }: { text: string; styles: ReturnType<typeof makeStyles> }) {
  return <Text style={styles.body}>{text}</Text>;
}

function BulletItem({ text, styles }: { text: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function PrivacyPolicyContent({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  return (
    <View>
      <Text style={styles.docTitle}>Gizlilik Politikası</Text>
      <Text style={styles.docDate}>Son güncelleme: Mayıs 2026</Text>

      <Body styles={styles} text={
        'NearEat ("Uygulama", "biz" veya "platform"), kullanıcılarının gizliliğine saygı duymayı ve kişisel verilerini korumayı temel prensip olarak benimsemektedir. Bu Gizlilik Politikası, NearEat mobil uygulamasını kullandığınızda hangi bilgilerin toplandığını, nasıl kullanıldığını ve korunduğunu açıklamaktadır.'
      } />

      <SectionTitle styles={styles} text="1. Toplanan Bilgiler" />
      <Body styles={styles} text="Hizmetimizi sunabilmek için aşağıdaki kişisel veriler toplanmaktadır:" />
      <BulletItem styles={styles} text="Ad, soyad ve kullanıcı adı" />
      <BulletItem styles={styles} text="E-posta adresi" />
      <BulletItem styles={styles} text="Profil fotoğrafı (isteğe bağlı)" />
      <BulletItem styles={styles} text="Konum bilgisi (yakın restoranları listelemek için)" />
      <BulletItem styles={styles} text="Cihaz bilgileri ve push bildirim token'ı (FCM)" />
      <BulletItem styles={styles} text="Uygulama içi aktiviteler: yorum, puan, öneri, favori, rezervasyon" />
      <BulletItem styles={styles} text="Mesajlaşma içerikleri (yalnızca kullanıcılar arasında)" />
      <BulletItem styles={styles} text="Abonelik ve ödeme durumu (ödeme bilgileri İyzico tarafından işlenir, NearEat'te saklanmaz)" />

      <SectionTitle styles={styles} text="2. Bilgilerin Kullanım Amaçları" />
      <BulletItem styles={styles} text="Konum bazlı restoran keşfi ve kişiselleştirilmiş öneriler sunmak" />
      <BulletItem styles={styles} text="Kullanıcı hesabı oluşturmak ve kimlik doğrulamak" />
      <BulletItem styles={styles} text="Sosyal özellikler (arkadaş sistemi, öneri paylaşımı) sunmak" />
      <BulletItem styles={styles} text="Rezervasyon yönetimi ve hatırlatma bildirimleri göndermek" />
      <BulletItem styles={styles} text="Platform güvenliğini sağlamak ve kötüye kullanımı önlemek" />
      <BulletItem styles={styles} text="Hizmet kalitesini iyileştirmek ve analiz yapmak" />
      <BulletItem styles={styles} text="Yasal yükümlülüklerimizi yerine getirmek" />

      <SectionTitle styles={styles} text="3. Bilgilerin Paylaşımı" />
      <Body styles={styles} text="Kişisel verileriniz; açık rızanız olmaksızın üçüncü taraflarla ticari amaçla paylaşılmaz. Aşağıdaki hizmet sağlayıcılarla yalnızca hizmetin sunulması amacıyla çalışılmaktadır:" />
      <BulletItem styles={styles} text="Google Firebase — kimlik doğrulama ve push bildirimleri" />
      <BulletItem styles={styles} text="Google Places API — restoran verileri" />
      <BulletItem styles={styles} text="İyzico — ödeme altyapısı (kart bilgileri NearEat'e iletilmez)" />
      <BulletItem styles={styles} text="Railway / PostgreSQL — güvenli veri depolama altyapısı" />
      <Body styles={styles} text="\nYasal zorunluluk halinde ilgili kamu kurumlarıyla paylaşım yapılabilir." />

      <SectionTitle styles={styles} text="4. Veri Güvenliği" />
      <Body styles={styles} text="Verileriniz endüstri standardı güvenlik önlemleriyle korunmaktadır. Şifreleriniz bcrypt ile şifrelenerek saklanır; kimlik doğrulama işlemleri JWT ve Firebase Authentication altyapısı üzerinden gerçekleştirilir. Mobil cihazınızdaki oturum bilgileri, işletim sisteminin güvenli depolama alanında (Android Keystore / iOS Keychain) tutulmaktadır." />

      <SectionTitle styles={styles} text="5. Konum Verisi" />
      <Body styles={styles} text="Konum bilgisi yalnızca uygulama ön plandayken ve yakın restoran listelemek amacıyla anlık olarak kullanılmaktadır. Konum geçmişi saklanmamakta, üçüncü taraflarla paylaşılmamaktadır. Konum iznini istediğiniz zaman cihaz ayarlarından kaldırabilirsiniz." />

      <SectionTitle styles={styles} text="6. Veri Saklama Süresi" />
      <Body styles={styles} text="Kişisel verileriniz, hesabınız aktif olduğu sürece veya yasal saklama yükümlülükleri gerektirdiği süre boyunca saklanmaktadır. Hesabınızı silmeniz durumunda kişisel verileriniz otomatik olarak silinir; yasal zorunluluk içeren veriler ilgili süre sonunda imha edilir." />

      <SectionTitle styles={styles} text="7. Haklarınız" />
      <BulletItem styles={styles} text="Kişisel verilerinize erişim talep etme" />
      <BulletItem styles={styles} text="Yanlış verilerin düzeltilmesini isteme" />
      <BulletItem styles={styles} text="Verilerinizin silinmesini talep etme (uygulama içi 'Hesabı Sil' seçeneği)" />
      <BulletItem styles={styles} text="Veri işlemeye itiraz etme" />
      <BulletItem styles={styles} text="Veri taşınabilirliği talep etme" />

      <SectionTitle styles={styles} text="8. Politika Değişiklikleri" />
      <Body styles={styles} text="Bu politika zaman zaman güncellenebilir. Önemli değişiklikler uygulama bildirimi veya e-posta yoluyla duyurulacaktır. Güncelleme sonrası uygulamayı kullanmaya devam etmeniz politikayı kabul ettiğiniz anlamına gelir." />

      <SectionTitle styles={styles} text="9. İletişim" />
      <Body styles={styles} text="Gizlilik politikamıza ilişkin soru ve talepleriniz için:\n\nNearEat\nE-posta: info@neareat.com\nKişisel Veri Sorumlusu: NearEat Yazılım ve Teknoloji Hizmetleri" />
    </View>
  );
}

function KVKKContent({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  return (
    <View>
      <Text style={styles.docTitle}>KVKK Aydınlatma Metni</Text>
      <Text style={styles.docDate}>6698 Sayılı Kişisel Verilerin Korunması Kanunu Kapsamında</Text>
      <Text style={styles.docDate}>Son güncelleme: Mayıs 2026</Text>

      <SectionTitle styles={styles} text="1. Veri Sorumlusu" />
      <Body styles={styles} text="6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca kişisel verilerinizin veri sorumlusu NearEat'tir. Veri sorumlusunun iletişim bilgileri: info@neareat.com" />

      <SectionTitle styles={styles} text="2. İşlenen Kişisel Veriler" />
      <Body styles={styles} text="NearEat tarafından aşağıdaki kategorilerde kişisel verileriniz işlenmektedir:" />

      <Text style={styles.subHeading}>Kimlik Verileri</Text>
      <BulletItem styles={styles} text="Ad, soyad, kullanıcı adı (görünen ad)" />

      <Text style={styles.subHeading}>İletişim Verileri</Text>
      <BulletItem styles={styles} text="E-posta adresi" />

      <Text style={styles.subHeading}>Lokasyon Verileri</Text>
      <BulletItem styles={styles} text="Anlık konum bilgisi (yalnızca uygulama ön plandayken)" />

      <Text style={styles.subHeading}>Görsel Veriler</Text>
      <BulletItem styles={styles} text="Profil fotoğrafı (isteğe bağlı olarak yüklenen)" />

      <Text style={styles.subHeading}>İşlem Güvenliği Verileri</Text>
      <BulletItem styles={styles} text="IP adresi, giriş logları, oturum bilgileri" />
      <BulletItem styles={styles} text="Cihaz tanımlayıcı ve push bildirim token'ı" />

      <Text style={styles.subHeading}>Kullanıcı İşlem Verileri</Text>
      <BulletItem styles={styles} text="Yorum, puan, öneri, favori, koleksiyon ve rezervasyon bilgileri" />
      <BulletItem styles={styles} text="Uygulama içi mesajlaşma içerikleri" />
      <BulletItem styles={styles} text="Abonelik durumu ve işlem geçmişi" />

      <SectionTitle styles={styles} text="3. Kişisel Verilerin İşlenme Amaçları" />
      <BulletItem styles={styles} text="Hizmet sözleşmesinin kurulması ve ifası (kullanıcı hesabı oluşturma, giriş, uygulama işlevleri)" />
      <BulletItem styles={styles} text="Konum bazlı restoran keşfi ve öneri hizmetlerinin sunulması" />
      <BulletItem styles={styles} text="Sosyal özelliklerin (arkadaşlık, öneri, mesajlaşma) işletilmesi" />
      <BulletItem styles={styles} text="Rezervasyon yönetimi ve bildirim gönderilmesi" />
      <BulletItem styles={styles} text="Abonelik ve ödeme işlemlerinin yürütülmesi" />
      <BulletItem styles={styles} text="Uygulama güvenliğinin sağlanması, kötüye kullanımın tespiti ve önlenmesi" />
      <BulletItem styles={styles} text="Yasal yükümlülüklerin yerine getirilmesi" />
      <BulletItem styles={styles} text="Şikâyet ve taleplerin yönetimi" />

      <SectionTitle styles={styles} text="4. Kişisel Verilerin Toplanma Yöntemi ve Hukuki Sebebi" />
      <Body styles={styles} text="Kişisel verileriniz; NearEat mobil uygulaması aracılığıyla elektronik ortamda, aşağıdaki hukuki sebepler kapsamında toplanmakta ve işlenmektedir:" />
      <BulletItem styles={styles} text="Sözleşmenin kurulması veya ifası (KVKK m. 5/2-c): Hesap oluşturma, giriş ve temel uygulama işlevleri" />
      <BulletItem styles={styles} text="Açık rıza (KVKK m. 5/1): Konum verisi, profil fotoğrafı, pazarlama iletişimleri" />
      <BulletItem styles={styles} text="Meşru menfaat (KVKK m. 5/2-f): Platform güvenliği, sahteciliğin önlenmesi" />
      <BulletItem styles={styles} text="Hukuki yükümlülük (KVKK m. 5/2-ç): Yasal saklama yükümlülükleri" />

      <SectionTitle styles={styles} text="5. Kişisel Verilerin Aktarıldığı Taraflar ve Aktarım Amacı" />
      <Body styles={styles} text="Kişisel verileriniz, yurt içi ve yurt dışındaki aşağıdaki taraflarla, hizmetin sunulması amacıyla ve KVKK'nın 8. ve 9. maddeleri kapsamında paylaşılabilmektedir:" />
      <BulletItem styles={styles} text="Google LLC (Firebase) — kimlik doğrulama ve push bildirim hizmetleri için yurt dışına aktarım" />
      <BulletItem styles={styles} text="Google LLC (Places API) — restoran verilerinin sağlanması için yurt dışına aktarım" />
      <BulletItem styles={styles} text="İyzico Ödeme Hizmetleri A.Ş. — abonelik ödeme işlemleri için yurt içi aktarım" />
      <BulletItem styles={styles} text="Railway Technologies, Inc. — güvenli veri depolama altyapısı için yurt dışına aktarım" />
      <BulletItem styles={styles} text="Yetkili kamu kurum ve kuruluşları — yasal yükümlülükler kapsamında" />

      <Body styles={styles} text="\nYurt dışına aktarımlar, KVKK'nın 9. maddesi uyarınca, aktarılacak ülkede yeterli korumanın bulunması veya veri sorumlularının yeterli korumayı yazılı olarak taahhüt etmesi koşullarından birine dayanmaktadır." />

      <SectionTitle styles={styles} text="6. Veri Saklama Süreleri" />
      <BulletItem styles={styles} text="Hesap verileri: Hesabın silinmesine kadar" />
      <BulletItem styles={styles} text="İşlem ve log kayıtları: 2 yıl (yasal yükümlülük)" />
      <BulletItem styles={styles} text="Ödeme işlem kayıtları: 10 yıl (Türk Ticaret Kanunu gereği)" />
      <BulletItem styles={styles} text="Yasal süre sona erdiğinde veriler imha edilir." />

      <SectionTitle styles={styles} text="7. KVKK Madde 11 Kapsamında Haklarınız" />
      <Body styles={styles} text="KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:" />
      <BulletItem styles={styles} text="Kişisel verilerinizin işlenip işlenmediğini öğrenme" />
      <BulletItem styles={styles} text="İşlenmişse buna ilişkin bilgi talep etme" />
      <BulletItem styles={styles} text="Verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme" />
      <BulletItem styles={styles} text="Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri öğrenme" />
      <BulletItem styles={styles} text="Eksik veya yanlış işlenmişse düzeltilmesini isteme" />
      <BulletItem styles={styles} text="Verilerinizin silinmesini veya yok edilmesini isteme" />
      <BulletItem styles={styles} text="Düzeltme/silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme" />
      <BulletItem styles={styles} text="İşlenen verilerin münhasıran otomatik sistemler aracılığıyla analiz edilmesi suretiyle aleyhinize bir sonuç ortaya çıkması durumunda buna itiraz etme" />
      <BulletItem styles={styles} text="Kanuna aykırı işleme nedeniyle uğradığınız zararın giderilmesini talep etme" />

      <SectionTitle styles={styles} text="8. Başvuru Yolu" />
      <Body styles={styles} text="Yukarıda belirtilen haklarınıza ilişkin başvurularınızı; kimliğinizi doğrulayan bilgilerle birlikte aşağıdaki kanala iletebilirsiniz:" />
      <Body styles={styles} text="\nE-posta: info@neareat.com\nKonu: KVKK Başvurusu\n\nBaşvurularınız, talebin niteliğine göre en geç 30 (otuz) gün içinde ücretsiz olarak sonuçlandırılacaktır. Talebin ayrıca bir maliyet gerektirmesi durumunda Kişisel Verileri Koruma Kurulu tarafından belirlenen tarifedeki ücret alınabilir." />

      <Body styles={styles} text="\nAynı zamanda Kişisel Verileri Koruma Kurumu'na (www.kvkk.gov.tr) şikâyette bulunma hakkınız saklıdır." />
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.surface },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: C.separator,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
    closeBtn: { paddingHorizontal: 4, paddingVertical: 4 },
    closeBtnText: { fontSize: 16, color: C.primary, fontWeight: '600' },
    tabBar: {
      flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.separator,
      backgroundColor: C.surface,
    },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: C.primary },
    tabText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
    tabTextActive: { color: C.primary, fontWeight: '700' },
    scroll: { flex: 1 },
    content: { padding: 20 },
    docTitle: { fontSize: 22, fontWeight: '800', color: C.textPrimary, marginBottom: 4 },
    docDate: { fontSize: 12, color: C.textMuted, marginBottom: 20 },
    sectionTitle: {
      fontSize: 15, fontWeight: '700', color: C.textPrimary,
      marginTop: 24, marginBottom: 8, paddingBottom: 4,
      borderBottomWidth: 1, borderBottomColor: C.separator,
    },
    subHeading: { fontSize: 13, fontWeight: '700', color: C.textSecondary, marginTop: 12, marginBottom: 4 },
    body: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },
    bulletRow: { flexDirection: 'row', marginTop: 5, paddingRight: 8 },
    bullet: { fontSize: 13, color: C.textMuted, marginRight: 8, lineHeight: 20 },
    bulletText: { flex: 1, fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  });
}
