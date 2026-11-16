import { desktopCapturer, session } from 'electron'
import type { SourceInfo } from '@shared/types'

export interface CaptureRequest {
  sourceId: string
  audio: boolean
  systemPicker: boolean
}

let pending: CaptureRequest = { sourceId: '', audio: false, systemPicker: false }

export function registerCaptureHandler(): void {
  installHandler()
}

export function setCaptureRequest(request: CaptureRequest): void {
  pending = request
  installHandler()
}

function installHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
        .then((sources) => {
          const source =
            sources.find((item) => item.id === pending.sourceId) ??
            sources.find((item) => item.id.startsWith('screen:'))
          if (!source) {
            callback(null)
            return
          }
          callback({
            video: source,
            audio: request.audioRequested && pending.audio ? 'loopback' : undefined
          })
        })
        .catch(() => callback(null))
    },
    { useSystemPicker: pending.systemPicker && process.platform === 'darwin' }
  )
}

export async function listSources(): Promise<SourceInfo[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 360, height: 200 },
    fetchWindowIcons: true
  })
  return sources.map((source) => ({
    id: source.id,
    name: source.name || (source.id.startsWith('screen:') ? 'Screen' : 'Window'),
    displayId: source.display_id,
    kind: source.id.startsWith('screen:') ? 'screen' : 'window',
    thumbnail: source.thumbnail.isEmpty() ? '' : source.thumbnail.toDataURL(),
    appIcon: !source.appIcon || source.appIcon.isEmpty() ? null : source.appIcon.toDataURL()
  }))
}
