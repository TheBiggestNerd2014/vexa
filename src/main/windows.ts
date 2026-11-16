import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { excludeFromCapture } from './protect'

export function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function loadRoute(win: BrowserWindow, view: string): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  const file = join(__dirname, '../renderer/index.html')
  if (!view) {
    if (devUrl) void win.loadURL(devUrl)
    else void win.loadFile(file)
    return
  }
  if (devUrl) {
    const url = new URL(devUrl)
    url.searchParams.set('view', view)
    void win.loadURL(url.href)
    return
  }
  void win.loadFile(file, { query: { view } })
}

export function commonWebPreferences(): Electron.WebPreferences {
  return {
    preload: preloadPath(),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    backgroundThrottling: false,
    spellcheck: false
  }
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#101114',
    title: 'Vexa',
    webPreferences: commonWebPreferences()
  })
  win.webContents.on('preload-error', (_event, file, error) => {
    console.error('preload failed', file, error)
  })
  win.webContents.setBackgroundThrottling(false)
  win.on('ready-to-show', () => {
    excludeFromCapture(win, true)
    win.show()
  })
  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })
  loadRoute(win, '')
  return win
}

export function createBarWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 460,
    height: 72,
    frame: false,
    transparent: true,
    roundedCorners: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: commonWebPreferences()
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.on('ready-to-show', () => excludeFromCapture(win, true))
  loadRoute(win, 'bar')
  return win
}
