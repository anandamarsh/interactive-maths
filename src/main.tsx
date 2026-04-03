import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const isLocalhost =
  typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

if ((import.meta.env.PROD || isLocalhost) && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const scriptUrl = new URL('./sw.js', window.location.href)
    const scopeUrl = new URL('./', window.location.href)

    navigator.serviceWorker.register(scriptUrl.pathname, { scope: scopeUrl.pathname }).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
