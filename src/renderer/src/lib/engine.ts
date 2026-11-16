import { chooseMime, outputSize, renderFilename, videoBitrate } from '@shared/media'
import type { BarState, Settings, SourceInfo } from '@shared/types'
import { AudioMixer } from './audio'
import { Compositor } from './compositor'

export interface EngineSnapshot {
  phase: 'idle' | 'countdown' | 'recording' | 'paused' | 'saving'
  error: string | null
  errorKind: 'microphone' | 'camera' | 'screen' | null
  elapsedMs: number
  countdown: number | null
  levels: { system: number; mic: number }
  micMuted: boolean
  systemMuted: boolean
  hasScreen: boolean
  hasWebcam: boolean
  systemAudioLive: boolean
  notice: string | null
  savedName: string | null
}

type Listener = () => void

const idleSnapshot = (): EngineSnapshot => ({
  phase: 'idle',
  error: null,
  errorKind: null,
  elapsedMs: 0,
  countdown: null,
  levels: { system: 0, mic: 0 },
  micMuted: false,
  systemMuted: false,
  hasScreen: false,
  hasWebcam: false,
  systemAudioLive: false,
  notice: null,
  savedName: null
})

class Engine {
  snapshot: EngineSnapshot = idleSnapshot()
  private settings: Settings | null = null
  private readonly listeners = new Set<Listener>()
  private armed = false
  private readonly mixer = new AudioMixer()
  private compositor: Compositor | null = null
  private host: HTMLElement | null = null
  private readonly screenVideo = document.createElement('video')
  private readonly camVideo = document.createElement('video')
  private screenStream: MediaStream | null = null
  private camStream: MediaStream | null = null
  private micStream: MediaStream | null = null
  private screenSig = ''
  private camSig = ''
  private micSig = ''
  private screenToken = 0
  private camToken = 0
  private micToken = 0
  private recorder: MediaRecorder | null = null
  private cameraRecorder: MediaRecorder | null = null
  private capture: MediaStream | null = null
  private queue: Promise<void> = Promise.resolve()
  private fileId: string | null = null
  private cameraFileId: string | null = null
  private cameraPath: string | null = null
  private startedAt = 0
  private elapsedBase = 0
  private lastDraw = 0
  private cancelCountdown = false
  private failing = false
  private deviceListener: (() => void) | null = null
  private frameSize = { width: 1280, height: 720 }

