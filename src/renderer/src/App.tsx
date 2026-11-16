import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { DeviceInfo, Settings, SourceInfo } from '@shared/types'
import { getEngine } from './lib/engine'
import { Library } from './components/Library'
import { Preview, RecordControls } from './components/Preview'
import { SettingsDrawer } from './components/Settings'
import { SourcePicker, Sources } from './components/Sources'

export function App() {
  const engine = getEngine()
  const snapshot = useSyncExternalStore(
    (listener) => engine.subscribe(listener),
    () => engine.snapshot
  )
  const [settings, setSettings] = useState<Settings | null>(null)
  const [cameras, setCameras] = useState<DeviceInfo[]>([])
  const [mics, setMics] = useState<DeviceInfo[]>([])
  const [clicks, setClicks] = useState(false)
  const [picker, setPicker] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const json = useRef('')
  const timer = useRef(0)
  const pending = useRef<Settings | null>(null)

  useEffect(() => {
    void window.vexa.getSettings().then((loaded) => {
      json.current = JSON.stringify(loaded)
      setSettings(loaded)
      document.documentElement.dataset.theme = loaded.theme
      engine.update(loaded)
    })
    return window.vexa.onSettings((next) => {
      const text = JSON.stringify(next)
      if (text === json.current) return
      json.current = text
      setSettings(next)
      document.documentElement.dataset.theme = next.theme
      engine.update(next)
    })
  }, [engine])

  useEffect(() => {
    const load = async (): Promise<void> => {
      const list = await navigator.mediaDevices.enumerateDevices()
      setCameras(list.filter((device) => device.kind === 'videoinput').map(toDevice))
      setMics(list.filter((device) => device.kind === 'audioinput').map(toDevice))
    }
    void load()
    engine.onDevices(() => void load())
    navigator.mediaDevices.addEventListener('devicechange', load)
    void window.vexa.permissions.status().then((status) => setClicks(status.clicks))
    return () => navigator.mediaDevices.removeEventListener('devicechange', load)
  }, [engine])

  function commit(next: Settings, immediate = true): void {
    pending.current = next
    json.current = JSON.stringify(next)
    setSettings(next)
    document.documentElement.dataset.theme = next.theme
    engine.update(next)
    window.clearTimeout(timer.current)
    const flush = (): void => {
      const latest = pending.current
      if (latest) void window.vexa.saveSettings(latest)
    }
    if (immediate) flush()
    else timer.current = window.setTimeout(flush, 180)
  }

  if (!settings) {
    return <div className="boot">Opening Vexa…</div>
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Vexa</h1>
          <p>Record your screen, camera, and voice.</p>
        </div>
        <div className="top-actions">
          <ThemeSwitch theme={settings.theme} onChange={(theme) => commit({ ...settings, theme })} />
          <button type="button" onClick={() => setLibraryOpen(true)}>
            Recordings
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
      </header>
      {(snapshot.error || snapshot.notice) && (
        <div className={snapshot.error ? 'banner error' : 'banner'} role="status">
          <span>{snapshot.error || snapshot.notice}</span>
          <span className="banner-actions">
            {snapshot.error && snapshot.errorKind && (
              <button type="button" onClick={() => void window.vexa.permissions.open(snapshot.errorKind!)}>
                Open settings
              </button>
            )}
            <button type="button" onClick={() => engine.dismiss()}>
              Dismiss
            </button>
          </span>
        </div>
      )}
      <div className="workspace">
        <Sources
          settings={settings}
          snapshot={snapshot}
          cameras={cameras}
          mics={mics}
          onChange={commit}
          onPick={() => setPicker(true)}
        />
        <main className="stage-column">
          <Preview
            settings={settings}
            snapshot={snapshot}
            onWebcam={(x, y, size) => {
              const snapped = settings.webcam.snap ? snapPoint(x, y) : { x, y }
              commit({ ...settings, webcam: { ...settings.webcam, ...snapped, size } }, false)
            }}
          />
          <RecordControls
            settings={settings}
            snapshot={snapshot}
            onRecord={() => {
              engine.noteGesture()
              void engine.start()
            }}
            onPause={() => engine.pause()}
            onResume={() => engine.resume()}
            onStop={() => void engine.stop()}
          />
          <p className="footnote">The controls and this window stay out of the recording.</p>
        </main>
      </div>
      {picker && (
        <SourcePicker
          onClose={() => setPicker(false)}
          onSelect={(source: SourceInfo) => {
            engine.noteGesture()
            commit({
              ...settings,
              sourceId: source.id,
              sourceName: source.name,
              sourceKind: source.kind,
              displayId: source.displayId
            })
            setPicker(false)
          }}
        />
      )}
      {settingsOpen && (
        <SettingsDrawer settings={settings} clicks={clicks} onChange={commit} onClose={() => setSettingsOpen(false)} />
      )}
      {libraryOpen && <Library onClose={() => setLibraryOpen(false)} />}
    </div>
  )
}

function ThemeSwitch({
  theme,
  onChange
}: {
  theme: Settings['theme']
  onChange: (theme: Settings['theme']) => void
}) {
  const next = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system'
  const label = theme === 'system' ? 'System theme' : theme === 'dark' ? 'Dark theme' : 'Light theme'
  return (
    <button type="button" onClick={() => onChange(next)} aria-label={label}>
      {label}
    </button>
  )
}

function toDevice(device: MediaDeviceInfo): DeviceInfo {
  return { deviceId: device.deviceId, label: device.label }
}

function snapPoint(x: number, y: number): { x: number; y: number } {
  const points = [0.16, 0.5, 0.84]
  const nearest = (value: number) => points.reduce((best, point) => (Math.abs(point - value) < Math.abs(best - value) ? point : best))
  const sx = nearest(x)
  const sy = nearest(y)
  if (Math.abs(sx - x) < 0.08 && Math.abs(sy - y) < 0.08) return { x: sx, y: sy }
  return { x, y }
}
