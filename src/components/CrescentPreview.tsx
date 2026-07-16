import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshBasicMaterial } from 'three'
import { CRESCENT, HILAL_CONFIG } from '../mechanics/hilalSystem'
import { isPlaying, world } from '../sim/world'
import { crescentArgs } from './crescentGeometry'

// Yönetmenden (2) sonra çalış ki yay o karenin yönünü ve sayımını kullansın.
const VISUAL_PRIORITY = 3

/**
 * Nişan önizlemesi: vuruş şu an tetiklense neresi silinirdi.
 *
 * Oyuncunun menzil ve açı hissi kurabilmesi için şart — yoksa hilal görünmez bir
 * kural olur ve konumlanma tahmine dayanır. Enerji doldukça parlar.
 */
export function CrescentPreview() {
  const groupRef = useRef<Group>(null)
  const fillRef = useRef<Mesh>(null)
  const edgeRef = useRef<Mesh>(null)

  useFrame(() => {
    const group = groupRef.current
    const fill = fillRef.current
    const edge = edgeRef.current
    if (!group || !fill || !edge) return

    // Vuruş oynarken önizleme kapansın, iki yay üst üste binmesin.
    const görünür = isPlaying() && world.strikeTimer <= 0
    group.visible = görünür
    if (!görünür) return

    group.position.set(world.player.x, 0.02, world.player.z)
    group.rotation.y = world.facing

    const şarj = world.energy / HILAL_CONFIG.strikeThreshold
    const hazır = şarj >= 1
    // Hedefte düşman varken biraz daha belirgin olsun.
    const isabet = world.inCrescent > 0 ? 1 : 0.55

    const fillMat = fill.material as MeshBasicMaterial
    fillMat.opacity = (0.04 + şarj * 0.16) * isabet
    fillMat.color.setHex(hazır ? 0xff4400 : 0xffd700)

    const edgeMat = edge.material as MeshBasicMaterial
    edgeMat.opacity = (0.25 + şarj * 0.5) * isabet
    edgeMat.color.setHex(hazır ? 0xff4400 : 0xffd700)
  }, VISUAL_PRIORITY)

  return (
    <group ref={groupRef}>
      {/* Yayın gövdesi */}
      <mesh ref={fillRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={crescentArgs(CRESCENT.innerRadius, CRESCENT.outerRadius)} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      {/* Dış kenar — menzilin nerede bittiğini net göstersin */}
      <mesh ref={edgeRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={crescentArgs(CRESCENT.outerRadius - 0.35, CRESCENT.outerRadius)} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  )
}
