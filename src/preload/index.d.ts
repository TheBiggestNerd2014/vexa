import type { VexaApi } from '@shared/api'

declare global {
  interface Window {
    vexa: VexaApi
  }
}

export {}
