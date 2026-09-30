import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { setWind } from '../audio/ambience'
import { world } from '../sim/world'
import { windGust } from './world/wind'

/** Rüzgâr sesi bu aralıkla güncellenir (sn); arası ses motorunda yumuşatılıyor. */
const AUDIO_SYNC_INTERVAL = 0.1

/**
 * Rüzgâr sesini oyuncunun bulunduğu yerdeki esintiye bağlar: çimen eğilip
 * toz kalkarken ses de aynı anda kabarsın. Çizimi yok.
 */
export function SteppeWind() {
  const timer = useRef(0)
  useFrame(({ clock }, delta) => {
    timer.current -= delta
    if (timer.current > 0) return
    timer.current = AUDIO_SYNC_INTERVAL
    setWind(windGust(clock.elapsedTime, world.player.x, world.player.z))
  })
  return null
}
