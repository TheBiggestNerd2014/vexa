import { app, shell } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type { LibraryItem, RecordingMeta } from '@shared/types'
import { getSettings } from './store'

interface IndexFile {
  items: LibraryItem[]
}

function indexPath(): string {
  return path.join(app.getPath('userData'), 'library.json')
}

function readIndex(): IndexFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath(), 'utf8')) as IndexFile
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] }
    return parsed
  } catch {
    return { items: [] }
  }
}

function writeIndex(index: IndexFile): void {
  fs.mkdirSync(path.dirname(indexPath()), { recursive: true })
  fs.writeFileSync(indexPath(), JSON.stringify(index, null, 2))
}

export function allowedPath(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  const folder = path.resolve(getSettings().outputFolder)
  if (resolved.startsWith(folder + path.sep)) return true
  return readIndex().items.some(
    (item) => path.resolve(item.filePath) === resolved || (item.cameraPath && path.resolve(item.cameraPath) === resolved)
  )
}

export async function listRecordings(): Promise<LibraryItem[]> {
  const index = readIndex()
  const kept: LibraryItem[] = []
  for (const item of index.items) {
    try {
      const stat = await fsp.stat(item.filePath)
      kept.push({ ...item, bytes: stat.size })
    } catch {
      continue
    }
  }
  kept.sort((a, b) => b.createdAt - a.createdAt)
  if (kept.length !== index.items.length) writeIndex({ items: kept })
  return kept
}

export function addRecording(
  filePath: string,
  bytes: number,
  meta: RecordingMeta
): LibraryItem {
  const item: LibraryItem = {
    id: crypto.randomUUID(),
    filePath,
    fileName: path.basename(filePath),
    createdAt: Date.now(),
    durationMs: Math.max(0, Math.round(meta.durationMs)),
    width: meta.width,
    height: meta.height,
    bytes,
    ...(meta.cameraPath ? { cameraPath: meta.cameraPath, cameraBytes: meta.cameraBytes ?? 0 } : {})
  }
  const index = readIndex()
  index.items.push(item)
  writeIndex(index)
  return item
}

export async function removeRecording(filePath: string): Promise<void> {
  if (!allowedPath(filePath)) return
  const index = readIndex()
  const item = index.items.find((entry) => entry.filePath === filePath)
  index.items = index.items.filter((entry) => entry.filePath !== filePath)
  writeIndex(index)
  await fsp.unlink(filePath).catch(() => undefined)
  if (item?.cameraPath) await fsp.unlink(item.cameraPath).catch(() => undefined)
}

export async function revealPath(filePath: string): Promise<void> {
  if (!allowedPath(filePath)) return
  shell.showItemInFolder(filePath)
}

export async function openPath(filePath: string): Promise<void> {
  if (!allowedPath(filePath)) return
  await shell.openPath(filePath)
}

export async function openOutputFolder(): Promise<void> {
  const folder = getSettings().outputFolder
  await fsp.mkdir(folder, { recursive: true })
  await shell.openPath(folder)
}
