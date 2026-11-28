'use strict';

/**
 * `npm run build` — web panelini (`web/`, Vite) kurar ve `web/dist`'e derler (#526).
 *
 * Railway (Nixpacks/Railpack) `build` betiğini deploy sırasında çalıştırır; Root Directory
 * `neareat-backend` olduğu için web paketi bu klasörün içinde durur (ADR-001 #2).
 *
 *  - `--include=dev`: üretim derlemesinde NODE_ENV=production olabilir; Vite/TypeScript
 *    devDependency'dir ve onlarsız derleme yapılamaz.
 *  - Herhangi bir adım başarısızsa çıkış kodu sıfırdan farklıdır → deploy durur (bozuk panel
 *    canlıya çıkmaz). Bunu merge ÖNCESİ CI `web-build` job'ı yakalar.
 *  - `web/package.json` yoksa (web paketi henüz eklenmemiş dal) derleme ATLANIR ve 0 döner:
 *    backend `web/dist` olmadan da açılır, `/panel` 503 verir.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WEB_DIR = path.join(__dirname, '..', 'web');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args) {
  console.log(`[build-web] npm ${args.join(' ')}`);
  const result = spawnSync(NPM, args, { cwd: WEB_DIR, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`[build-web] "npm ${args.join(' ')}" başarısız (çıkış kodu ${result.status}).`);
    process.exit(result.status || 1);
  }
}

function main() {
  if (!fs.existsSync(path.join(WEB_DIR, 'package.json'))) {
    console.warn('[build-web] web/package.json yok — web paneli derlemesi atlandı (/panel 503 döner).');
    return;
  }
  run(['ci', '--include=dev', '--no-audit', '--no-fund']);
  run(['run', 'build']);
  if (!fs.existsSync(path.join(WEB_DIR, 'dist', 'index.html'))) {
    console.error('[build-web] Derleme bitti ama web/dist/index.html üretilmedi.');
    process.exit(1);
  }
  console.log('[build-web] web/dist hazır.');
}

main();
