'use strict';

/**
 * E2E ("arayüzsüz uçtan uca") test yapılandırması — GERÇEK Postgres gerektirir.
 *
 * Mevcut `npm test` paketinden KASITLI olarak ayrıdır:
 *  - `npm test` mock'lu, altyapısız ve saniyeler sürer; her PR'da koşan hızlı kapıdır.
 *  - `npm run test:e2e` gerçek veritabanına karşı çalışır, kurulum ister ve yavaştır.
 *
 * İkisini tek pakete koymak hızlı kapıyı veritabanı bağımlılığına mahkûm ederdi.
 */

module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/e2e/**/*.e2e.js'],
  setupFiles: ['<rootDir>/tests/e2e/setup/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup/jestSetup.js'],
  globalSetup: '<rootDir>/tests/e2e/setup/globalSetup.js',
  // Testler aynı veritabanını paylaşıp aralarında TRUNCATE ettiği için PARALEL
  // ÇALIŞAMAZLAR — bir dosyanın truncate'i diğerinin verisini silerdi.
  maxWorkers: 1,
  testTimeout: 30000,
};
