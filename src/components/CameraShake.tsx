import { useFrame } from '@react-three/fiber'
import { HILAL_CONFIG } from '../mechanics/hilalSystem'
import { world } from '../sim/world'

// FollowCamera'dan (5) sonra, çizimden (10) önce.
const SHAKE_PRIORITY = 6

const SHAKE_STRENGTH = 0.5

/**
 * Vuruş anında kameraya kısa bir sarsıntı verir — kuşatmanın kapanışına ağırlık
 * katan şey bu.
 *
 * Kaydırmayı geri almaya gerek yok: FollowCamera her karede kamera konumunu
 * kendi tabanından baştan yazıyor, dolayısıyla sarsıntı birikmez.
 */
export function CameraShake() {
  useFrame(({ camera }) => {
    if (world.strikeTimer <= 0) return

    // En sert vuruş anında, sonra sönümlenir.
    const kalan = world.strikeTimer / HILAL_CONFIG.strikeDuration
    const güç = kalan * kalan * SHAKE_STRENGTH

    camera.position.x += (Math.random() - 0.5) * güç
    camera.position.y += (Math.random() - 0.5) * güç
    camera.position.z += (Math.random() - 0.5) * güç
  }, SHAKE_PRIORITY)

  return null
}
