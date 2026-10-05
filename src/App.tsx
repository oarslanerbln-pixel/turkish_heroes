import { Component, useEffect, type ReactNode } from 'react'
import { Scene } from './components/Scene'
import { CrashScreen } from './components/CrashScreen'
import { SHOT } from './shot'

/**
 * Render sırasındaki bir hata uygulamayı boş ekrana düşürmesin. Sahnenin
 * içindeki hatalar da buraya gelir: R3F Canvas yakaladığını üst ağaca yeniden
 * fırlatır. Kare döngüsündeki (useFrame) hatalar render dışında olduğu için
 * yakalanmaz.
 */
class CrashGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <CrashScreen kind="crash" /> : this.props.children
  }
}

/** index.html'deki satır içi açılış ekranı ilk çizimden sonra söner; çekim kipinde beklemeden. */
function useDismissSplash() {
  useEffect(() => {
    const splash = document.getElementById('splash')
    if (!splash) return
    if (SHOT !== null) return splash.remove()
    splash.classList.add('is-gone')
    const timer = setTimeout(() => splash.remove(), 600)
    return () => clearTimeout(timer)
  }, [])
}

export default function App() {
  useDismissSplash()
  return (
    <CrashGuard>
      <Scene />
    </CrashGuard>
  )
}
