import { useState } from 'react'
import { canVibrate } from '../audio/sfx'
import { isTouchDevice } from '../hooks/useTouchControls'
import { useGameStore } from '../store/gameStore'

/**
 * Ses ve titreşim düğmeleri: savaşın sağ üst köşesinde ve menüde aynı.
 * Titreşim yalnız titreyebilen dokunmatik cihazda görünür (iOS'ta API yok,
 * masaüstünde motor yok).
 */
export function SettingsButtons() {
  const muted = useGameStore((s) => s.muted)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const haptics = useGameStore((s) => s.haptics)
  const toggleHaptics = useGameStore((s) => s.toggleHaptics)
  const [vibrates] = useState(() => isTouchDevice() && canVibrate())

  return (
    <>
      <button
        className="icon-btn"
        onClick={toggleMute}
        aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
        aria-pressed={!muted}
        title={muted ? 'Sesi aç' : 'Sesi kapat'}
      >
        <SpeakerIcon muted={muted} />
      </button>
      {vibrates && (
        <button
          className="icon-btn"
          onClick={toggleHaptics}
          aria-label={haptics ? 'Titreşimi kapat' : 'Titreşimi aç'}
          aria-pressed={haptics}
          title={haptics ? 'Titreşimi kapat' : 'Titreşimi aç'}
        >
          <VibrateIcon off={!haptics} />
        </button>
      )}
    </>
  )
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" />
      {muted ? (
        <path d="m23 9-6 6M17 9l6 6" />
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
      )}
    </svg>
  )
}

function VibrateIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="3" width="8" height="18" rx="2" />
      {off ? <path d="M3 3l18 18" /> : <path d="M4 8v8M20 8v8M1.5 10v4M22.5 10v4" />}
    </svg>
  )
}
