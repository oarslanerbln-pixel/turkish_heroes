import { useLayoutEffect, useMemo, useRef } from 'react'
import { CylinderGeometry, DodecahedronGeometry, InstancedMesh, Object3D } from 'three'
import { mulberry32, terrainHeight, TRACK_RADIUS } from './terrainShape'

/** Sınır taşları arasındaki açı: 15° → 24 taş, aralarında ~8 birim. */
const BALBAL_COUNT = 24
const BOULDER_COUNT = 36

/**
 * Arena sınırı: Türk bozkırının balbal taşları.
 *
 * Eski turuncu halka sınırı bir oyun çizgisiyle gösteriyordu; balbal hem aynı
 * bilgiyi veriyor hem de yerin bozkır olduğunu söylüyor. Oyuncu 29'da
 * durduruluyor, taşlar 30,6'da: kimse taşın içinden geçmez.
 */
export function Stones() {
  const balbalRef = useRef<InstancedMesh>(null)
  const boulderRef = useRef<InstancedMesh>(null)
  // Beş köşeli, yukarı doğru incelen dikili taş.
  const balbal = useMemo(() => new CylinderGeometry(0.28, 0.42, 1.7, 5), [])
  const boulder = useMemo(() => new DodecahedronGeometry(1, 0), [])

  useLayoutEffect(() => {
    const rand = mulberry32(1071)
    const dummy = new Object3D()

    const stones = balbalRef.current
    if (stones) {
      for (let i = 0; i < BALBAL_COUNT; i++) {
        const a = (i / BALBAL_COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.08
        const r = TRACK_RADIUS + 1.2 + rand() * 0.4
        const h = 0.8 + rand() * 0.5
        dummy.position.set(Math.cos(a) * r, 0.75 * h, Math.sin(a) * r)
        dummy.rotation.set((rand() - 0.5) * 0.12, rand() * Math.PI, (rand() - 0.5) * 0.12)
        dummy.scale.set(1, h, 1)
        dummy.updateMatrix()
        stones.setMatrixAt(i, dummy.matrix)
      }
      stones.instanceMatrix.needsUpdate = true
    }

    const rocks = boulderRef.current
    if (rocks) {
      for (let i = 0; i < BOULDER_COUNT; i++) {
        const a = rand() * Math.PI * 2
        const r = 36 + rand() * 50
        const x = Math.cos(a) * r
        const z = Math.sin(a) * r
        const s = 0.5 + rand() * 1.4
        dummy.position.set(x, terrainHeight(x, z) + s * 0.25, z)
        dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
        dummy.scale.set(s, s * (0.6 + rand() * 0.3), s)
        dummy.updateMatrix()
        rocks.setMatrixAt(i, dummy.matrix)
      }
      rocks.instanceMatrix.needsUpdate = true
    }
  }, [])

  return (
    <>
      <instancedMesh ref={balbalRef} args={[balbal, undefined, BALBAL_COUNT]} castShadow receiveShadow>
        <meshStandardMaterial color="#8f877a" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={boulderRef} args={[boulder, undefined, BOULDER_COUNT]} castShadow receiveShadow>
        <meshStandardMaterial color="#7b7264" roughness={0.95} flatShading />
      </instancedMesh>
    </>
  )
}
