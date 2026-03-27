/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SSO_LOGIN_URL?: string
  readonly VITE_DEV_API_PROXY_TARGET?: string
  readonly VITE_WATERMARK_PRODUCT?: string
  readonly VITE_WATERMARK_OWNER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
