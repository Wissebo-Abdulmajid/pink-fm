/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_PLAYBACK_TESTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
