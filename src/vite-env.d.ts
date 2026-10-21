/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del backend si está en otro dominio (en desarrollo se usa el proxy /api). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
