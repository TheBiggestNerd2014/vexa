import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { BarApp } from './views/Bar'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing root')

function currentView(): string {
  const query = new URLSearchParams(window.location.search).get('view') ?? ''
  if (query === 'bar') return query
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash === 'bar') return hash
  return ''
}

if (typeof window.vexa === 'undefined') {
  root.textContent = 'Vexa runs in the desktop app.'
} else {
  const view = currentView()
  const page = view === 'bar' ? <BarApp /> : <App />
  createRoot(root).render(<StrictMode>{page}</StrictMode>)
}
