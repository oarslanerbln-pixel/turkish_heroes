import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

/** Odaktaki denetim; savaş dışında Enter ve Space onun işini görür. */
function focusedControl(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement
    ? target.closest<HTMLElement>('button, a[href], input, select, textarea')
    : null
}

/**
 * Space → hilal vuruşu, Q / E → sol / sağ kola emir, R → yolu kes (geçit), Esc / P → mola. Menü ekranlarında klavye ana düğmenin
 * işini görür (SAVAŞA GİR: Space/Enter, YENİDEN ve DEVAM: Enter; menüde ↑ ↓
 * komutan seçer, Hazine'de Esc kapatır) — klavyedeki oyuncu fareye uzanmasın.
 * Kenar-tetiklemeli: tuş basılı tutulduğunda tarayıcının ürettiği tekrar
 * olayları yok sayılır, yoksa enerji dolar dolmaz vuruş kendiliğinden gider.
 */
export function useStrikeInput() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) {
        // Basılı tutulan Space, odak bu arada bir düğmeye geçtiyse (sonuç
        // ekranının ana düğmesi, savaşta tıklanan kol düğmesi) bırakılınca onu
        // tetiklemesin.
        if (e.code === 'Space') e.preventDefault()
        return
      }
      const menu = useGameStore.getState()
      // Bilgi Hazinesi kendi tuşlarını yönetir (oklar, Enter odaktaki düğmede);
      // burada yalnızca Esc: kapat. Enter savaşı başlatmasın.
      if (!menu.started && menu.archive) {
        if (e.code === 'Escape') menu.closeArchive()
        return
      }
      // Menüde oklar komutan seçer (radyo grubu gibi).
      if (!menu.started && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault()
        menu.stepCommander(e.code === 'ArrowUp' ? -1 : 1)
        return
      }
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
      // Geçit: YOLU KES (mağaza geçit dışında yok sayar).
      if (e.code === 'KeyR') {
        useGameStore.getState().dropBlockade()
        return
      }
      const isSpace = e.code === 'Space'
      const isEnter = e.code === 'Enter' || e.code === 'NumpadEnter'
      if (!isSpace && !isEnter) return

      const game = useGameStore.getState()
      const inBattle = game.started && game.outcome === 'playing' && !game.paused
      const control = inBattle ? null : focusedControl(e.target)
      if (control) {
        // Menü, mola ve sonuçta odaktaki düğme kendi işini görür (BİLGİ
        // HAZİNESİ, KOMUTANLAR, rıza). Tek istisna: mola ve sonuçta kendiliğinden
        // odaklanan ana düğmede Space yutulur; vuruşa basan oyuncu ekranı
        // görmeden devam etmesin ya da yeni tura geçmesin. Enter orada da çalışır.
        if (isSpace && game.started && control.classList.contains('primary-btn')) e.preventDefault()
        return
      }
      // Space sayfayı kaydırmasın, odaktaki düğmeyi ikinci kez tetiklemesin.
      e.preventDefault()

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
