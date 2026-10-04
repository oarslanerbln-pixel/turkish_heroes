import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import { ringClosed, ringRadius } from '../mechanics/baideng'
import { world } from '../sim/world'
import { buildHorseGeometry, buildRiderGeometry } from '../characters/riderGeometry'

// Baideng'in dört renkli çemberi (Shiji 110): Mete'nin atlıları batıda ak,
// doğuda boz, kuzeyde kara, güneyde kızıl atlarla Gaozu'yu dört yandan sardı.
// Kural baideng.ts'te (ring, ringRadius); burası çemberi atlılarla çizer:
// iki saf, merkeze dönük, kapanırken dörtnala, kapanınca durur.
// Atlılar oyuncunun tarafı: Selçuklu kollarıyla aynı yaylı binici, don
// instanceColor'dan. Ak don kahramanın ak atından açık değil (STIL.md §Değer:
// kahraman tek açık leke kalır).

const VISUAL_PRIORITY = 3

const PER_RANK = 24
const RANKS = 2
const RANK_GAP = 1.8

/** Dört yön, dört don. Açı: atan2(z, x); +x doğu, -z kuzey. */
const WEST = new Color('#bdb6aa')
const EAST = new Color('#7d8792')
const NORTH = new Color('#1c1a18')
const SOUTH = new Color('#8f3a22')

const GALLOP_RATE = 9
const GALLOP_BOB = 0.1
const GALLOP_PITCH = 0.06

function coatAt(angle: number): Color {
  const x = Math.cos(angle)
  const z = Math.sin(angle)
  if (Math.abs(x) >= Math.abs(z)) return x < 0 ? WEST : EAST
  return z < 0 ? NORTH : SOUTH
}

export function HunRing() {
  const horseRef = useRef<InstancedMesh>(null)
  const riderRef = useRef<InstancedMesh>(null)
  const horse = useMemo(() => buildHorseGeometry('tint'), [])
  const rider = useMemo(() => buildRiderGeometry('ally'), [])
  const horseMaterial = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), [])
  const riderMaterial = useMemo(
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }),
    [],
  )
  const dummy = useMemo(() => new Object3D(), [])

  // Don yerden bağımsız: her atlının açısı sabit, rengi bir kez yazılır.
  useLayoutEffect(() => {
    const mesh = horseRef.current
    if (!mesh) return
    for (let r = 0; r < RANKS; r++) {
      for (let k = 0; k < PER_RANK; k++) {
        mesh.setColorAt(r * PER_RANK + k, coatAt(slotAngle(r, k)))
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  useFrame(() => {
    const horseMesh = horseRef.current
    const riderMesh = riderRef.current
    if (!horseMesh || !riderMesh) return
    const ring = world.baideng?.ring
    if (!ring) {
      horseMesh.count = 0
      riderMesh.count = 0
      return
    }
    const radius = ringRadius(ring)
    const gait = ringClosed(ring) ? 0 : 1
    const time = world.animTime
    let n = 0
    for (let r = 0; r < RANKS; r++) {
      for (let k = 0; k < PER_RANK; k++) {
        const a = slotAngle(r, k)
        const rr = radius + r * RANK_GAP
        const x = ring.center.x + Math.cos(a) * rr
        const z = ring.center.z + Math.sin(a) * rr
        const phase = time * GALLOP_RATE + n * 1.3
        dummy.position.set(x, Math.abs(Math.sin(phase)) * GALLOP_BOB * gait, z)
        // Merkeze bak: binici +z'ye bakan geometri.
        dummy.rotation.set(Math.sin(phase) * GALLOP_PITCH * gait, Math.atan2(-Math.cos(a), -Math.sin(a)), 0)
        dummy.updateMatrix()
        horseMesh.setMatrixAt(n, dummy.matrix)
        riderMesh.setMatrixAt(n, dummy.matrix)
        n++
      }
    }
    horseMesh.count = n
    riderMesh.count = n
    horseMesh.instanceMatrix.needsUpdate = true
    riderMesh.instanceMatrix.needsUpdate = true
  }, VISUAL_PRIORITY)

  return (
    <>
      <instancedMesh
        ref={horseRef}
        args={[horse, horseMaterial, PER_RANK * RANKS]}
        castShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={riderRef}
        args={[rider, riderMaterial, PER_RANK * RANKS]}
        castShadow
        frustumCulled={false}
      />
    </>
  )
}

/** Arka saf öndekilerin arasına düşer: çember delik değil duvar gibi okunsun. */
function slotAngle(rank: number, k: number): number {
  return ((k + rank * 0.5) / PER_RANK) * Math.PI * 2
}
