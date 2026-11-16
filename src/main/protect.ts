import type { BrowserWindow } from 'electron'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(__filename)

const WDA_EXCLUDEFROMCAPTURE = 0x00000011

type AffinityFn = (hwnd: bigint, affinity: number) => number
type KeyStateFn = (key: number) => number
type MacButtonFn = (state: number, button: number) => number

let affinity: AffinityFn | null = null
let keyState: KeyStateFn | null = null
let macButton: MacButtonFn | null = null
let loaded = false

function loadNative(): void {
  if (loaded) return
  loaded = true
  try {
    const koffi = nodeRequire('koffi') as {
      load: (name: string) => { func: (signature: string) => unknown }
    }
    if (process.platform === 'win32') {
      const user32 = koffi.load('user32.dll')
      affinity = user32.func('int __stdcall SetWindowDisplayAffinity(intptr hWnd, uint32 dwAffinity)') as AffinityFn
      keyState = user32.func('int16 __stdcall GetAsyncKeyState(int32 vKey)') as KeyStateFn
    } else if (process.platform === 'darwin') {
      const coreGraphics = koffi.load(
        '/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics'
      )
      macButton = coreGraphics.func('int CGEventSourceButtonState(int32 state, int32 button)') as MacButtonFn
    }
  } catch (error) {
    console.error('Native helpers did not load', error)
  }
}

/**
 * Keep a window visible to the person using the computer and out of the capture.
 * On Windows, Electron's setContentProtection can show a black rectangle, so we
 * ask the OS to leave the window out of the capture entirely.
 */
export function excludeFromCapture(win: BrowserWindow, allowFallback: boolean): boolean {
  if (win.isDestroyed()) return false
  loadNative()
  if (process.platform === 'win32' && affinity) {
    try {
      const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0)
      const ok = affinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
      if (ok) return true
    } catch (error) {
      console.error('Could not exclude a window from capture', error)
    }
  }
  if (process.platform === 'darwin' || allowFallback) {
    win.setContentProtection(true)
    return process.platform === 'darwin'
  }
  return false
}

export function isLeftDown(): boolean | null {
  loadNative()
  try {
    if (process.platform === 'win32' && keyState) {
      return (keyState(0x01) & 0x8000) !== 0
    }
    if (process.platform === 'darwin' && macButton) {
      return macButton(0, 0) !== 0
    }
  } catch (error) {
    console.error('Could not read the mouse button', error)
  }
  return null
}

export function clicksSupported(): boolean {
  return isLeftDown() !== null
}
