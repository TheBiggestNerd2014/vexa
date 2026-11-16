import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, powerSaveBlocker, screen, session, shell, systemPreferences } from 'electron'
import { join } from 'path'
import type { BeginRecording } from '@shared/api'
import type { BarCommand, HotkeyAction, RecordingMeta, Settings } from '@shared/types'
import { listSources, registerCaptureHandler, setCaptureRequest } from './capture'
import { setClickWatch, stopClickWatch } from './clicks'
import { addRecording, listRecordings, openOutputFolder, openPath, removeRecording, revealPath } from './library'
import { clicksSupported, excludeFromCapture } from './protect'
import { clearHotkeys, registerHotkeys } from './shortcuts'
import { getSettings, loadSettings, saveSettings } from './store'
import { createBarWindow, createMainWindow } from './windows'
import { beginFile, cancelFile, finishFile, toBuffer, writeChunk } from './writer'

let mainWindow: BrowserWindow | null = null
let barWindow: BrowserWindow | null = null
let tray: Tray | null = null
let recording = false
let closeAfterStop = false
let blockerId = 0

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMain())
  app.whenReady().then(start)
}

function send(channel: string, payload?: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

function showMain(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (recording) mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.show()
  mainWindow.focus()
  excludeFromCapture(mainWindow, true)
}

function placeBar(): void {
  if (!barWindow || barWindow.isDestroyed()) return
  const display = screen.getPrimaryDisplay()
  barWindow.setBounds({
    x: Math.round(display.workArea.x + (display.workArea.width - 460) / 2),
    y: Math.round(display.workArea.y + display.workArea.height - 104),
    width: 460,
    height: 72
  })
}

function showBar(): void {
  if (!barWindow || barWindow.isDestroyed()) barWindow = createBarWindow()
  placeBar()
  barWindow.showInactive()
  excludeFromCapture(barWindow, true)
  barWindow.moveTop()
}

function hideBar(): void {
  if (barWindow && !barWindow.isDestroyed()) barWindow.hide()
}

function resourcePath(name: string): string {
  if (app.isPackaged) return join(process.resourcesPath, name)
  return join(app.getAppPath(), 'build', name)
}

function refreshTray(): void {
  if (!tray) return
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Vexa', click: () => showMain() },
      {
        label: recording ? 'Stop recording' : 'Start recording',
        click: () => send('hotkey', 'toggle' satisfies HotkeyAction)
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          if (recording) {
            closeAfterStop = true
            send('session:request-stop')
          } else {
            app.quit()
          }
        }
      }
    ])
  )
}

function buildTray(): void {
  const image = nativeImage.createFromPath(
    resourcePath(process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png')
  )
  if (image.isEmpty()) return
  if (process.platform === 'darwin') image.setTemplateImage(true)
  tray = new Tray(image.resize({ width: 18, height: 18 }))
  tray.setToolTip('Vexa')
  tray.on('click', () => showMain())
  refreshTray()
}

function applyRuntime(settings: Settings): void {
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin })
  const hotkeys = registerHotkeys(settings, (action) => send('hotkey', action))
  if (!hotkeys.ok && hotkeys.error) send('notice', { message: hotkeys.error })
}

function safeStatus(kind: 'microphone' | 'camera' | 'screen'): string {
  try {
    return systemPreferences.getMediaAccessStatus(kind)
  } catch {
    return 'unknown'
  }
}

