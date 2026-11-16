import { BrowserWindow, screen } from 'electron'
import { isLeftDown } from './protect'

let timer: NodeJS.Timeout | null = null
let wasDown = false
let displayId = ''

export function setClickWatch(enabled: boolean, nextDisplayId: string): void {
  displayId = nextDisplayId
  if (!enabled || isLeftDown() === null) {
    stopClickWatch()
    return
  }
  if (timer) return
  timer = setInterval(poll, 16)
}

export function stopClickWatch(): void {
  if (timer) clearInterval(timer)
  timer = null
  wasDown = false
}

function poll(): void {
  const down = isLeftDown()
  if (down === null) return
  if (down && !wasDown) {
    const cursor = screen.getCursorScreenPoint()
    const displays = screen.getAllDisplays()
    const display =
      displays.find((item) => String(item.id) === displayId) ?? screen.getDisplayNearestPoint(cursor)
    const x = (cursor.x - display.bounds.x) / display.bounds.width
    const y = (cursor.y - display.bounds.y) / display.bounds.height
    if (x >= 0 && y >= 0 && x <= 1 && y <= 1) {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('pointer:click', { x, y })
      }
    }
  }
  wasDown = down
}
