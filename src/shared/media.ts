import type { ContainerFormat, Quality, ResolutionPreset } from './types'

export function outputSize(
  srcW: number,
  srcH: number,
  preset: ResolutionPreset
): { width: number; height: number } {
  const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2)
  const width = Math.max(2, srcW || 1280)
  const height = Math.max(2, srcH || 720)
  const maxH = preset === '720p' ? 720 : preset === '1080p' ? 1080 : preset === '4k' ? 2160 : Infinity
  if (height <= maxH) return { width: even(width), height: even(height) }
  const scale = maxH / height
  return { width: even(width * scale), height: even(height * scale) }
}

export function videoBitrate(width: number, height: number, fps: number, quality: Quality): number {
  const perPixel = quality === 'small' ? 0.05 : quality === 'high' ? 0.16 : 0.09
  const bits = width * height * fps * perPixel
  return Math.round(Math.max(1_200_000, Math.min(bits, 80_000_000)))
}

function safeLabel(value: string): string {
  let out = ''
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code < 32 || '<>:"/\\|?*'.includes(char)) continue
    out += char
  }
  return out.trim()
}

export function renderFilename(
  template: string,
  extension: string,
  sourceName: string,
  now = new Date()
): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const source = safeLabel(sourceName) || 'screen'
  let name = (template || 'Vexa {date} {time}')
    .replaceAll('{date}', date)
    .replaceAll('{time}', time)
    .replaceAll('{source}', source)
  name = safeLabel(name).replace(/\.+$/g, '').trim()
  if (!name) name = `Vexa ${date} ${time}`
  const ext = extension.replace(/^\./, '') || 'webm'
  return `${name}.${ext}`
}

export function chooseMime(
  container: ContainerFormat,
  hasAudio: boolean,
  supported: (mime: string) => boolean
): { mime: string; extension: 'webm' | 'mp4' } {
  const mp4 = hasAudio
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4']
    : ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
  const webm = hasAudio
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  const preferred = container === 'mp4' ? [...mp4, ...webm] : [...webm, ...mp4]
  for (const mime of preferred) {
    if (supported(mime)) {
      return { mime, extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm' }
    }
  }
  return { mime: '', extension: 'webm' }
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number): string => String(value).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatAccelerator(accelerator: string, platform: string): string {
  const mac = platform === 'darwin'
  return accelerator
    .split('+')
    .map((part) => {
      if (part === 'CommandOrControl') return mac ? '⌘' : 'Ctrl'
      if (part === 'Command') return '⌘'
      if (part === 'Control') return mac ? '⌃' : 'Ctrl'
      if (part === 'Shift') return mac ? '⇧' : 'Shift'
      if (part === 'Alt' || part === 'Option') return mac ? '⌥' : 'Alt'
      return part.length === 1 ? part.toUpperCase() : part
    })
    .join(mac ? '' : '+')
}

export function eventToAccelerator(event: KeyboardEvent): string | null {
  const key = event.key
  if (key === 'Escape') return null
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null
  const parts: string[] = []
  if (event.metaKey || event.ctrlKey) parts.push('CommandOrControl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (parts.length === 0) return null
  const named: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Escape'
  }
  const label = named[key] ?? (key.length === 1 ? key.toUpperCase() : key)
  if (!/^[A-Za-z0-9]+$/.test(label)) return null
  parts.push(label)
  return parts.join('+')
}
