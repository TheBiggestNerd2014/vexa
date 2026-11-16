import { globalShortcut } from 'electron'
import type { HotkeyAction, Settings } from '@shared/types'

export function registerHotkeys(
  settings: Settings,
  onAction: (action: HotkeyAction) => void
): { ok: boolean; error?: string } {
  globalShortcut.unregisterAll()
  const failed: string[] = []
  const bind = (accelerator: string, action: HotkeyAction): void => {
    if (!accelerator || failed.includes(accelerator)) return
    try {
      const ok = globalShortcut.register(accelerator, () => onAction(action))
      if (!ok) failed.push(accelerator)
    } catch {
      failed.push(accelerator)
    }
  }
  bind(settings.hotkeyToggle, 'toggle')
  bind(settings.hotkeyPause, 'pause')
  if (failed.length === 0) return { ok: true }
  return { ok: false, error: `That shortcut is already in use: ${failed.join(', ')}` }
}

export function clearHotkeys(): void {
  globalShortcut.unregisterAll()
}
