import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { world } from '../sim/world'
import { useGameStore } from '../store/gameStore'
import type { ShotMoment } from '../shot'

/** Bir çekimin en fazla süreceği simülasyon adımı (15 dk): ana ulaşılamazsa döngü biter. */
const STEP_LIMIT = 15 * 60 * 60

/** Ana varınca birkaç adım daha: HUD eşitlemesi (0,08 sn) son durumu yakalasın. */
const SETTLE_STEPS = 6

/**
 * Referans çekim yönetmeni (bkz. shot.ts). Canvas 'never' kipinde: kareyi
 * yalnız bu bileşen ister. Menüde tek kare çizer. Savaş başlayınca simülasyonu
 * sabit 1/60 adımla ana götürür; ara kareler çizilmez (yalnız son kare), yoksa
 * 104 sn'lik bir çekim yazılım GPU'sunda dakikalar sürerdi.
 *
 * Kare hazır olunca `<html data-shot="menu|battle" data-shot-time="…">`: test
 * bunu bekler. Ayrı adlar şart: SAVAŞA GİR'den sonra menünün işareti kalırsa
 * test savaş karesini beklemeden çekerdi.
 */
export function ShotDirector({ moment }: { moment: ShotMoment }) {
  const advance = useThree((s) => s.advance)
  const gl = useThree((s) => s.gl)
  const started = useGameStore((s) => s.mode !== 'menu')

  useEffect(() => {
    const root = document.documentElement
    delete root.dataset.shot
    if (started) {
      const reached = () => (moment === 'end' ? world.outcome !== 'playing' : world.time >= moment)
      // 'never' kipinde advance(t) deltayı t − clock.elapsedTime'dan alır: her adım tam 1/60.
      let k = 0
      const step = () => advance(++k / 60)
      const render = gl.render
      gl.render = () => {}
      try {
        while (k < STEP_LIMIT && !reached()) step()
        for (let i = 0; i < SETTLE_STEPS; i++) step()
      } finally {
        gl.render = render
      }
      step()
      // Çekimde duyuru olmaz (§10.8): banner kareyi kapatmasın.
      world.announceTimer = 0
      world.announceQueue.length = 0
      useGameStore.setState({ announcement: '' })
    } else {
      advance(0)
    }
    root.dataset.shotTime = world.time.toFixed(2)
    // HUD'un React güncellemesi bir sonraki görev sırasında işlenir.
    requestAnimationFrame(() => {
      root.dataset.shot = started ? 'battle' : 'menu'
    })
  }, [started, moment, advance, gl])

  return null
}
