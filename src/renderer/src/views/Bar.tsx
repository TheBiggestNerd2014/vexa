import { useEffect, useState } from 'react'
import { formatClock } from '@shared/media'
import type { BarState } from '@shared/types'

const empty: BarState = {
  phase: 'recording',
  elapsedMs: 0,
  micMuted: false,
  micEnabled: true
}

export function BarApp() {
  const [state, setState] = useState<BarState>(empty)
  useEffect(() => window.vexa.onBarState(setState), [])
  const send = window.vexa.sendBarCommand
  return (
    <div className="bar-root">
      <div className="pill">
        <span className={state.phase === 'paused' ? 'rec-dot paused' : 'rec-dot'} />
        <strong>{formatClock(state.elapsedMs)}</strong>
        {state.phase === 'paused' ? (
          <button type="button" onClick={() => send('resume')}>
            Resume
          </button>
        ) : (
          <button type="button" onClick={() => send('pause')}>
            Pause
          </button>
        )}
        <button type="button" className="stop" onClick={() => send('stop')}>
          Stop
        </button>
        {state.micEnabled && (
          <button type="button" onClick={() => send('mute')}>
            {state.micMuted ? 'Mic off' : 'Mic'}
          </button>
        )}
        <button type="button" onClick={() => send('show')}>
          Vexa
        </button>
      </div>
    </div>
  )
}