async function openPrivacy(kind: 'microphone' | 'camera' | 'screen'): Promise<void> {
  if (process.platform === 'darwin') {
    const pane =
      kind === 'microphone' ? 'Privacy_Microphone' : kind === 'camera' ? 'Privacy_Camera' : 'Privacy_ScreenCapture'
    await shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`)
    return
  }
  const target =
    kind === 'camera'
      ? 'ms-settings:privacy-webcam'
      : kind === 'microphone'
        ? 'ms-settings:privacy-microphone'
        : 'ms-settings:privacy'
  await shell.openExternal(target)
}

function registerIpc(): void {
  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion()
  })
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_event, input: unknown) => {
    const settings = saveSettings(input)
    applyRuntime(settings)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('settings', settings)
    }
    return settings
  })
  ipcMain.handle('sources:list', () => listSources())
  ipcMain.handle('capture:prepare', (_event, input: { sourceId: string; audio: boolean; systemPicker: boolean }) => {
    setCaptureRequest({
      sourceId: input?.sourceId ?? '',
      audio: !!input?.audio,
      systemPicker: !!input?.systemPicker
    })
  })
  ipcMain.handle('folder:pick', async () => {
    const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getFocusedWindow()
    const options = { properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'> }
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  ipcMain.handle('recording:begin', (_event, input: BeginRecording) => beginFile(input))
  ipcMain.handle('recording:chunk', async (_event, id: string, data: unknown) => {
    await writeChunk(id, toBuffer(data))
  })
  ipcMain.handle('recording:end', async (_event, id: string, meta?: RecordingMeta) => {
    const closed = await finishFile(id)
    if (!closed) return { filePath: '', bytes: 0, item: null }
    if (closed.kind === 'main' && meta) {
      const item = addRecording(closed.filePath, closed.bytes, meta)
      return { filePath: closed.filePath, bytes: closed.bytes, item }
    }
    return { filePath: closed.filePath, bytes: closed.bytes, item: null }
  })
  ipcMain.handle('recording:cancel', (_event, id: string) => cancelFile(id))
  ipcMain.handle('library:list', () => listRecordings())
  ipcMain.handle('library:reveal', (_event, filePath: string) => revealPath(filePath))
  ipcMain.handle('library:open', (_event, filePath: string) => openPath(filePath))
  ipcMain.handle('library:remove', (_event, filePath: string) => removeRecording(filePath))
  ipcMain.handle('library:folder', () => openOutputFolder())
  ipcMain.handle('permissions:status', () => ({
    microphone: safeStatus('microphone'),
    camera: safeStatus('camera'),
    screen: safeStatus('screen'),
    clicks: clicksSupported()
  }))
  ipcMain.handle('permissions:ask', (_event, kind: 'microphone' | 'camera') => {
    if (process.platform !== 'darwin') return true
    return systemPreferences.askForMediaAccess(kind)
  })
  ipcMain.handle('permissions:open', (_event, kind: 'microphone' | 'camera' | 'screen') => openPrivacy(kind))
  ipcMain.handle(
    'session:recording',
    (_event, active: boolean, clicks: { enabled: boolean; displayId: string }) => {
      recording = active
      if (active) {
        if (!powerSaveBlocker.isStarted(blockerId)) blockerId = powerSaveBlocker.start('prevent-display-sleep')
        showBar()
        setClickWatch(!!clicks?.enabled, clicks?.displayId ?? '')
        if (getSettings().minimizeOnRecord && mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize()
      } else {
        if (powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId)
        hideBar()
        stopClickWatch()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(false)
          if (!closeAfterStop) {
            mainWindow.show()
            mainWindow.focus()
          }
        }
      }
      refreshTray()
    }
  )
  ipcMain.handle('session:allow-close', () => {
    closeAfterStop = true
    recording = false
    hideBar()
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
    app.quit()
  })
  ipcMain.handle('session:show-main', () => {
    showMain()
  })
  ipcMain.on('bar:command', (_event, command: BarCommand) => {
    send('bar:command', command)
  })
  ipcMain.on('bar:state', (_event, state: unknown) => {
    if (barWindow && !barWindow.isDestroyed()) barWindow.webContents.send('bar:state', state)
  })
}

async function start(): Promise<void> {
  app.setAppUserModelId('com.vexa.recorder')
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
    )
  } else {
    Menu.setApplicationMenu(null)
  }
  const mediaPermissions = new Set(['media', 'display-capture', 'audioCapture', 'videoCapture'])
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(mediaPermissions.has(permission))
  })
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'"
          ]
        }
      })
    })
  }
  registerCaptureHandler()
  registerIpc()
  const settings = loadSettings()
  applyRuntime(settings)
  mainWindow = createMainWindow()
  mainWindow.on('show', () => {
    if (mainWindow) excludeFromCapture(mainWindow, true)
  })
  mainWindow.on('restore', () => {
    if (mainWindow) excludeFromCapture(mainWindow, true)
  })
  mainWindow.on('close', (event) => {
    if (!recording || closeAfterStop) {
      hideBar()
      if (barWindow && !barWindow.isDestroyed()) barWindow.destroy()
      return
    }
    event.preventDefault()
    void dialog
      .showMessageBox(mainWindow!, {
        type: 'question',
        buttons: ['Keep recording', 'Stop and quit'],
        defaultId: 0,
        cancelId: 0,
        message: 'A recording is in progress.',
        detail: 'Stop it before quitting? Vexa will save what you have so far.'
      })
      .then((result) => {
        if (result.response !== 1) return
        closeAfterStop = true
        send('session:request-stop')
      })
  })
  if (!app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') mainWindow?.webContents.toggleDevTools()
    })
  }
  buildTray()
  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createMainWindow()
    } else {
      showMain()
    }
  })
  app.on('will-quit', () => {
    clearHotkeys()
    stopClickWatch()
  })
  app.on('window-all-closed', () => {
    app.quit()
  })
}
