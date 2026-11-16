import { useState } from 'react'
import { BUILTIN_PRESETS, applyPreset, presetFromSettings } from '@shared/settings'
import { eventToAccelerator, formatAccelerator } from '@shared/media'
import type { Settings } from '@shared/types'
import { Segmented, Slider } from './ui'

export function SettingsDrawer({
  settings,
  clicks,
  onChange,
  onClose
}: {
  settings: Settings
  clicks: boolean
  onChange: (settings: Settings, immediate?: boolean) => void
  onClose: () => void
}) {
  const [presetName, setPresetName] = useState('')
  const patch = (partial: Partial<Settings>, immediate = true) => onChange({ ...settings, ...partial }, immediate)
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label="Settings" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <h2>Settings</h2>
          <button type="button" className="text-button" onClick={onClose}>
            Done
          </button>
        </header>
        <div className="drawer-body">
          <section>
            <h3>Setup</h3>
            <div className="preset-list">
              {BUILTIN_PRESETS.map((preset) => (
                <button key={preset.id} type="button" onClick={() => onChange(applyPreset(settings, preset))}>
                  {preset.name}
                </button>
              ))}
              {settings.presets.map((preset) => (
                <span key={preset.id} className="preset-row">
                  <button type="button" onClick={() => onChange(applyPreset(settings, preset))}>
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => patch({ presets: settings.presets.filter((item) => item.id !== preset.id) })}
                  >
                    Delete
                  </button>
                </span>
              ))}
            </div>
            <div className="inline-form">
              <input
                value={presetName}
                placeholder="Name this setup"
                aria-label="Preset name"
                onChange={(event) => setPresetName(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  const name = presetName.trim()
                  if (!name) return
                  patch({
                    presets: [...settings.presets, presetFromSettings(settings, name, crypto.randomUUID())]
                  })
                  setPresetName('')
                }}
              >
                Save
              </button>
            </div>
          </section>

          <section>
            <h3>Video</h3>
            <Segmented
              label="Resolution"
              value={settings.resolution}
              options={[
                { value: 'native', label: 'Native' },
                { value: '720p', label: '720p' },
                { value: '1080p', label: '1080p' },
                { value: '4k', label: '4K' }
              ]}
              onChange={(resolution) => patch({ resolution })}
            />
            <Segmented
              label="Frame rate"
              value={settings.fps}
              options={[
                { value: 24, label: '24' },
                { value: 30, label: '30' },
                { value: 60, label: '60' }
              ]}
              onChange={(fps) => patch({ fps })}
            />
            <Segmented
              label="Quality"
              value={settings.quality}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'high', label: 'High' }
              ]}
              onChange={(quality) => patch({ quality })}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={settings.highlightClicks}
                disabled={!clicks || settings.sourceKind !== 'screen'}
                onChange={(event) => patch({ highlightClicks: event.target.checked })}
              />
              Mark clicks
            </label>
            <p className="hint">
              {clicks
                ? 'Click marks appear when you record a whole screen.'
                : 'Click marks are unavailable on this computer.'}
            </p>
          </section>

          <section>
            <h3>Camera look</h3>
            <Slider
              label="Border"
              min={0}
              max={16}
              step={1}
              value={settings.webcam.borderWidth}
              display={`${Math.round(settings.webcam.borderWidth)} px`}
              onChange={(borderWidth) => patch({ webcam: { ...settings.webcam, borderWidth } }, false)}
            />
            <label className="field">
              <span className="field-label">Border color</span>
              <input
                type="color"
                value={settings.webcam.borderColor}
                aria-label="Border color"
                onChange={(event) => patch({ webcam: { ...settings.webcam, borderColor: event.target.value } }, false)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.webcam.shadow}
                onChange={(event) => patch({ webcam: { ...settings.webcam, shadow: event.target.checked } })}
              />
              Shadow
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.webcam.snap}
                onChange={(event) => patch({ webcam: { ...settings.webcam, snap: event.target.checked } })}
              />
              Snap while dragging
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.webcam.backdropBlur}
                onChange={(event) => patch({ webcam: { ...settings.webcam, backdropBlur: event.target.checked } })}
              />
              Soft backdrop behind the camera
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.saveWebcamSeparately}
                onChange={(event) => patch({ saveWebcamSeparately: event.target.checked })}
              />
              Also save the camera as its own file
            </label>
          </section>

          <section>
            <h3>Recording</h3>
            <Slider
              label="Countdown"
              min={0}
              max={5}
              step={1}
              value={settings.countdown}
              display={settings.countdown === 0 ? 'Off' : `${settings.countdown}s`}
              onChange={(countdown) => patch({ countdown }, false)}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={settings.minimizeOnRecord}
                onChange={(event) => patch({ minimizeOnRecord: event.target.checked })}
              />
              Minimize this window while recording
            </label>
            <p className="hint">A small control bar stays on screen. It is left out of the video, along with this window.</p>
            <div className="inline-form">
              <input value={settings.outputFolder} aria-label="Save folder" readOnly />
              <button
                type="button"
                onClick={() => {
                  void window.vexa.pickFolder().then((folder) => {
                    if (folder) patch({ outputFolder: folder })
                  })
                }}
              >
                Change
              </button>
            </div>
          </section>

          <details>
            <summary>Advanced</summary>
            <Segmented
              label="File type"
              value={settings.container}
              options={[
                { value: 'mp4', label: 'MP4' },
                { value: 'webm', label: 'WebM' }
              ]}
              onChange={(container) => patch({ container })}
            />
            <p className="hint">If MP4 is not supported here, Vexa saves WebM instead.</p>
            <label className="field">
              <span className="field-label">File name</span>
              <input
                value={settings.filenameTemplate}
                aria-label="File name pattern"
                onChange={(event) => patch({ filenameTemplate: event.target.value }, false)}
              />
            </label>
            <p className="hint">Use {'{date}'}, {'{time}'}, and {'{source}'}.</p>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.echoCancellation}
                onChange={(event) => patch({ echoCancellation: event.target.checked })}
              />
              Echo cancellation
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.autoGain}
                onChange={(event) => patch({ autoGain: event.target.checked })}
              />
              Automatic mic level
            </label>
            {window.vexa.platform === 'darwin' && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.preferSystemPicker}
                  onChange={(event) => patch({ preferSystemPicker: event.target.checked })}
                />
                Use the macOS share picker for system audio
              </label>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={settings.launchAtLogin}
                onChange={(event) => patch({ launchAtLogin: event.target.checked })}
              />
              Open Vexa when I sign in
            </label>
            <ShortcutField
              label="Record"
              value={settings.hotkeyToggle}
              onChange={(hotkeyToggle) => patch({ hotkeyToggle })}
            />
            <ShortcutField
              label="Pause"
              value={settings.hotkeyPause}
              onChange={(hotkeyPause) => patch({ hotkeyPause })}
            />
          </details>
          <p className="version">Vexa {window.vexa.version}</p>
        </div>
      </aside>
    </div>
  )
}

function ShortcutField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [listening, setListening] = useState(false)
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <button
        type="button"
        className={listening ? 'shortcut on' : 'shortcut'}
        onClick={() => setListening(true)}
        onBlur={() => setListening(false)}
        onKeyDown={(event) => {
          if (!listening) return
          event.preventDefault()
          if (event.key === 'Escape') {
            setListening(false)
            return
          }
          const accelerator = eventToAccelerator(event.nativeEvent)
          if (!accelerator) return
          onChange(accelerator)
          setListening(false)
        }}
      >
        {listening ? 'Press a shortcut' : formatAccelerator(value, window.vexa.platform)}
      </button>
    </label>
  )
}
