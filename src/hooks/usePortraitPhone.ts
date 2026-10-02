import { useSyncExternalStore } from 'react'

// Savaş yatay için kurulu: dikey telefonda HUD, joystick ve kol düğmeleri
// çakışıyor (MIMARI.md U3, U6). 600 px'ten geniş dikey ekran (tablet) kapsam dışı.
const QUERY = '(orientation: portrait) and (max-width: 599px)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** Telefon dikey tutuluyor mu; döndürülünce yeniden çizer. */
export function usePortraitPhone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
}
