import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshBasicMaterial } from 'three'
import { CRESCENT, HILAL_CONFIG } from '../mechanics/hilalSystem'
import { world } from '../sim/world'
import { crescentArgs } from './crescentGeometry'

const VISUAL_PRIORITY = 3

// Kuşatmanın kapanışı: yay parlar, kanatlar dışa savrulur, iz kalır.
export function StrikeEffect() {
  const groupRef = useRef<Group>(null)
  const flashRef = useRef<Mesh>(null)
  const waveRef = useRef<Mesh>(null)

  useFrame(() => {
    const group = groupRef.current
    const flash = flashRef.current
    const wave = waveRef.current
    if (!group || !flash || !wave) return

    if (world.strikeTimer <= 0) {
      group.visible = false
      return
    }

    // 0 → 1 arası ilerleme.
    const t = 1 - world.strikeTimer / HILAL_CONFIG.strikeDuration

    group.visible = true
    group.position.set(world.strikeOrigin.x, 0.04, world.strikeOrigin.z)
    group.rotation.y = world.strikeFacing

    // Gövde: sert parlama, hızlı sönüm.
    const flashMat = flash.material as MeshBasicMaterial
    flashMat.opacity = Math.max(0, 1 - t * 1.6) * 0.85

    // Dalga: yay dışa doğru açılıp incelerek kaybolur.
    wave.scale.setScalar(1 + t * 0.18)
    const waveMat = wave.material as MeshBasicMaterial
    waveMat.opacity = Math.max(0, 1 - t)
  }, VISUAL_PRIORITY)

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={flashRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={crescentArgs(CRESCENT.innerRadius, CRESCENT.outerRadius)} />
        <meshBasicMaterial color="#ff6a00" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={waveRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={crescentArgs(CRESCENT.outerRadius - 1.1, CRESCENT.outerRadius)} />
        <meshBasicMaterial color="#ffe08a" transparent opacity={1} depthWrite={false} />
      </mesh>
    </group>
  )
}
