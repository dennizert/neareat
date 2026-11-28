# Eatlas web paneli (`/panel`)

Vite + React + TypeScript SPA (ADR-001 #1-#3). Express aynı origin'den `/panel/*` altında servis eder.

```bash
npm ci
npm run dev        # http://localhost:5173/panel/ — /api ve /odeme → localhost:3000 proxy
npm run lint       # ESLint (CI kapısı)
npm run typecheck  # tsc --noEmit
npm test           # Vitest (jsdom)
npm run build      # → web/dist (varlık yolları /panel/ ile başlar)
```

Yerel geliştirmede backend `PUBLIC_WEB_ORIGIN=http://localhost:5173` ile çalışmalı (CSRF/Origin kontrolü).
Farklı backend adresi: `EATLAS_BACKEND_URL=http://localhost:4000 npm run dev`.

## Yapı

- `src/api/client.ts` — **tek sözleşme noktası**: axios (`withCredentials`), web oturumu uçları,
  `X-CSRF-Token`, 401 `WEB_SESSION_INVALID` → giriş, 403 `CSRF_INVALID`/`ORIGIN_INVALID` → oturumu
  yeniden çek + bir kez tekrar. Backend sözleşmesi değişirse yalnızca bu dosya güncellenir.
- `src/services/*` — mobil `src/services/*.ts` aynası (aynı ad ve parametreler).
- `src/styles/eatlas-web.css` — `planning/web-panel/tasarim/eatlas-web.css` kopyası (`.proto-bar` hariç).
- `src/content/legal.ts` — mobil `PrivacyPolicyModal` metinlerinin kopyası (V5).

## Build ortam değişkenleri

| Değişken | Varsayılan | Not |
|---|---|---|
| `VITE_GOOGLE_WEB_CLIENT_ID` | mobil/backend ile aynı web client ID | Google Identity Services |
| `VITE_PHOTO_UPLOAD_ENABLED` | kapalı | S2: depo CORS kuralı (`deploy/s3-cors.example.json`) uygulanınca `true` |
