import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root element missing from index.html')

// Placeholder shell — replaced by the routed app (@app) in PR 11.
createRoot(container).render(
  <StrictMode>
    <div className="flex h-screen items-center justify-center bg-background">
      <p className="text-sm text-foreground-muted">EasyApply — scaffold</p>
    </div>
  </StrictMode>,
)
