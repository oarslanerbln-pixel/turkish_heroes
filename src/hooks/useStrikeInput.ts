import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * Space → hilal vuruşu, Q / E → sol / sağ kola emir, Esc / P → mola. Menü ekranlarında klavye ana düğmenin
 * işini görür (BAŞLA: Space/Enter, YENİDEN ve DEVAM: Enter) — klavyedeki
 * oyuncu fareye uzanmasın.
 * Kenar-tetiklemeli: tuş basılı tutulduğunda tarayıcının ürettiği tekrar
 * olayları yok sayılır, yoksa enerji dolar dolmaz vuruş kendiliğinden gider.
 */
export function useStrikeInput() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Escape' || e.code === 'KeyP') {
        const game = useGameStore.getState()
        if (game.paused) game.resume()
        else game.pause(false)
        return
      }
      // Kol emirleri: savaş dışında (menü, mola, sonuç) mağaza yok sayar.
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        useGameStore.getState().cycleWing(e.code === 'KeyQ' ? 0 : 1)
        return
      }
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
        // Enter ana düğmenin işi: kilit açıldıysa yeni komutanın savaşı.
        if (isEnter) {
          if (game.unlocked) game.playCommander(game.unlocked)
          else game.restart()
        }
      } else if (game.paused) {
        // Space vuruş tuşu: molayı yanlışlıkla kapatmasın, yalnızca Enter.
        if (isEnter) game.resume()
      } else if (isSpace) game.requestStrike()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
