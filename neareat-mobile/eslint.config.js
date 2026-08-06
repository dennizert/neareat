'use strict';

/**
 * ESLint flat config — mobil (S20-3).
 *
 * `tsc --noEmit` zaten tip güvenliğini sağlıyor; bu config onu TAMAMLAR, tekrar
 * etmez: tipin göremediği hata sınıflarını (tanımsız değişken, ölü kod, yinelenen
 * anahtar, kullanılmayan import) yakalar.
 *
 * Tip-farkındalıklı (type-aware) kurallar KASITLI olarak kapalıdır — TypeScript
 * proje servisi gerektirir, 187 dosyada lint'i belirgin yavaşlatır ve `tsc` ile
 * büyük ölçüde örtüşür. Biçimlendirme Prettier'a bırakılır.
 */

const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'coverage/**',
      'babel.config.js',
      'jest.setup.js',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Node tarafında çalışan yapılandırma/eklenti dosyaları — CommonJS, Node global'leri.
    // Bunlar uygulama kodu değil; TS modül kuralları burada geçerli olmamalı.
    files: ['*.config.js', 'plugins/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021, __DEV__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Hook kuralları React'in en somut hata sınıfını yakalar: bayat closure ve
      // koşullu hook çağrısı. `rules-of-hooks` ihlali her zaman gerçek bir bug'dır
      // → error. `exhaustive-deps` isabetli ama yer yer kasıtlı olarak aşılır
      // (kodda zaten bir disable yorumu var) → uyarı olarak başlatılır.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native'de `require()` ZORUNLU: statik varlıklar
      // (`require('../assets/icon.png')`) import ile referanslanamaz ve native
      // modüller kasıtlı olarak tembel yüklenir (auth.ts MOCK_MODE, sentry.ts DSN
      // kapısı) — eager import native modülü gereksizce ayağa kaldırır.
      '@typescript-eslint/no-require-imports': 'off',

      // Boş `catch {}` bu kod tabanında bilinçli "best-effort, hatayı yut"
      // idiyomu (backend'deki `catch { /* ignore */ }` ile aynı).
      'no-empty': ['error', { allowEmptyCatch: true }],

      // TS zaten tipi kontrol ediyor; burada amaç ölü kod. Alt çizgiyle başlayan
      // adlar bilinçli "kullanmıyorum" işaretidir (destructuring'de alan atlama).
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'none',
        caughtErrors: 'none',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-unused-vars': 'off', // TS sürümü devralır

      // `any` bu kod tabanında hâlâ yer yer gerekli (native modül sınırları).
      // S14-M2 tiplemeyi kademeli iyileştiriyor — şimdilik uyarı, kapı değil.
      '@typescript-eslint/no-explicit-any': 'warn',

      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'no-throw-literal': 'error',
    },
  },

  {
    // Testler — Jest global'leri.
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
];
