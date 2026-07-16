import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * Space → hilal vuruşu.
 * Kenar-tetiklemeli: tuş basılı tutulduğunda tarayıcının ürettiği tekrar
 * olayları yok sayılır, yoksa enerji dolar dolmaz vuruş kendiliğinden gider.
 */
export function useStrikeInput() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      // Space sayfayı kaydırmasın.
      e.preventDefault()
      useGameStore.getState().requestStrike()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
