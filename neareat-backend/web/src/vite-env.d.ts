/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string;
  readonly VITE_PHOTO_UPLOAD_ENABLED?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
