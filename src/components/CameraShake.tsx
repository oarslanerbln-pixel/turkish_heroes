import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { world } from '../sim/world'
import { useGameStore } from '../store/gameStore'
import { shakeOffset } from './shake'

// CameraDirector'dan (5) sonra, çizimden (10) önce.
const SHAKE_PRIORITY = 6

/**
 * Vuruş ve yara anında kameraya kısa bir sarsıntı verir — kuşatmanın
 * kapanışına ve alınan darbeye ağırlık katan şey bu.
 *
 * Kaydırmayı geri almaya gerek yok: CameraDirector her karede kamera konumunu
 * kendi tabanından baştan yazıyor, dolayısıyla sarsıntı birikmez.
 */
export function CameraShake() {
  const offset = useMemo(() => new Vector3(), [])
  useFrame(({ camera }) => {
    camera.position.add(shakeOffset(world, useGameStore.getState().reducedMotion, offset))
  }, SHAKE_PRIORITY)

  return null
}
