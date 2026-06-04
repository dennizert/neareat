// expo/fetch (WinterCG) native modül (ExpoFetchModule) gerektirir; Jest/node ortamında
// yok. Servis testleri zaten servis fonksiyonlarını mock'lar — fetch hiç çağrılmaz,
// yalnızca import'un çökmemesi için global stub veriyoruz.
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

// AsyncStorage native modülü Jest'te yok; paketin sağladığı resmi mock'u kullan.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-haptics native modülü Jest'te yok; tüm fonksiyonları no-op'a indir.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// react-native-safe-area-context native context'i Jest'te yok; sıfır inset'le mock'la.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(inset),
    SafeAreaView: (props) => React.createElement(View, props, props.children),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { frame, insets: inset },
  };
});

// MaskedView native bileşeni Jest'te yok; maskeyi göz ardı edip içeriği render eden
// basit bir View'a indir (gradient logosu testlerde düz render olsun).
jest.mock('@react-native-masked-view/masked-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props) => React.createElement(View, props, props.children);
});

// expo-linear-gradient native modülü Jest'te yok; çocukları geçiren View'a indir.
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: (props) => React.createElement(View, props, props.children) };
});

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
