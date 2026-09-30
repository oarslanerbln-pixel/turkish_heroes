import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DodecahedronGeometry, Object3D, type InstancedMesh } from 'three'
import { passHalfWidth } from '../../mechanics/pass'
import { mulberry32 } from '../../mechanics/random'
import { world } from '../../sim/world'

const VISUAL_PRIORITY = 3
const ROCKS = 18

/**
 * YOLU KES'in kaya yığını: geçidi boydan boya kapatan kayalar. Öncü temizledikçe
 * küçülür (sağlamlık); temizlenince kaybolur. Tek örneklenmiş mesh (+1 draw call).
 */
export function Blockade() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new DodecahedronGeometry(1, 0), [])
  const dummy = useMemo(() => new Object3D(), [])
  // Her yığın aynı görünsün: yerleşim tohumlu.
  const rocks = useMemo(() => {
    const rand = mulberry32(1176)
    return Array.from({ length: ROCKS }, (_, i) => ({
      u: ((i + 0.5) / ROCKS) * 2 - 1 + (rand() - 0.5) * 0.08,
      dz: (rand() - 0.5) * 1.8,
      size: 0.6 + rand() * 0.8,
      spin: rand() * Math.PI * 2,
    }))
  }, [])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const block = world.battle?.blockade
    mesh.visible = !!block
    if (!block) return
    const half = passHalfWidth(block.z) + 0.8
    const k = 0.45 + 0.55 * block.strength
    rocks.forEach((r, i) => {
      const s = r.size * k
      dummy.position.set(r.u * half, s * 0.55, block.z + r.dz)
      dummy.rotation.set(r.spin, r.spin * 1.3, 0)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, VISUAL_PRIORITY)

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, ROCKS]} castShadow receiveShadow frustumCulled={false}>
      <meshStandardMaterial color="#6d5f4e" roughness={1} metalness={0} flatShading />
    </instancedMesh>
  )
}
