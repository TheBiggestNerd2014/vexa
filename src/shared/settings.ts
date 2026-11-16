import type {
  FrameRate,
  Preset,
  Quality,
  ResolutionPreset,
  Settings,
  ThemeMode,
  WebcamLayout,
  WebcamShape
} from './types'

const RESOLUTIONS: ResolutionPreset[] = ['native', '720p', '1080p', '4k']
const QUALITIES: Quality[] = ['small', 'balanced', 'high']
const CONTAINERS = ['webm', 'mp4'] as const
const SHAPES: WebcamShape[] = ['circle', 'rounded', 'square']
const THEMES: ThemeMode[] = ['system', 'light', 'dark']

export function defaultWebcam(): WebcamLayout {
  return {
    x: 0.84,
    y: 0.82,
    size: 0.24,
    shape: 'circle',
    borderWidth: 6,
    borderColor: '#ffffff',
    mirror: true,
    shadow: true,
    snap: true,
    backdropBlur: false
  }
}

export function defaultSettings(outputFolder: string): Settings {
  return {
    sourceId: '',
    sourceName: '',
    sourceKind: 'screen',
    displayId: '',
    resolution: '1080p',
    fps: 30,
    quality: 'balanced',
    container: 'mp4',
    showCursor: true,
    highlightClicks: false,
    webcamEnabled: false,
    webcamDeviceId: '',
    webcam: defaultWebcam(),
    saveWebcamSeparately: false,
    systemAudio: true,
    micEnabled: true,
    micDeviceId: '',
    systemGain: 1,
    micGain: 1,
    noiseSuppression: true,
    echoCancellation: true,
    autoGain: false,
    preferSystemPicker: false,
    outputFolder,
    filenameTemplate: 'Vexa {date} {time}',
    countdown: 3,
    hotkeyToggle: 'CommandOrControl+Shift+R',
    hotkeyPause: 'CommandOrControl+Shift+P',
    launchAtLogin: false,
    theme: 'system',
    minimizeOnRecord: true,
    presets: []
  }
}

export const BUILTIN_PRESETS: Preset[] = [
  {
    id: 'builtin-talking',
    name: 'Talking head',
    resolution: '1080p',
    fps: 30,
    quality: 'balanced',
    container: 'mp4',
    showCursor: true,
    highlightClicks: false,
    webcamEnabled: true,
    webcam: { ...defaultWebcam(), shape: 'circle', x: 0.84, y: 0.82 },
    saveWebcamSeparately: false,
    systemAudio: true,
    micEnabled: true,
    systemGain: 1,
    micGain: 1,
    noiseSuppression: true,
    echoCancellation: true,
    autoGain: false,
    countdown: 3
  },
  {
    id: 'builtin-clean',
    name: 'Clean screen',
    resolution: '1080p',
    fps: 30,
    quality: 'balanced',
    container: 'mp4',
    showCursor: false,
    highlightClicks: false,
    webcamEnabled: false,
    webcam: defaultWebcam(),
    saveWebcamSeparately: false,
    systemAudio: true,
    micEnabled: true,
    systemGain: 0.9,
    micGain: 1,
    noiseSuppression: true,
    echoCancellation: true,
    autoGain: false,
    countdown: 3
  },
  {
    id: 'builtin-tutorial',
    name: 'Tutorial',
    resolution: '1080p',
    fps: 30,
    quality: 'high',
    container: 'mp4',
    showCursor: true,
    highlightClicks: true,
    webcamEnabled: true,
    webcam: { ...defaultWebcam(), shape: 'rounded', x: 0.16, y: 0.82, size: 0.22 },
    saveWebcamSeparately: false,
    systemAudio: true,
    micEnabled: true,
    systemGain: 1,
    micGain: 1,
    noiseSuppression: true,
    echoCancellation: true,
    autoGain: false,
    countdown: 3
  }
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

function text(value: unknown, fallback: string, max = 240): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, max)
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function sanitizeWebcam(value: unknown, fallback: WebcamLayout): WebcamLayout {
  const raw = isRecord(value) ? value : {}
  return {
    x: num(raw.x, fallback.x, 0, 1),
    y: num(raw.y, fallback.y, 0, 1),
    size: num(raw.size, fallback.size, 0.08, 0.6),
    shape: pick(raw.shape, SHAPES, fallback.shape),
    borderWidth: num(raw.borderWidth, fallback.borderWidth, 0, 24),
    borderColor: color(raw.borderColor, fallback.borderColor),
    mirror: bool(raw.mirror, fallback.mirror),
    shadow: bool(raw.shadow, fallback.shadow),
    snap: bool(raw.snap, fallback.snap),
    backdropBlur: bool(raw.backdropBlur, fallback.backdropBlur)
  }
}

function sanitizePreset(value: unknown): Preset | null {
  if (!isRecord(value)) return null
  const name = text(value.name, '', 40)
  if (!name) return null
  const base = defaultSettings('')
  const webcam = sanitizeWebcam(value.webcam, base.webcam)
  return {
    id: text(value.id, `preset-${name.toLowerCase().replace(/\s+/g, '-')}`, 80),
    name,
    resolution: pick(value.resolution, RESOLUTIONS, base.resolution),
    fps: pickFrame(value.fps, base.fps),
    quality: pick(value.quality, QUALITIES, base.quality),
    container: pick(value.container, CONTAINERS, base.container),
    showCursor: bool(value.showCursor, base.showCursor),
    highlightClicks: bool(value.highlightClicks, base.highlightClicks),
    webcamEnabled: bool(value.webcamEnabled, base.webcamEnabled),
    webcam,
    saveWebcamSeparately: bool(value.saveWebcamSeparately, base.saveWebcamSeparately),
    systemAudio: bool(value.systemAudio, base.systemAudio),
    micEnabled: bool(value.micEnabled, base.micEnabled),
    systemGain: num(value.systemGain, base.systemGain, 0, 2),
    micGain: num(value.micGain, base.micGain, 0, 2),
    noiseSuppression: bool(value.noiseSuppression, base.noiseSuppression),
    echoCancellation: bool(value.echoCancellation, base.echoCancellation),
    autoGain: bool(value.autoGain, base.autoGain),
    countdown: Math.round(num(value.countdown, base.countdown, 0, 10))
  }
}

