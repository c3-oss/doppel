/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOPPEL_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
