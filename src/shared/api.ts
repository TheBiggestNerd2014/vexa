import type {
  BarCommand,
  BarState,
  HotkeyAction,
  LibraryItem,
  PermissionSnapshot,
  RecordingMeta,
  Settings,
  SourceInfo
} from './types'

export interface BeginRecording {
  folder: string
  filename: string
  kind: 'main' | 'camera'
}

export interface ClosedRecording {
  filePath: string
  bytes: number
  item: LibraryItem | null
}

export interface VexaApi {
  platform: string
  version: string
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<Settings>
  listSources(): Promise<SourceInfo[]>
  prepareCapture(input: { sourceId: string; audio: boolean; systemPicker: boolean }): Promise<void>
  pickFolder(): Promise<string | null>
  recording: {
    begin(input: BeginRecording): Promise<{ id: string; filePath: string }>
    chunk(id: string, data: ArrayBuffer): Promise<void>
    end(id: string, meta?: RecordingMeta): Promise<ClosedRecording>
    cancel(id: string): Promise<void>
  }
  library: {
    list(): Promise<LibraryItem[]>
    reveal(filePath: string): Promise<void>
    open(filePath: string): Promise<void>
    remove(filePath: string): Promise<void>
    openFolder(): Promise<void>
  }
  permissions: {
    status(): Promise<PermissionSnapshot>
    ask(kind: 'microphone' | 'camera'): Promise<boolean>
    open(kind: 'microphone' | 'camera' | 'screen'): Promise<void>
  }
  session: {
    setRecording(active: boolean, clicks: { enabled: boolean; displayId: string }): Promise<void>
    allowClose(): Promise<void>
    showMain(): Promise<void>
  }
  sendBarCommand(command: BarCommand): void
  onSettings(listener: (settings: Settings) => void): () => void
  onHotkey(listener: (action: HotkeyAction) => void): () => void
  onBarCommand(listener: (command: BarCommand) => void): () => void
  onRequestStop(listener: () => void): () => void
  pushBarState(state: BarState): void
  onBarState(listener: (state: BarState) => void): () => void
  onClick(listener: (point: { x: number; y: number }) => void): () => void
  onNotice(listener: (notice: { message: string }) => void): () => void
}
