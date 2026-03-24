/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SSO_LOGIN_URL?: string
  readonly VITE_DEV_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
