import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * Space → hilal vuruşu. Menü ekranlarında klavye ana düğmenin işini görür
 * (BAŞLA: Space/Enter, YENİDEN: Enter) — klavyedeki oyuncu fareye uzanmasın.
 * Kenar-tetiklemeli: tuş basılı tutulduğunda tarayıcının ürettiği tekrar
 * olayları yok sayılır, yoksa enerji dolar dolmaz vuruş kendiliğinden gider.
 */
export function useStrikeInput() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const isSpace = e.code === 'Space'
      const isEnter = e.code === 'Enter' || e.code === 'NumpadEnter'
      if (!isSpace && !isEnter) return
      // Space sayfayı kaydırmasın, odaktaki düğmeyi ikinci kez tetiklemesin.
      e.preventDefault()

      const game = useGameStore.getState()
      if (!game.started) game.start()
      // Sonuç ekranında yalnızca Enter: vuruş için Space'e basılı giden oyuncu,
      // oyun bittiği karede sonuç ekranını görmeden yeni tura atlamasın.
      else if (game.outcome !== 'playing') {
        if (isEnter) game.restart()
      } else if (isSpace) game.requestStrike()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
