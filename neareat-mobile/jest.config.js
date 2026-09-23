module.exports = {
  preset: 'jest-expo',
  // @testing-library/jest-native KALDIRILDI (kullanımdan kaldırıldı; matcher'ları
  // RNTL v12.4+'ta yerleşik). Kullandığımız tek matcher `toHaveProp` RNTL 14'te var.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|zustand)',
  ],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Varsayılan 5000ms, yavaş CI runner'larında ekran testlerinin soğuk-başlangıç
  // render'ı (+findBy polling) için yetersiz kalabiliyor; cömert bir global sınır.
  testTimeout: 20000,
};
