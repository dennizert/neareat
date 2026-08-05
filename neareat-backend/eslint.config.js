'use strict';

/**
 * ESLint flat config — backend (S20-3).
 *
 * Kural seti KASITLI olarak dardır: amaç stil dayatmak değil, gerçek hata
 * sınıflarını (tanımsız değişken, ölü kod, yinelenen anahtar, yanlış async
 * kullanımı) PR açılır açılmaz yakalamaktır. Biçimlendirme Prettier'a bırakılır ve
 * CI'da zorunlu tutulmaz — bkz. package.json `format:check`.
 *
 * Kural eklemek kolay, çıkarmak sancılıdır: taban dar tutulup zamanla sıkılaştırılır.
 *
 * Bilinçli olarak AÇILMAYANLAR:
 * - `no-promise-executor-return`: `new Promise((r) => setTimeout(r, ms))` idiyomunu
 *   işaretliyor. Bu zararsız ve yaygın; kuralın yakaladığı gerçek hata (async
 *   executor) zaten `recommended` içindeki `no-async-promise-executor` ile yakalanıyor.
 * - `no-console`: loglama S21-2'de logger'a taşınacak; şimdi açmak gürültü üretir.
 */

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    // Üretilmiş/bağımlılık dosyaları lint edilmez.
    ignores: ['node_modules/**', 'coverage/**', 'prisma/migrations/**'],
  },

  js.configs.recommended,

  {
    // Uygulama kodu — CommonJS, Node ortamı.
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // Kullanılmayan değişkenler gerçek bir hata sinyalidir (silinmemiş kod,
      // yanlış isimlendirilmiş parametre). Express hata middleware'i imzası gereği
      // 4 parametre almak zorunda olduğundan kullanılmayan ARGÜMANLAR muaf tutulur.
      'no-unused-vars': ['error', {
        args: 'none',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
      }],

      // Aşağıdakiler `recommended` içinde yok ama gerçek hata yakalar:
      eqeqeq: ['error', 'smart'],          // == ile tip zorlaması kaynaklı sürprizler
      'no-var': 'error',                   // var hoisting kaynaklı kapsam hataları
      'no-return-await': 'error',          // gereksiz mikro-görev + yanıltıcı stack
      'no-throw-literal': 'error',         // Error olmayan throw → stack izi kaybı
      'no-unmodified-loop-condition': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn', // '${x}' düz string içinde — genelde hata
    },
  },

  {
    // Testler — Jest global'leri.
    files: ['tests/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },

  {
    // k6 yük testleri kendi runtime'ında çalışır (Node değil); import sözdizimi kullanır.
    files: ['load-tests/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node, __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' },
    },
  },
];
