import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, MeshBasicMaterial } from 'three'
import { HILAL_CONFIG } from '../mechanics/hilalSystem'
import { world } from '../sim/world'

// Kuşatmanın kapanışı: merkezden dışa açılan halka.
export function StrikeEffect() {
  const ringRef = useRef<Mesh>(null)

  useFrame(() => {
    const ring = ringRef.current
    if (!ring) return

    if (world.strikeTimer <= 0) {
      ring.visible = false
      return
    }

    // 0 → 1 arası ilerleme.
    const t = 1 - world.strikeTimer / HILAL_CONFIG.strikeDuration

    ring.visible = true
    ring.position.set(world.strikeCenter.x, 0.05, world.strikeCenter.z)
    ring.scale.setScalar(t * HILAL_CONFIG.strikeRadius)
    ;(ring.material as MeshBasicMaterial).opacity = 1 - t
  })

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      {/* Yarıçap 1: ölçek doğrudan birim cinsinden yarıçapı verir. */}
      <ringGeometry args={[0.82, 1, 64]} />
      <meshBasicMaterial color="#ff4400" transparent opacity={1} />
    </mesh>
  )
}
