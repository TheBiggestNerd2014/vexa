import assert from 'node:assert/strict'
import { outputSize, renderFilename, videoBitrate } from '../src/shared/media'
import { sanitizeSettings } from '../src/shared/settings'

const settings = sanitizeSettings({ fps: 99, webcam: { size: 4 }, filenameTemplate: '' }, 'C:/Videos/Vexa')
assert.equal(settings.fps, 30)
assert.equal(settings.webcam.size, 0.6)
assert.equal(settings.outputFolder, 'C:/Videos/Vexa')

const size = outputSize(2560, 1440, '1080p')
assert.equal(size.height, 1080)
assert.equal(size.width % 2, 0)

assert.ok(videoBitrate(1920, 1080, 30, 'balanced') > 1_000_000)

const name = renderFilename('Vexa {date} {source}', 'mp4', 'Display: 1', new Date('2026-11-16T15:04:05'))
assert.equal(name, 'Vexa 2026-11-16 Display 1.mp4')

console.log('selfcheck ok')
