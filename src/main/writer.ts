import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { finished } from 'node:stream/promises'
import type { WriteStream } from 'node:fs'

export interface OpenRecording {
  id: string
  filePath: string
  stream: WriteStream
  bytes: number
  kind: 'main' | 'camera'
}

const open = new Map<string, OpenRecording>()

function uniquePath(folder: string, filename: string): string {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let candidate = path.join(folder, filename)
  let index = 2
  while (fs.existsSync(candidate)) {
    candidate = path.join(folder, `${base} ${index}${ext}`)
    index += 1
  }
  return candidate
}

export async function beginFile(input: {
  folder: string
  filename: string
  kind: 'main' | 'camera'
}): Promise<{ id: string; filePath: string }> {
  await fsp.mkdir(input.folder, { recursive: true })
  const filePath = uniquePath(input.folder, input.filename)
  const id = crypto.randomUUID()
  const stream = fs.createWriteStream(filePath)
  open.set(id, { id, filePath, stream, bytes: 0, kind: input.kind })
  return { id, filePath }
}

export async function writeChunk(id: string, data: Buffer): Promise<void> {
  const file = open.get(id)
  if (!file || file.stream.destroyed) return
  file.bytes += data.length
  if (!file.stream.write(data)) {
    await new Promise<void>((resolve) => file.stream.once('drain', () => resolve()))
  }
}

export async function finishFile(
  id: string
): Promise<{ filePath: string; bytes: number; kind: 'main' | 'camera' } | null> {
  const file = open.get(id)
  if (!file) return null
  open.delete(id)
  if (!file.stream.destroyed) file.stream.end()
  await finished(file.stream).catch(() => undefined)
  return { filePath: file.filePath, bytes: file.bytes, kind: file.kind }
}

export async function cancelFile(id: string): Promise<void> {
  const file = open.get(id)
  if (!file) return
  open.delete(id)
  file.stream.destroy()
  await fsp.unlink(file.filePath).catch(() => undefined)
}

export function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  return Buffer.alloc(0)
}
