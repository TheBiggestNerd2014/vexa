import type { WebcamLayout } from '@shared/types'

export interface Ripple {
  x: number
  y: number
  born: number
}

export class Compositor {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private screen: HTMLVideoElement | null = null
  private webcam: HTMLVideoElement | null = null
  private layout: WebcamLayout | null = null
  private webcamOn = false
  private ripples: Ripple[] = []
  width = 1280
  height = 720

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'preview-canvas'
    this.canvas.width = this.width
    this.canvas.height = this.height
    host.append(this.canvas)
    const ctx = this.canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Could not start the preview.')
    this.ctx = ctx
  }

  resize(width: number, height: number): void {
    this.width = Math.max(2, width)
    this.height = Math.max(2, height)
    if (this.canvas.width !== this.width) this.canvas.width = this.width
    if (this.canvas.height !== this.height) this.canvas.height = this.height
  }

  setScreen(video: HTMLVideoElement | null): void {
    this.screen = video
  }

  setWebcam(video: HTMLVideoElement | null, layout: WebcamLayout, enabled: boolean): void {
    this.webcam = video
    this.layout = layout
    this.webcamOn = enabled
  }

  addRipple(x: number, y: number, now: number): void {
    this.ripples.push({ x, y, born: now })
  }

  draw(now: number): void {
    const ctx = this.ctx
    const width = this.width
    const height = this.height
    ctx.fillStyle = '#050608'
    ctx.fillRect(0, 0, width, height)
    if (this.screen && this.screen.readyState >= 2) {
      ctx.drawImage(this.screen, 0, 0, width, height)
    }
    this.drawRipples(now)
    if (this.webcamOn && this.webcam && this.layout && this.webcam.readyState >= 2) {
      this.paintWebcam()
    }
  }

  private paintWebcam(): void {
    const video = this.webcam
    const layout = this.layout
    if (!video || !layout) return
    const ctx = this.ctx
    const min = Math.min(this.width, this.height)
    const diameter = layout.size * min
    const cx = layout.x * this.width
    const cy = layout.y * this.height
    if (layout.backdropBlur) {
      ctx.save()
      traceShape(ctx, cx, cy, diameter * 1.18, layout.shape)
      ctx.clip()
      ctx.filter = `blur(${Math.max(8, Math.round(diameter * 0.08))}px)`
      if (this.screen && this.screen.readyState >= 2) ctx.drawImage(this.screen, 0, 0, this.width, this.height)
      ctx.filter = 'none'
      ctx.restore()
    }
    if (layout.shadow) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = diameter * 0.12
      ctx.shadowOffsetY = diameter * 0.04
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      traceShape(ctx, cx, cy, diameter, layout.shape)
      ctx.fill()
      ctx.restore()
    }
    ctx.save()
    traceShape(ctx, cx, cy, diameter, layout.shape)
    ctx.clip()
    const vw = video.videoWidth || diameter
    const vh = video.videoHeight || diameter
    const scale = Math.max(diameter / vw, diameter / vh)
    const sw = diameter / scale
    const sh = diameter / scale
    ctx.save()
    if (layout.mirror) {
      ctx.translate(cx, cy)
      ctx.scale(-1, 1)
      ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, -diameter / 2, -diameter / 2, diameter, diameter)
    } else {
      ctx.drawImage(
        video,
        (vw - sw) / 2,
        (vh - sh) / 2,
        sw,
        sh,
        cx - diameter / 2,
        cy - diameter / 2,
        diameter,
        diameter
      )
    }
    ctx.restore()
    ctx.restore()
    if (layout.borderWidth > 0) {
      ctx.save()
      ctx.lineWidth = layout.borderWidth * (this.height / 1080)
      ctx.strokeStyle = layout.borderColor
      traceShape(ctx, cx, cy, diameter - ctx.lineWidth, layout.shape)
      ctx.stroke()
      ctx.restore()
    }
  }

  private drawRipples(now: number): void {
    this.ripples = this.ripples.filter((ripple) => now - ripple.born < 520)
    const min = Math.min(this.width, this.height)
    for (const ripple of this.ripples) {
      const age = (now - ripple.born) / 520
      this.ctx.save()
      this.ctx.globalAlpha = 1 - age
      this.ctx.strokeStyle = '#ffffff'
      this.ctx.lineWidth = 3
      this.ctx.beginPath()
      this.ctx.arc(ripple.x * this.width, ripple.y * this.height, (0.012 + age * 0.045) * min, 0, Math.PI * 2)
      this.ctx.stroke()
      this.ctx.restore()
    }
  }
}

function traceShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  diameter: number,
  shape: WebcamLayout['shape']
): void {
  const radius = diameter / 2
  ctx.beginPath()
  if (shape === 'circle') {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    return
  }
  const x = cx - radius
  const y = cy - radius
  const r = shape === 'rounded' ? diameter * 0.22 : diameter * 0.04
  ctx.roundRect(x, y, diameter, diameter, r)
}
