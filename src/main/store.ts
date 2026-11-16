import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { sanitizeSettings } from '@shared/settings'
import type { Settings } from '@shared/types'

let cache: Settings | null = null

export function videosFolder(): string {
  try {
    return path.join(app.getPath('videos'), 'Vexa')
  } catch {
    return path.join(app.getPath('documents'), 'Vexa')
  }
}

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function write(settings: Settings): void {
  const file = settingsFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(settings, null, 2))
}

export function loadSettings(): Settings {
  let parsed: unknown = null
  try {
    parsed = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))
  } catch {
    parsed = null
  }
  const settings = sanitizeSettings(parsed, videosFolder())
  cache = settings
  write(settings)
  fs.mkdirSync(settings.outputFolder, { recursive: true })
  return settings
}

export function getSettings(): Settings {
  return cache ?? loadSettings()
}

export function saveSettings(input: unknown): Settings {
  const settings = sanitizeSettings(input, getSettings().outputFolder || videosFolder())
  cache = settings
  write(settings)
  fs.mkdirSync(settings.outputFolder, { recursive: true })
  return settings
}
