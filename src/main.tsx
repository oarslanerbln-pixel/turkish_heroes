import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { world } from './sim/world'

// Simülasyon HUD'a throttle'lı ve özet halinde yansıyor; hata ayıklarken ham
// veriye bakmak gerekiyor. Sadece geliştirmede: `__world` ile konsoldan
// (veya tarayıcı otomasyonuyla) canlı duruma erişilir.
if (import.meta.env.DEV) {
  Object.assign(globalThis, { __world: world })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
