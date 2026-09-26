/**
 * Bağımlılık bütünlüğü — Faz 2 (SDK 53) sırasında yaşanan sessiz regresyondan doğdu.
 *
 * NE OLDU: SDK 52 → 53 geçişinde package-lock.json sıfırdan üretildi ve
 * `expo-file-system` ağaçtan düştü (node_modules'ta boş bir dizin kaldı), oysa
 * `expo@53` onu bağımlılık olarak bildiriyor.
 *
 * NEDEN KİMSE GÖRMEDİ: `expo-asset`in native tarafı `AppDirectories` arayüzünü
 * expo-file-system'den alır. Modül yokken `ExpoAsset.downloadAsync` reddediyor,
 * ama bu reddi yalnızca DEV modunda "Possible Unhandled Promise Rejection" olarak
 * loglanıyor — release build'de tamamen sessiz. Sonuç: `createIconSet` font
 * yüklenemediği için sonsuza dek boş `<Text />` döndürdü ve uygulamadaki TÜM
 * `@expo/vector-icons` ikonları görünmez oldu. 579 birim testin hepsi geçiyordu.
 *
 * BU TEST NE YAPAR: `expo`nun bildirdiği her bağımlılığın gerçekten çözülebildiğini
 * doğrular. Yükseltme sonrası eksik/yarım kurulumu ekrana bakmadan yakalar.
 */
import { createRequire } from 'module';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');
const requireFromProject = createRequire(path.join(projectRoot, 'package.json'));

// Çözümleme expo'NUN KENDİ bağlamından yapılır, kök dizinden değil. npm, sürüm
// çakışmalarında bir bağımlılığı `expo/node_modules/` altına yuvalayabiliyor
// (SDK 54'te @expo/cli ve @expo/metro-config'e bu oldu) — bu meşru bir kurulum,
// eksiklik değil. Kökten arayan bir denetim bunları yanlışlıkla hata sayardı.
const requireFromExpo = createRequire(require.resolve('expo/package.json'));

describe('bağımlılık bütünlüğü', () => {
  const expoPkg = requireFromProject('expo/package.json');
  const expoDeps = Object.keys(expoPkg.dependencies ?? {});

  it('expo paketi bağımlılık bildiriyor (test kendini doğruluyor)', () => {
    expect(expoDeps.length).toBeGreaterThan(5);
  });

  it.each(expoDeps)('expo→%s çözülebiliyor', (dep) => {
    expect(() => requireFromExpo.resolve(`${dep}/package.json`)).not.toThrow();
  });

  // babel.config.js bu preset'i KÖK bağlamdan çözmek zorunda. SDK 54'te
  // expo/node_modules altına yuvalandı ve tüm Jest paketi "Cannot find module
  // 'babel-preset-expo'" ile çöktü — bu yüzden açık devDependency yapıldı.
  it('babel-preset-expo kök bağlamdan çözülebiliyor (babel.config.js buna muhtaç)', () => {
    expect(() => requireFromProject.resolve('babel-preset-expo/package.json')).not.toThrow();
  });

  // Bu üçü olmadan ikonlar ve paketlenmiş asset'ler sessizce kaybolur.
  it.each(['expo-file-system', 'expo-asset', 'expo-font'])(
    '%s kurulu ve sürümü okunabiliyor',
    (dep) => {
      const pkg = requireFromProject(`${dep}/package.json`);
      expect(typeof pkg.version).toBe('string');
      expect(pkg.version).not.toHaveLength(0);
    },
  );
});
