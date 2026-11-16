import { useEffect, useState } from 'react'
import { WEBCAM_ANCHORS } from '@shared/settings'
import type { DeviceInfo, Settings, SourceInfo } from '@shared/types'
import { getEngine, type EngineSnapshot } from '../lib/engine'
import { Meter, Slider, Switch, cx } from './ui'

export function Sources({
  settings,
  snapshot,
  cameras,
  mics,
  onChange,
  onPick
}: {
  settings: Settings
  snapshot: EngineSnapshot
  cameras: DeviceInfo[]
  mics: DeviceInfo[]
  onChange: (settings: Settings, immediate?: boolean) => void
  onPick: () => void
}) {
  const engine = getEngine()
  const patch = (partial: Partial<Settings>, immediate = true) => onChange({ ...settings, ...partial }, immediate)
  return (
    <aside className="sources">
      <section className={cx('card', settings.sourceId && 'on')}>
        <header>
          <div>
            <h2>Screen</h2>
            <p>{settings.sourceName || 'What you are recording'}</p>
          </div>
          <button type="button" className="text-button" onClick={onPick}>
            {settings.sourceId ? 'Change' : 'Choose'}
          </button>
        </header>
        <div className="card-body">
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showCursor}
              onChange={(event) => patch({ showCursor: event.target.checked })}
            />
            Show the cursor
          </label>
        </div>
      </section>

      <section className={cx('card', settings.systemAudio && 'on')}>
        <header>
          <div>
            <h2>System audio</h2>
            <p>Sound from your computer</p>
          </div>
          <Switch
            label="System audio"
            checked={settings.systemAudio}
            onChange={(checked) => {
              engine.noteGesture()
              patch({ systemAudio: checked })
            }}
          />
        </header>
        {settings.systemAudio && (
          <div className="card-body">
            <Slider
              label="Volume"
              min={0}
              max={2}
              step={0.05}
              value={settings.systemGain}
              display={snapshot.systemMuted ? 'Muted' : `${Math.round(settings.systemGain * 100)}%`}
              onChange={(systemGain) => patch({ systemGain }, false)}
            />
            <div className="level-row">
              <Meter value={snapshot.systemMuted ? 0 : snapshot.levels.system} />
              <button type="button" className="text-button" onClick={() => engine.toggleSystemMute()}>
                {snapshot.systemMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>
            {snapshot.hasScreen && !snapshot.systemAudioLive && (
              <p className="hint">System audio is not coming through yet. The picture still records.</p>
            )}
          </div>
        )}
      </section>

      <section className={cx('card', settings.webcamEnabled && 'on')}>
        <header>
          <div>
            <h2>Camera</h2>
            <p>You, in the corner</p>
          </div>
          <Switch
            label="Camera"
            checked={settings.webcamEnabled}
            onChange={(checked) => {
              engine.noteGesture()
              patch({ webcamEnabled: checked })
            }}
          />
        </header>
        {settings.webcamEnabled && (
          <div className="card-body">
            <DeviceSelect
              label="Camera device"
              value={settings.webcamDeviceId}
              devices={cameras}
              onChange={(webcamDeviceId) => {
                engine.noteGesture()
                patch({ webcamDeviceId })
              }}
            />
            <div className="segmented" role="radiogroup" aria-label="Camera shape">
              {(['circle', 'rounded', 'square'] as const).map((shape) => (
                <button
                  key={shape}
                  type="button"
                  className={settings.webcam.shape === shape ? 'on' : ''}
                  onClick={() => patch({ webcam: { ...settings.webcam, shape } })}
                >
                  {shape === 'rounded' ? 'Rounded' : shape[0].toUpperCase() + shape.slice(1)}
                </button>
              ))}
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.webcam.mirror}
                onChange={(event) => patch({ webcam: { ...settings.webcam, mirror: event.target.checked } })}
              />
              Mirror camera
            </label>
            <div className="field">
              <span className="field-label">Position</span>
              <div className="anchor-pad" role="group" aria-label="Camera position">
                {WEBCAM_ANCHORS.map((anchor) => (
                  <button
                    key={anchor.id}
                    type="button"
                    aria-label={anchor.id}
                    className={near(settings.webcam.x, anchor.x) && near(settings.webcam.y, anchor.y) ? 'on' : ''}
                    onClick={() => patch({ webcam: { ...settings.webcam, x: anchor.x, y: anchor.y } })}
                  />
                ))}
              </div>
            </div>
            <p className="hint">You can also drag the camera on the preview.</p>
          </div>
        )}
      </section>

      <section className={cx('card', settings.micEnabled && 'on')}>
        <header>
          <div>
            <h2>Microphone</h2>
            <p>Your voice</p>
          </div>
          <Switch
            label="Microphone"
            checked={settings.micEnabled}
            onChange={(checked) => {
              engine.noteGesture()
              patch({ micEnabled: checked })
            }}
          />
        </header>
        {settings.micEnabled && (
          <div className="card-body">
            <DeviceSelect
              label="Microphone device"
              value={settings.micDeviceId}
              devices={mics}
              onChange={(micDeviceId) => {
                engine.noteGesture()
                patch({ micDeviceId })
              }}
            />
            <Slider
              label="Volume"
              min={0}
              max={2}
              step={0.05}
              value={settings.micGain}
              display={snapshot.micMuted ? 'Muted' : `${Math.round(settings.micGain * 100)}%`}
              onChange={(micGain) => patch({ micGain }, false)}
            />
            <div className="level-row">
              <Meter value={snapshot.micMuted ? 0 : snapshot.levels.mic} />
              <button type="button" className="text-button" onClick={() => engine.toggleMicMute()}>
                {snapshot.micMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.noiseSuppression}
                onChange={(event) => patch({ noiseSuppression: event.target.checked })}
              />
              Reduce background noise
            </label>
          </div>
        )}
      </section>
    </aside>
  )
}

function DeviceSelect({
  label,
  value,
  devices,
  onChange
}: {
  label: string
  value: string
  devices: DeviceInfo[]
  onChange: (id: string) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Default</option>
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || 'Device'}
          </option>
        ))}
      </select>
    </label>
  )
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.04
}

export function SourcePicker({
  onClose,
  onSelect
}: {
  onClose: () => void
  onSelect: (source: SourceInfo) => void
}) {
  const [sources, setSources] = useState<SourceInfo[] | null>(null)
  const [tab, setTab] = useState<'screen' | 'window'>('screen')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void window.vexa
      .listSources()
      .then(setSources)
      .catch(() => setError('Could not list screens. Check screen recording permission.'))
  }, [])
  const visible = (sources ?? []).filter((source) => source.kind === tab)
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div className="sheet">
        <header className="sheet-head">
          <h2 id="picker-title">What should I record?</h2>
          <button type="button" className="text-button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="segmented">
          <button type="button" className={tab === 'screen' ? 'on' : ''} onClick={() => setTab('screen')}>
            Screens
          </button>
          <button type="button" className={tab === 'window' ? 'on' : ''} onClick={() => setTab('window')}>
            Windows
          </button>
        </div>
        {error && <p className="hint">{error}</p>}
        {sources === null && !error && <p className="hint">Looking for screens…</p>}
        <div className="source-grid">
          {visible.map((source) => (
            <button key={source.id} type="button" className="source-tile" onClick={() => onSelect(source)}>
              {source.thumbnail ? <img src={source.thumbnail} alt="" /> : <span className="thumb-fallback" />}
              <span>{source.name}</span>
            </button>
          ))}
        </div>
        {sources && visible.length === 0 && <p className="hint">Nothing to show here.</p>}
      </div>
    </div>
  )
}