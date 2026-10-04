import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SuitHudView } from './components/suit-hud/SuitHudView.tsx'

// Standalone first-person suit HUD lives at /suit-hud; everything else is the main app.
const isSuitHud = window.location.pathname.replace(/\/+$/, '') === '/suit-hud'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSuitHud ? <SuitHudView /> : <App />}
  </StrictMode>,
)
