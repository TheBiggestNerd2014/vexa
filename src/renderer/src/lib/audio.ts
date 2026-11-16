export class AudioMixer {
  readonly context = new AudioContext()
  readonly stream: MediaStream
  private readonly destination = this.context.createMediaStreamDestination()
  private readonly systemGain = this.context.createGain()
  private readonly micGain = this.context.createGain()
  private readonly systemMeter = this.context.createAnalyser()
  private readonly micMeter = this.context.createAnalyser()
  private systemNode: MediaStreamAudioSourceNode | null = null
  private micNode: MediaStreamAudioSourceNode | null = null
  private readonly scratch = new Uint8Array(256)

  constructor() {
    this.systemMeter.fftSize = 256
    this.micMeter.fftSize = 256
    this.systemGain.connect(this.systemMeter)
    this.micGain.connect(this.micMeter)
    this.systemGain.connect(this.destination)
    this.micGain.connect(this.destination)
    this.stream = this.destination.stream
  }

  setSystemStream(stream: MediaStream | null): void {
    this.systemNode?.disconnect()
    this.systemNode = null
    const track = stream?.getAudioTracks()[0]
    if (!track) return
    this.systemNode = this.context.createMediaStreamSource(new MediaStream([track]))
    this.systemNode.connect(this.systemGain)
  }

  setMicStream(stream: MediaStream | null): void {
    this.micNode?.disconnect()
    this.micNode = null
    const track = stream?.getAudioTracks()[0]
    if (!track) return
    this.micNode = this.context.createMediaStreamSource(new MediaStream([track]))
    this.micNode.connect(this.micGain)
  }

  setGains(system: number, mic: number, systemMuted: boolean, micMuted: boolean): void {
    const now = this.context.currentTime
    this.systemGain.gain.setTargetAtTime(systemMuted ? 0 : system, now, 0.02)
    this.micGain.gain.setTargetAtTime(micMuted ? 0 : mic, now, 0.02)
  }

  level(which: 'system' | 'mic'): number {
    const meter = which === 'system' ? this.systemMeter : this.micMeter
    meter.getByteTimeDomainData(this.scratch)
    let sum = 0
    for (const value of this.scratch) {
      const sample = (value - 128) / 128
      sum += sample * sample
    }
    return Math.min(1, Math.sqrt(sum / this.scratch.length) * 3.2)
  }

  async resume(): Promise<void> {
    if (this.context.state !== 'running') await this.context.resume()
  }
}
