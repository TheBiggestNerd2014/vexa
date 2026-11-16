import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { VexaApi } from '@shared/api'
import type { BarCommand, BarState, HotkeyAction, RecordingMeta } from '@shared/types'

function listen<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

const api: VexaApi = {
  platform: process.platform,
  get version(): string {
    return ipcRenderer.sendSync('app:version') as string
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  listSources: () => ipcRenderer.invoke('sources:list'),
  prepareCapture: (input) => ipcRenderer.invoke('capture:prepare', input),
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  recording: {
    begin: (input) => ipcRenderer.invoke('recording:begin', input),
    chunk: (id, data) => ipcRenderer.invoke('recording:chunk', id, data),
    end: (id, meta?: RecordingMeta) => ipcRenderer.invoke('recording:end', id, meta),
    cancel: (id) => ipcRenderer.invoke('recording:cancel', id)
  },
  library: {
    list: () => ipcRenderer.invoke('library:list'),
    reveal: (filePath) => ipcRenderer.invoke('library:reveal', filePath),
    open: (filePath) => ipcRenderer.invoke('library:open', filePath),
    remove: (filePath) => ipcRenderer.invoke('library:remove', filePath),
    openFolder: () => ipcRenderer.invoke('library:folder')
  },
  permissions: {
    status: () => ipcRenderer.invoke('permissions:status'),
    ask: (kind) => ipcRenderer.invoke('permissions:ask', kind),
    open: (kind) => ipcRenderer.invoke('permissions:open', kind)
  },
  session: {
    setRecording: (active, clicks) => ipcRenderer.invoke('session:recording', active, clicks),
    allowClose: () => ipcRenderer.invoke('session:allow-close'),
    showMain: () => ipcRenderer.invoke('session:show-main')
  },
  sendBarCommand: (command) => ipcRenderer.send('bar:command', command),
  onSettings: (listener) => listen('settings', listener),
  onHotkey: (listener: (action: HotkeyAction) => void) => listen('hotkey', listener),
  onBarCommand: (listener: (command: BarCommand) => void) => listen('bar:command', listener),
  onRequestStop: (listener) => {
    const wrapped = (): void => listener()
    ipcRenderer.on('session:request-stop', wrapped)
    return () => ipcRenderer.removeListener('session:request-stop', wrapped)
  },
  pushBarState: (state: BarState) => ipcRenderer.send('bar:state', state),
  onBarState: (listener) => listen('bar:state', listener),
  onClick: (listener) => listen('pointer:click', listener),
  onNotice: (listener) => listen('notice', listener)
}

contextBridge.exposeInMainWorld('vexa', api)
