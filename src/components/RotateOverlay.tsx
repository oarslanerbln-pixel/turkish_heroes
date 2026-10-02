import { useEffect } from 'react'
import { SHOT } from '../shot'
import { useGameStore } from '../store/gameStore'
import { RotatePhoneIcon } from './icons'

/**
 * Savaş sürerken telefon dikey tutulursa savaş molaya girer, ekranı bu örtü
 * kaplar (mola paneli dahil). Yatay tutunca mola paneli görünür; oyuncu DEVAM
 * diyene kadar savaş donuk kalır.
 *
 * Çekim kipinde molaya girmez: simülasyonu test sürer, dikey sonuç çekimi (R7)
 * savaşın bitmesini bekler.
 */
export function RotateOverlay() {
  useEffect(() => {
    if (SHOT === null) useGameStore.getState().pause(true)
  }, [])

  return (
    <div className="screen is-rotate" role="alert">
      <RotatePhoneIcon size={56} className="rotate-icon" />
      <p className="rotate-title">TELEFONU YATAY ÇEVİR</p>
      <p className="rotate-text">Savaş molada. Yatay tutunca DEVAM'a bas.</p>
    </div>
  )
}
