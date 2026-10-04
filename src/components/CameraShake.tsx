import { useFrame } from '@react-three/fiber'
import { world } from '../sim/world'
import { useGameStore } from '../store/gameStore'
import { shakeStrength } from './shake'

// FollowCamera'dan (5) sonra, çizimden (10) önce.
const SHAKE_PRIORITY = 6

/**
 * Vuruş ve yara anında kameraya kısa bir sarsıntı verir — kuşatmanın
 * kapanışına ve alınan darbeye ağırlık katan şey bu.
 *
 * Kaydırmayı geri almaya gerek yok: FollowCamera her karede kamera konumunu
 * kendi tabanından baştan yazıyor, dolayısıyla sarsıntı birikmez.
 */
export function CameraShake() {
  useFrame(({ camera }) => {
    const güç = shakeStrength(world, useGameStore.getState().reducedMotion)
    if (güç <= 0) return

    camera.position.x += (Math.random() - 0.5) * güç
    camera.position.y += (Math.random() - 0.5) * güç
    camera.position.z += (Math.random() - 0.5) * güç
  }, SHAKE_PRIORITY)

  return null
}
