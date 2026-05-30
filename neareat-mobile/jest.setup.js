// expo/fetch (WinterCG) native modül (ExpoFetchModule) gerektirir; Jest/node ortamında
// yok. Servis testleri zaten servis fonksiyonlarını mock'lar — fetch hiç çağrılmaz,
// yalnızca import'un çökmemesi için global stub veriyoruz.
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

// AsyncStorage native modülü Jest'te yok; paketin sağladığı resmi mock'u kullan.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