  constructor() {
    this.screenVideo.muted = true
    this.screenVideo.playsInline = true
    this.camVideo.muted = true
    this.camVideo.playsInline = true
    window.vexa.onBarCommand((command) => {
      if (command === 'stop') void this.stop()
      else if (command === 'pause') this.pause()
      else if (command === 'resume') this.resume()
      else if (command === 'mute') this.toggleMicMute()
      else void window.vexa.session.showMain()
    })
    window.vexa.onHotkey((action) => {
      if (action === 'toggle') this.toggle()
      else if (this.snapshot.phase === 'recording') this.pause()
      else if (this.snapshot.phase === 'paused') this.resume()
    })
    window.vexa.onRequestStop(() => {
      void this.stop().finally(() => {
        void window.vexa.session.allowClose()
      })
    })
    window.vexa.onClick((point) => {
      if (this.snapshot.phase === 'recording' && this.settings?.highlightClicks) {
        this.compositor?.addRipple(point.x, point.y, performance.now())
      }
    })
    window.vexa.onNotice((notice) => {
      this.snapshot = { ...this.snapshot, notice: notice.message }
      this.emit()
    })
    window.setInterval(() => this.tick(), 100)
    window.setInterval(() => this.backupDraw(), 90)
    requestAnimationFrame(this.loop)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  mount(host: HTMLElement): void {
    if (this.host === host && this.compositor) return
    this.host = host
    host.replaceChildren()
    const bin = document.createElement('div')
    bin.className = 'media-bin'
    bin.append(this.screenVideo, this.camVideo)
    host.append(bin)
    this.compositor = new Compositor(host)
    this.applyVisuals()
  }

  canvas(): HTMLCanvasElement | null {
    return this.compositor?.canvas ?? null
  }

  onDevices(listener: () => void): void {
    this.deviceListener = listener
  }

  noteGesture(): void {
    this.armed = true
  }

  update(settings: Settings): void {
    const previous = this.settings
    this.settings = settings
    this.mixer.setGains(settings.systemGain, settings.micGain, this.snapshot.systemMuted, this.snapshot.micMuted)
    this.applyVisuals()
    const busy = this.snapshot.phase === 'recording' || this.snapshot.phase === 'paused' || this.snapshot.phase === 'saving'
    if (busy) void this.syncLive(previous)
    else if (this.armed) void this.syncDevices()
  }

  toggleMicMute(): void {
    this.snapshot = { ...this.snapshot, micMuted: !this.snapshot.micMuted }
    this.applyGains()
    this.emit()
  }

  toggleSystemMute(): void {
    this.snapshot = { ...this.snapshot, systemMuted: !this.snapshot.systemMuted }
    this.applyGains()
    const track = this.screenStream?.getAudioTracks()[0]
    if (track) track.enabled = !this.snapshot.systemMuted && !!this.settings?.systemAudio
    this.emit()
  }

  dismiss(): void {
    this.snapshot = { ...this.snapshot, error: null, errorKind: null, notice: null }
    this.emit()
  }

  toggle(): void {
    if (this.snapshot.phase === 'countdown') this.cancelCountdown = true
    else if (this.snapshot.phase === 'recording' || this.snapshot.phase === 'paused') void this.stop()
    else void this.start()
  }

  async start(): Promise<void> {
    if (!this.settings || this.snapshot.phase === 'recording' || this.snapshot.phase === 'saving') return
    if (this.snapshot.phase === 'paused') {
      this.resume()
      return
    }
    if (this.snapshot.phase === 'countdown') {
      this.cancelCountdown = true
      return
    }
    this.noteGesture()
    this.snapshot = { ...this.snapshot, error: null, errorKind: null, savedName: null }
    this.emit()
    await this.syncDevices()
    if (!this.screenStream) {
      this.snapshot = {
        ...this.snapshot,
        error: this.snapshot.error ?? 'Choose a screen or window first.',
        errorKind: this.snapshot.errorKind ?? 'screen'
      }
      this.emit()
      return
    }
    const countdown = this.settings.countdown
    if (countdown > 0) {
      this.cancelCountdown = false
      for (let value = countdown; value >= 1; value -= 1) {
        this.snapshot = { ...this.snapshot, phase: 'countdown', countdown: value }
        this.emit()
        this.pushBar()
        const cancelled = await wait(1000, () => this.cancelCountdown)
        if (cancelled || this.snapshot.phase !== 'countdown') {
          this.snapshot = { ...this.snapshot, phase: 'idle', countdown: null }
          this.emit()
          return
        }
      }
    }
    try {
      await this.startRecorders()
    } catch (error) {
      await this.fail(error)
    }
  }

  pause(): void {
    if (this.snapshot.phase !== 'recording') return
    if (this.recorder?.state === 'recording') this.recorder.pause()
    if (this.cameraRecorder?.state === 'recording') this.cameraRecorder.pause()
    this.elapsedBase = this.currentElapsed()
    this.snapshot = { ...this.snapshot, phase: 'paused', elapsedMs: this.elapsedBase }
    this.emit()
    this.pushBar()
  }

  resume(): void {
    if (this.snapshot.phase !== 'paused') return
    if (this.recorder?.state === 'paused') this.recorder.resume()
    if (this.cameraRecorder?.state === 'paused') this.cameraRecorder.resume()
    this.startedAt = performance.now()
    this.snapshot = { ...this.snapshot, phase: 'recording' }
    this.emit()
    this.pushBar()
  }

  async stop(): Promise<void> {
    if (this.snapshot.phase !== 'recording' && this.snapshot.phase !== 'paused') return
    const elapsed = this.currentElapsed()
    this.snapshot = { ...this.snapshot, phase: 'saving', countdown: null, elapsedMs: elapsed }
    this.emit()
    this.pushBar()
    const mainId = this.fileId
    const cameraId = this.cameraFileId
    const cameraPath = this.cameraPath
    try {
      await this.finishRecorder(this.cameraRecorder)
      await this.finishRecorder(this.recorder)
      await this.queue
      let cameraBytes = 0
      if (cameraId) {
        const closed = await window.vexa.recording.end(cameraId)
        cameraBytes = closed.bytes
      }
      let savedName: string | null = null
      if (mainId) {
        const closed = await window.vexa.recording.end(mainId, {
          durationMs: elapsed,
          width: this.frameSize.width,
          height: this.frameSize.height,
          ...(cameraPath ? { cameraPath, cameraBytes } : {})
        })
        savedName = closed.item?.fileName ?? null
      }
      this.releaseRecorder()
      this.snapshot = { ...idleSnapshot(), hasScreen: !!this.screenStream, hasWebcam: !!this.camStream, systemAudioLive: this.snapshot.systemAudioLive, savedName, levels: this.snapshot.levels }
      this.elapsedBase = 0
    } catch (error) {
      await this.fail(error)
      return
    }
    await window.vexa.session.setRecording(false, { enabled: false, displayId: '' })
    this.emit()
    window.setTimeout(() => {
      if (this.snapshot.savedName) {
        this.snapshot = { ...this.snapshot, savedName: null }
        this.emit()
      }
    }, 5000)
  }

  private async syncDevices(): Promise<void> {
    const settings = this.settings
    if (!settings) return
    await this.mixer.resume().catch(() => undefined)
    await this.syncScreen(settings)
    await this.syncCam(settings)
    await this.syncMic(settings)
    this.applyVisuals()
    this.deviceListener?.()
  }

  private async syncLive(previous: Settings | null): Promise<void> {
    const settings = this.settings
    if (!settings) return
    if (
      !previous ||
      settings.webcamEnabled !== previous.webcamEnabled ||
      settings.webcamDeviceId !== previous.webcamDeviceId
    ) {
      await this.syncCam(settings)
    }
    if (
      !previous ||
      settings.micEnabled !== previous.micEnabled ||
      settings.micDeviceId !== previous.micDeviceId ||
      settings.noiseSuppression !== previous.noiseSuppression ||
      settings.echoCancellation !== previous.echoCancellation ||
      settings.autoGain !== previous.autoGain
    ) {
      await this.syncMic(settings)
    }
    const track = this.screenStream?.getAudioTracks()[0]
    if (track) track.enabled = settings.systemAudio && !this.snapshot.systemMuted
    this.mixer.setSystemStream(settings.systemAudio && track ? this.screenStream : null)
    this.applyVisuals()
  }

  private async syncScreen(settings: Settings): Promise<void> {
    if (!settings.sourceId) {
      this.stopStream(this.screenStream)
      this.screenStream = null
      this.screenSig = ''
      this.mixer.setSystemStream(null)
      this.snapshot = { ...this.snapshot, hasScreen: false, systemAudioLive: false }
      this.emit()
      return
    }
    const signature = [
      settings.sourceId,
      settings.systemAudio,
      settings.showCursor,
      settings.fps,
      settings.preferSystemPicker
    ].join('|')
    if (signature === this.screenSig && this.screenStream) {
      this.fitCanvas()
      return
    }
    const token = ++this.screenToken
    try {
      await window.vexa.prepareCapture({
        sourceId: settings.sourceId,
        audio: settings.systemAudio,
        systemPicker: settings.preferSystemPicker
      })
      const video: MediaTrackConstraints & { cursor?: 'always' | 'never' } = {
        frameRate: { ideal: settings.fps, max: settings.fps },
        cursor: settings.showCursor ? 'always' : 'never'
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video,
        audio: settings.systemAudio
      })
      if (token !== this.screenToken) {
        this.stopStream(stream)
        return
      }
      this.stopStream(this.screenStream)
      this.screenStream = stream
      this.screenSig = signature
      this.screenVideo.srcObject = stream
      await this.screenVideo.play().catch(() => undefined)
      const audio = stream.getAudioTracks()[0]
      const live = !!audio && audio.readyState === 'live'
      this.mixer.setSystemStream(settings.systemAudio && live ? stream : null)
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (this.screenStream !== stream) return
        this.screenSig = ''
        this.screenStream = null
        if (this.snapshot.phase === 'recording' || this.snapshot.phase === 'paused') void this.stop()
        else {
          this.snapshot = { ...this.snapshot, hasScreen: false, error: 'Screen capture stopped.', errorKind: 'screen' }
          this.emit()
        }
      })
      this.fitCanvas()
      this.snapshot = {
        ...this.snapshot,
        hasScreen: true,
        systemAudioLive: live,
        error: settings.systemAudio && !live ? null : this.snapshot.errorKind === 'screen' ? null : this.snapshot.error,
        errorKind: settings.systemAudio && !live ? null : this.snapshot.errorKind,
        notice:
          settings.systemAudio && !live
            ? 'System audio did not start. The picture can still be recorded. On macOS, try the system picker in Settings.'
            : this.snapshot.notice
      }
    } catch (error) {
      if (token !== this.screenToken) return
      this.screenSig = ''
      this.snapshot = { ...this.snapshot, hasScreen: false, error: friendly(error, 'Screen recording'), errorKind: 'screen' }
    }
    this.emit()
  }

  private async syncCam(settings: Settings): Promise<void> {
    if (!settings.webcamEnabled) {
      this.stopStream(this.camStream)
      this.camStream = null
      this.camSig = ''
      this.snapshot = { ...this.snapshot, hasWebcam: false }
      this.emit()
      return
    }
    const signature = `${settings.webcamDeviceId}|${settings.fps}`
    if (signature === this.camSig && this.camStream) return
    const token = ++this.camToken
    try {
      const stream = await openCamera(settings)
      if (token !== this.camToken) {
        this.stopStream(stream)
        return
      }
      this.stopStream(this.camStream)
      this.camStream = stream
      this.camSig = signature
      this.camVideo.srcObject = stream
      await this.camVideo.play().catch(() => undefined)
      this.snapshot = { ...this.snapshot, hasWebcam: true, error: this.snapshot.errorKind === 'camera' ? null : this.snapshot.error, errorKind: this.snapshot.errorKind === 'camera' ? null : this.snapshot.errorKind }
    } catch (error) {
      if (token !== this.camToken) return
      this.camSig = ''
      this.snapshot = { ...this.snapshot, hasWebcam: false, error: friendly(error, 'Camera'), errorKind: 'camera' }
    }
    this.emit()
  }

  private async syncMic(settings: Settings): Promise<void> {
    if (!settings.micEnabled) {
      this.stopStream(this.micStream)
      this.micStream = null
      this.micSig = ''
      this.mixer.setMicStream(null)
      return
    }
    const signature = `${settings.micDeviceId}|${settings.noiseSuppression}|${settings.echoCancellation}|${settings.autoGain}`
    if (signature === this.micSig && this.micStream) return
    const token = ++this.micToken
    try {
      const stream = await openMic(settings)
      if (token !== this.micToken) {
        this.stopStream(stream)
        return
      }
      this.stopStream(this.micStream)
      this.micStream = stream
      this.micSig = signature
      this.mixer.setMicStream(stream)
      this.snapshot = { ...this.snapshot, error: this.snapshot.errorKind === 'microphone' ? null : this.snapshot.error, errorKind: this.snapshot.errorKind === 'microphone' ? null : this.snapshot.errorKind }
    } catch (error) {
      if (token !== this.micToken) return
      this.micSig = ''
      this.mixer.setMicStream(null)
      this.snapshot = { ...this.snapshot, error: friendly(error, 'Microphone'), errorKind: 'microphone' }
    }
    this.emit()
  }

  private async startRecorders(): Promise<void> {
    const settings = this.settings
    const compositor = this.compositor
    if (!settings || !compositor || !this.screenStream) throw new Error('Choose a screen or window first.')
    this.fitCanvas(true)
    compositor.draw(performance.now())
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const size = { width: compositor.width, height: compositor.height }
    this.frameSize = size
    this.capture?.getTracks().forEach((track) => track.stop())
    const captured = compositor.canvas.captureStream(settings.fps)
    this.capture = captured
    const mixed = new MediaStream([...captured.getVideoTracks(), ...this.mixer.stream.getAudioTracks()])
    const chosen = chooseMime(settings.container, mixed.getAudioTracks().length > 0, (mime) =>
      MediaRecorder.isTypeSupported(mime)
    )
    const filename = renderFilename(settings.filenameTemplate, chosen.extension, settings.sourceName || 'screen')
    const file = await window.vexa.recording.begin({
      folder: settings.outputFolder,
      filename,
      kind: 'main'
    })
    this.fileId = file.id
    this.recorder = this.makeRecorder(mixed, chosen.mime, size, settings, file.id)
    if (settings.saveWebcamSeparately && this.camStream) {
      const cameraName = withSuffix(filename, 'camera')
      const cameraFile = await window.vexa.recording.begin({
        folder: settings.outputFolder,
        filename: cameraName,
        kind: 'camera'
      })
      this.cameraFileId = cameraFile.id
      this.cameraPath = cameraFile.filePath
      const cameraChosen = chooseMime('webm', false, (mime) => MediaRecorder.isTypeSupported(mime))
      this.cameraRecorder = this.makeRecorder(this.camStream, cameraChosen.mime, size, settings, cameraFile.id, true)
      this.cameraRecorder.start(1000)
    }
    this.recorder.start(1000)
    this.startedAt = performance.now()
    this.elapsedBase = 0
    this.snapshot = { ...this.snapshot, phase: 'recording', countdown: null, elapsedMs: 0 }
    this.emit()
    await window.vexa.session.setRecording(true, {
      enabled: settings.highlightClicks && settings.sourceKind === 'screen',
      displayId: settings.displayId
    })
    this.pushBar()
  }

  private makeRecorder(
    stream: MediaStream,
    mime: string,
    size: { width: number; height: number },
    settings: Settings,
    id: string,
    quiet = false
  ): MediaRecorder {
    const options: MediaRecorderOptions = {
      videoBitsPerSecond: videoBitrate(size.width, size.height, settings.fps, settings.quality),
      audioBitsPerSecond: 160_000
    }
    if (mime) options.mimeType = mime
    const recorder = new MediaRecorder(stream, options)
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.enqueue(id, event.data)
    }
    recorder.onerror = () => {
      if (!quiet) void this.fail(new Error('The recorder ran into a problem and stopped.'))
    }
    return recorder
  }

  private enqueue(id: string, blob: Blob): void {
    this.queue = this.queue
      .then(async () => {
        if (!blob.size) return
        const data = await blob.arrayBuffer()
        await window.vexa.recording.chunk(id, data)
      })
      .catch((error: unknown) => {
        void this.fail(error)
      })
  }

  private async fail(error: unknown): Promise<void> {
    if (this.failing) return
    this.failing = true
    const mainId = this.fileId
    const cameraId = this.cameraFileId
    this.releaseRecorder()
    if (mainId) await window.vexa.recording.cancel(mainId).catch(() => undefined)
    if (cameraId) await window.vexa.recording.cancel(cameraId).catch(() => undefined)
    await window.vexa.session.setRecording(false, { enabled: false, displayId: '' }).catch(() => undefined)
    this.elapsedBase = 0
    this.snapshot = {
      ...idleSnapshot(),
      hasScreen: !!this.screenStream,
      hasWebcam: !!this.camStream,
      error: friendly(error, 'Recording'),
      errorKind: 'screen'
    }
    this.failing = false
    this.emit()
  }

  private releaseRecorder(): void {
    this.recorder = null
    this.cameraRecorder = null
    this.fileId = null
    this.cameraFileId = null
    this.cameraPath = null
    this.capture?.getTracks().forEach((track) => track.stop())
    this.capture = null
  }

  private async finishRecorder(recorder: MediaRecorder | null): Promise<void> {
    if (!recorder || recorder.state === 'inactive') return
    await new Promise<void>((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true })
      try {
        recorder.stop()
      } catch {
        resolve()
      }
    })
  }

  private fitCanvas(force = false): void {
    if (!this.compositor || !this.settings) return
    if (!force && (this.snapshot.phase === 'recording' || this.snapshot.phase === 'paused')) return
    const video = this.screenVideo
    if (video.videoWidth < 2) return
    const size = outputSize(video.videoWidth, video.videoHeight, this.settings.resolution)
    this.compositor.resize(size.width, size.height)
    this.frameSize = size
  }

  private applyVisuals(): void {
    if (!this.compositor || !this.settings) return
    this.compositor.setScreen(this.screenVideo)
    this.compositor.setWebcam(this.camVideo, this.settings.webcam, this.settings.webcamEnabled && !!this.camStream)
    this.fitCanvas()
  }

  private applyGains(): void {
    if (!this.settings) return
    this.mixer.setGains(
      this.settings.systemGain,
      this.settings.micGain,
      this.snapshot.systemMuted,
      this.snapshot.micMuted
    )
  }

  private loop = (now: number): void => {
    requestAnimationFrame(this.loop)
    const fps = this.settings?.fps ?? 30
    if (now - this.lastDraw < 1000 / fps) return
    this.lastDraw = now
    this.compositor?.draw(now)
  }

  private backupDraw(): void {
    if (this.snapshot.phase !== 'recording') return
    const now = performance.now()
    const fps = this.settings?.fps ?? 30
    if (now - this.lastDraw > 1000 / fps + 40) {
      this.lastDraw = now
      this.compositor?.draw(now)
    }
  }

  private tick(): void {
    const elapsed = this.currentElapsed()
    this.snapshot = {
      ...this.snapshot,
      elapsedMs: elapsed,
      levels: {
        system: this.mixer.level('system'),
        mic: this.mixer.level('mic')
      }
    }
    this.emit()
    if (this.snapshot.phase !== 'idle') this.pushBar()
  }

  private currentElapsed(): number {
    if (this.snapshot.phase === 'recording') return this.elapsedBase + (performance.now() - this.startedAt)
    return this.elapsedBase
  }

  private pushBar(): void {
    const settings = this.settings
    const state: BarState = {
      phase: this.snapshot.phase,
      elapsedMs: this.snapshot.elapsedMs,
      micMuted: this.snapshot.micMuted,
      micEnabled: !!settings?.micEnabled
    }
    window.vexa.pushBarState(state)
  }

  private stopStream(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => track.stop())
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

