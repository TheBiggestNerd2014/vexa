import { useEffect, useRef } from 'react'
import type { Settings } from '@shared/types'
import { getEngine, type EngineSnapshot } from '../lib/engine'
import { formatAccelerator, formatClock } from '@shared/media'

export function Preview({
  settings,
  snapshot,
  onWebcam
}: {
  settings: Settings
  snapshot: EngineSnapshot
  onWebcam: (x: number, y: number, size: number) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<'move' | 'resize' | null>(null)
  const engine = getEngine()

  useEffect(() => {
    const host = stageRef.current
    if (!host) return
    engine.mount(host)
  }, [engine])

  function point(event: React.PointerEvent): { x: number; y: number } | null {
    const canvas = engine.canvas()
    if (!canvas) return null
    const rect = displayedRect(canvas)
    if (rect.width < 2 || rect.height < 2) return null
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height)
    }
  }

  return (
    <div className="stage-wrap">
      <div className="stage" ref={stageRef} />
      <div
        className="stage-hit"
        onPointerDown={(event) => {
          const canvas = engine.canvas()
          const hit = point(event)
          if (!canvas || !hit || !settings.webcamEnabled) return
          const rect = displayedRect(canvas)
          const geometry = bubble(settings, rect)
          const corner = Math.hypot(event.clientX - (geometry.cx + geometry.d * 0.35), event.clientY - (geometry.cy + geometry.d * 0.35))
          const inside = Math.hypot(event.clientX - geometry.cx, event.clientY - geometry.cy) <= geometry.d / 2
          if (!inside && corner > 16) return
          drag.current = corner < 16 ? 'resize' : 'move'
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          const hit = point(event)
          const canvas = engine.canvas()
          if (!hit || !canvas) return
          const rect = displayedRect(canvas)
          if (drag.current === 'move') {
            onWebcam(clamp(hit.x, 0.08, 0.92), clamp(hit.y, 0.08, 0.92), settings.webcam.size)
            return
          }
          const cx = settings.webcam.x * rect.width
          const cy = settings.webcam.y * rect.height
          const dist = Math.hypot(event.clientX - rect.left - cx, event.clientY - rect.top - cy) * 2
          const size = clamp(dist / Math.min(rect.width, rect.height), 0.08, 0.6)
          onWebcam(settings.webcam.x, settings.webcam.y, size)
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      />
      {!snapshot.hasScreen && !snapshot.hasWebcam && (
        <div className="empty">
          <p>Choose a screen, then hit record.</p>
          <p>Add your camera and microphone whenever you want.</p>
        </div>
      )}
      {snapshot.countdown !== null && <div className="countdown">{snapshot.countdown}</div>}
      {settings.webcamEnabled && snapshot.hasWebcam && (
        <p className="stage-hint">Drag the camera. Pull its corner to resize.</p>
      )}
    </div>
  )
}

export function RecordControls({
  settings,
  snapshot,
  onRecord,
  onPause,
  onResume,
  onStop
}: {
  settings: Settings
  snapshot: EngineSnapshot
  onRecord: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}) {
  const recording = snapshot.phase === 'recording' || snapshot.phase === 'paused'
  const shortcut = formatAccelerator(settings.hotkeyToggle, window.vexa.platform)
  return (
    <div className="record-bar">
      {recording ? (
        <>
          <button type="button" className="record pause" onClick={snapshot.phase === 'paused' ? onResume : onPause}>
            {snapshot.phase === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="record stop" onClick={onStop}>
            Stop
          </button>
        </>
      ) : (
        <button type="button" className="record" onClick={onRecord} disabled={snapshot.phase === 'saving'}>
          {snapshot.phase === 'countdown' ? 'Cancel' : snapshot.phase === 'saving' ? 'Saving…' : 'Record'}
        </button>
      )}
      <div className="record-meta">
        <strong>{formatClock(snapshot.elapsedMs)}</strong>
        <span>
          {snapshot.phase === 'recording'
            ? 'Recording'
            : snapshot.phase === 'paused'
              ? 'Paused'
              : snapshot.phase === 'saving'
                ? 'Saving'
                : snapshot.savedName
                  ? `Saved ${snapshot.savedName}`
                  : shortcut}
        </span>
      </div>
    </div>
  )
}

function displayedRect(canvas: HTMLCanvasElement): { left: number; top: number; width: number; height: number } {
  const box = canvas.getBoundingClientRect()
  const scale = Math.min(box.width / canvas.width, box.height / canvas.height)
  const width = canvas.width * scale
  const height = canvas.height * scale
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height
  }
}

function bubble(settings: Settings, rect: { left: number; top: number; width: number; height: number }) {
  return {
    cx: rect.left + settings.webcam.x * rect.width,
    cy: rect.top + settings.webcam.y * rect.height,
    d: settings.webcam.size * Math.min(rect.width, rect.height)
  }
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}
