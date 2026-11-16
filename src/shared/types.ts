export type ResolutionPreset = 'native' | '720p' | '1080p' | '4k'
export type FrameRate = 24 | 30 | 60
export type Quality = 'small' | 'balanced' | 'high'
export type ContainerFormat = 'webm' | 'mp4'
export type WebcamShape = 'circle' | 'rounded' | 'square'
export type ThemeMode = 'system' | 'light' | 'dark'
export type SourceKind = 'screen' | 'window'

export interface WebcamLayout {
  /** Center of the bubble, 0 to 1 across the frame. */
  x: number
  y: number
  /** Diameter as a fraction of the shorter frame side. */
  size: number
  shape: WebcamShape
  borderWidth: number
  borderColor: string
  mirror: boolean
  shadow: boolean
  snap: boolean
  backdropBlur: boolean
}

export interface Settings {
  sourceId: string
  sourceName: string
  sourceKind: SourceKind
  displayId: string
  resolution: ResolutionPreset
  fps: FrameRate
  quality: Quality
  container: ContainerFormat
  showCursor: boolean
  highlightClicks: boolean
  webcamEnabled: boolean
  webcamDeviceId: string
  webcam: WebcamLayout
  saveWebcamSeparately: boolean
  systemAudio: boolean
  micEnabled: boolean
  micDeviceId: string
  systemGain: number
  micGain: number
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGain: boolean
  preferSystemPicker: boolean
  outputFolder: string
  filenameTemplate: string
  countdown: number
  hotkeyToggle: string
  hotkeyPause: string
  launchAtLogin: boolean
  theme: ThemeMode
  minimizeOnRecord: boolean
  presets: Preset[]
}

export interface Preset {
  id: string
  name: string
  resolution: ResolutionPreset
  fps: FrameRate
  quality: Quality
  container: ContainerFormat
  showCursor: boolean
  highlightClicks: boolean
  webcamEnabled: boolean
  webcam: WebcamLayout
  saveWebcamSeparately: boolean
  systemAudio: boolean
  micEnabled: boolean
  systemGain: number
  micGain: number
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGain: boolean
  countdown: number
}

export interface SourceInfo {
  id: string
  name: string
  displayId: string
  kind: SourceKind
  thumbnail: string
  appIcon: string | null
}

export interface DeviceInfo {
  deviceId: string
  label: string
}

export interface PermissionSnapshot {
  microphone: string
  camera: string
  screen: string
  clicks: boolean
}

export interface LibraryItem {
  id: string
  filePath: string
  cameraPath?: string
  fileName: string
  createdAt: number
  durationMs: number
  width: number
  height: number
  bytes: number
  cameraBytes?: number
}

export interface RecordingMeta {
  durationMs: number
  width: number
  height: number
  cameraPath?: string
  cameraBytes?: number
}

export interface BarState {
  phase: 'idle' | 'countdown' | 'recording' | 'paused' | 'saving'
  elapsedMs: number
  micMuted: boolean
  micEnabled: boolean
}

export type BarCommand = 'pause' | 'resume' | 'stop' | 'mute' | 'show'

export type HotkeyAction = 'toggle' | 'pause'
