import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = path.resolve(import.meta.dirname, '..', 'build')
fs.mkdirSync(root, { recursive: true })

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function png(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    rgba.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function draw(size, mode) {
  const data = Buffer.alloc(size * size * 4)
  const center = (size - 1) / 2
  const radius = size * 0.42
  const dot = size * (mode === 'tray' ? 0.28 : 0.16)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center
      const dy = y - center
      const distance = Math.hypot(dx, dy)
      const ax = Math.abs(dx) - radius
      const ay = Math.abs(dy) - radius
      const box = Math.hypot(Math.max(ax, 0), Math.max(ay, 0)) + Math.min(Math.max(ax, ay), 0) - size * 0.12
      const index = (y * size + x) * 4
      if (mode === 'template') {
        if (distance < dot) {
          data[index + 3] = 255
        }
        continue
      }
      if (box > 1.2) continue
      const cover = box > 0 ? 1 - box : 1
      const ink = distance < dot ? 1 : 0
      const ring = distance > dot * 1.8 && distance < dot * 2.35 ? 1 : 0
      data[index] = ink ? 226 : ring ? 255 : 22
      data[index + 1] = ink ? 59 : ring ? 255 : 24
      data[index + 2] = ink ? 59 : ring ? 255 : 32
      data[index + 3] = Math.round(255 * cover)
    }
  }
  return data
}

function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = []
  const blobs = []
  for (const image of images) {
    const entry = Buffer.alloc(16)
    entry[0] = image.size >= 256 ? 0 : image.size
    entry[1] = image.size >= 256 ? 0 : image.size
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(image.png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    blobs.push(image.png)
    offset += image.png.length
  }
  return Buffer.concat([header, ...entries, ...blobs])
}

const iconSizes = [16, 32, 48, 64, 128, 256]
const icons = iconSizes.map((size) => ({ size, png: png(size, draw(size, 'app')) }))
fs.writeFileSync(path.join(root, 'icon.png'), png(1024, draw(1024, 'app')))
fs.writeFileSync(path.join(root, 'icon.ico'), ico(icons))
fs.writeFileSync(path.join(root, 'tray.png'), png(32, draw(32, 'tray')))
fs.writeFileSync(path.join(root, 'trayTemplate.png'), png(32, draw(32, 'template')))
console.log('icons written')
