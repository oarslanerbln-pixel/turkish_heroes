import { Component, type ReactNode } from 'react'
import { Scene } from './components/Scene'
import { CrashScreen } from './components/CrashScreen'

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

export default function App() {
  return (
    <CrashGuard>
      <Scene />
    </CrashGuard>
  )
}