function friendly(error: unknown, device: string): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return `${device} permission was blocked. Allow it in system settings, then try again.`
    if (error.name === 'NotFoundError') return `No ${device.toLowerCase()} was found.`
    if (error.name === 'NotReadableError') return `${device} is busy in another app.`
    if (error.name === 'AbortError') return `${device} was cancelled.`
    if (error.name === 'OverconstrainedError') return `That ${device.toLowerCase()} doesn't support the requested settings.`
  }
  if (error instanceof Error && error.message) return error.message
  return `Couldn't use the ${device.toLowerCase()}.`
}

async function openCamera(settings: Settings): Promise<MediaStream> {
  const video: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: settings.fps }
  }
  if (settings.webcamDeviceId) video.deviceId = { exact: settings.webcamDeviceId }
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false })
  } catch (error) {
    if (!settings.webcamDeviceId) throw error
    return navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    })
  }
}

async function openMic(settings: Settings): Promise<MediaStream> {
  const audio: MediaTrackConstraints = {
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGain,
    channelCount: 1
  }
  if (settings.micDeviceId) audio.deviceId = { exact: settings.micDeviceId }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video: false })
  } catch (error) {
    if (!settings.micDeviceId) throw error
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGain
      },
      video: false
    })
  }
}

function withSuffix(filename: string, suffix: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return `${filename} ${suffix}`
  return `${filename.slice(0, dot)} ${suffix}${filename.slice(dot)}`
}

function wait(ms: number, cancelled: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const start = performance.now()
    const step = (): void => {
      if (cancelled()) resolve(true)
      else if (performance.now() - start >= ms) resolve(false)
      else requestAnimationFrame(step)
    }
    step()
  })
}

let singleton: Engine | null = null

export function getEngine(): Engine {
  if (!singleton) singleton = new Engine()
  return singleton
}

export function useSourceLabel(source: SourceInfo | null): string {
  return source?.name || 'Choose a screen'
}
