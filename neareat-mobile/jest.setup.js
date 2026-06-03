// expo/fetch (WinterCG) native modül (ExpoFetchModule) gerektirir; Jest/node ortamında
// yok. Servis testleri zaten servis fonksiyonlarını mock'lar — fetch hiç çağrılmaz,
// yalnızca import'un çökmemesi için global stub veriyoruz.
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

// AsyncStorage native modülü Jest'te yok; paketin sağladığı resmi mock'u kullan.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// @expo/vector-icons Jest'te font yüklemeye çalışır (loadedNativeFonts hatası).
// Her ikon ailesini (Ionicons, Feather...) prop'ları ileten basit bir View'a indir.
// Proxy + cache: aynı aile her erişimde AYNI bileşeni döndürür (UNSAFE_getByType eşleşsin).
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const cache = {};
  return new Proxy(
    {},
    {
      get: (_t, name) => {
        if (typeof name !== 'string' || name === '__esModule') return undefined;
        if (!cache[name]) {
          const Icon = (props) => React.createElement(View, props);
          Icon.displayName = name;
          cache[name] = Icon;
        }
        return cache[name];
      },
    },
  );
});
