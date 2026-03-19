/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_API_PROXY_TARGET?: string
  readonly VITE_BYPASS_AUTH_GUARD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
