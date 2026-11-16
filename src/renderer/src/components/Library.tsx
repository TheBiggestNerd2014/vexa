import { useEffect, useState } from 'react'
import { formatBytes, formatClock } from '@shared/media'
import type { LibraryItem } from '@shared/types'

export function Library({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  async function reload(): Promise<void> {
    setItems(await window.vexa.library.list())
  }

  useEffect(() => {
    void reload()
  }, [])

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label="Recordings" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <h2>Recordings</h2>
          <button type="button" className="text-button" onClick={onClose}>
            Done
          </button>
        </header>
        <div className="drawer-body">
          <button type="button" className="text-button" onClick={() => void window.vexa.library.openFolder()}>
            Open folder
          </button>
          {items === null && <p className="hint">Loading…</p>}
          {items?.length === 0 && <p className="hint">Your recordings will show up here.</p>}
          <ul className="library">
            {items?.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.fileName}</strong>
                  <span>
                    {new Date(item.createdAt).toLocaleString()} · {formatClock(item.durationMs)} · {formatBytes(item.bytes)}
                    {item.width > 0 ? ` · ${item.width}×${item.height}` : ''}
                  </span>
                </div>
                <div className="row-actions">
                  <button type="button" onClick={() => void window.vexa.library.open(item.filePath)}>
                    Play
                  </button>
                  <button type="button" onClick={() => void window.vexa.library.reveal(item.filePath)}>
                    Show
                  </button>
                  {item.cameraPath && (
                    <button type="button" onClick={() => void window.vexa.library.open(item.cameraPath!)}>
                      Camera
                    </button>
                  )}
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (pendingDelete !== item.filePath) {
                        setPendingDelete(item.filePath)
                        return
                      }
                      void window.vexa.library.remove(item.filePath).then(reload)
                      setPendingDelete(null)
                    }}
                  >
                    {pendingDelete === item.filePath ? 'Confirm' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