function pickFrame(value: unknown, fallback: FrameRate): FrameRate {
  return value === 24 || value === 30 || value === 60 ? value : fallback
}

export function sanitizeSettings(input: unknown, outputFolder: string): Settings {
  const base = defaultSettings(outputFolder)
  const raw = isRecord(input) ? input : {}
  const presets = Array.isArray(raw.presets)
    ? raw.presets.map(sanitizePreset).filter((preset): preset is Preset => preset !== null).slice(0, 24)
    : []
  return {
    sourceId: text(raw.sourceId, '', 300),
    sourceName: text(raw.sourceName, '', 180),
    sourceKind: raw.sourceKind === 'window' ? 'window' : 'screen',
    displayId: text(raw.displayId, '', 80),
    resolution: pick(raw.resolution, RESOLUTIONS, base.resolution),
    fps: pickFrame(raw.fps, base.fps),
    quality: pick(raw.quality, QUALITIES, base.quality),
    container: pick(raw.container, CONTAINERS, base.container),
    showCursor: bool(raw.showCursor, base.showCursor),
    highlightClicks: bool(raw.highlightClicks, base.highlightClicks),
    webcamEnabled: bool(raw.webcamEnabled, base.webcamEnabled),
    webcamDeviceId: text(raw.webcamDeviceId, '', 300),
    webcam: sanitizeWebcam(raw.webcam, base.webcam),
    saveWebcamSeparately: bool(raw.saveWebcamSeparately, base.saveWebcamSeparately),
    systemAudio: bool(raw.systemAudio, base.systemAudio),
    micEnabled: bool(raw.micEnabled, base.micEnabled),
    micDeviceId: text(raw.micDeviceId, '', 300),
    systemGain: num(raw.systemGain, base.systemGain, 0, 2),
    micGain: num(raw.micGain, base.micGain, 0, 2),
    noiseSuppression: bool(raw.noiseSuppression, base.noiseSuppression),
    echoCancellation: bool(raw.echoCancellation, base.echoCancellation),
    autoGain: bool(raw.autoGain, base.autoGain),
    preferSystemPicker: bool(raw.preferSystemPicker, base.preferSystemPicker),
    outputFolder: text(raw.outputFolder, outputFolder, 500),
    filenameTemplate: text(raw.filenameTemplate, base.filenameTemplate, 80),
    countdown: Math.round(num(raw.countdown, base.countdown, 0, 10)),
    hotkeyToggle: text(raw.hotkeyToggle, base.hotkeyToggle, 80),
    hotkeyPause: text(raw.hotkeyPause, base.hotkeyPause, 80),
    launchAtLogin: bool(raw.launchAtLogin, base.launchAtLogin),
    theme: pick(raw.theme, THEMES, base.theme),
    minimizeOnRecord: bool(raw.minimizeOnRecord, base.minimizeOnRecord),
    presets
  }
}

export function applyPreset(settings: Settings, preset: Preset): Settings {
  return {
    ...settings,
    resolution: preset.resolution,
    fps: preset.fps,
    quality: preset.quality,
    container: preset.container,
    showCursor: preset.showCursor,
    highlightClicks: preset.highlightClicks,
    webcamEnabled: preset.webcamEnabled,
    webcam: { ...preset.webcam },
    saveWebcamSeparately: preset.saveWebcamSeparately,
    systemAudio: preset.systemAudio,
    micEnabled: preset.micEnabled,
    systemGain: preset.systemGain,
    micGain: preset.micGain,
    noiseSuppression: preset.noiseSuppression,
    echoCancellation: preset.echoCancellation,
    autoGain: preset.autoGain,
    countdown: preset.countdown
  }
}

export function presetFromSettings(settings: Settings, name: string, id: string): Preset {
  return {
    id,
    name,
    resolution: settings.resolution,
    fps: settings.fps,
    quality: settings.quality,
    container: settings.container,
    showCursor: settings.showCursor,
    highlightClicks: settings.highlightClicks,
    webcamEnabled: settings.webcamEnabled,
    webcam: { ...settings.webcam },
    saveWebcamSeparately: settings.saveWebcamSeparately,
    systemAudio: settings.systemAudio,
    micEnabled: settings.micEnabled,
    systemGain: settings.systemGain,
    micGain: settings.micGain,
    noiseSuppression: settings.noiseSuppression,
    echoCancellation: settings.echoCancellation,
    autoGain: settings.autoGain,
    countdown: settings.countdown
  }
}

export const WEBCAM_ANCHORS: { id: string; x: number; y: number }[] = [
  { id: 'tl', x: 0.16, y: 0.18 },
  { id: 'tc', x: 0.5, y: 0.18 },
  { id: 'tr', x: 0.84, y: 0.18 },
  { id: 'ml', x: 0.16, y: 0.5 },
  { id: 'mc', x: 0.5, y: 0.5 },
  { id: 'mr', x: 0.84, y: 0.5 },
  { id: 'bl', x: 0.16, y: 0.82 },
  { id: 'bc', x: 0.5, y: 0.82 },
  { id: 'br', x: 0.84, y: 0.82 }
]
