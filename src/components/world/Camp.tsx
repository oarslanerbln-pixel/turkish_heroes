import { useEffect, useMemo } from 'react'
import { ConeGeometry, CylinderGeometry, SphereGeometry } from 'three'
import { BATTLE_CONFIG } from '../../mechanics/corps'
import { merge, paint } from '../../characters/riderGeometry'

// Selçuklu ordugahı: Bizans ordusunun gündüz varmaması gereken yer.
//
// Oyuncuya kaybetme koşulunu sahnede gösteriyor — "ordugaha kalan mesafe"
// yalnızca bir sayı olsaydı soyut kalırdı. Çadırlar, ortada otağ ve tuğ;
// önünde ordunun geçmemesi gereken hattı işaretleyen kazıklar. Tek geometri,
// tek çizim çağrısı.

const FELT = '#d9c7a1'
const FELT_DARK = '#a8926a'
const TURQUOISE = '#2a9d8f'
const WOOD = '#5a3b22'
const GOLD = '#e9c46a'
const HAIR = '#1c140e'

/** Kazık hattının yarı genişliği. */
const LINE_HALF_WIDTH = 16

function buildCamp() {
  const z = BATTLE_CONFIG.campZ
  const parts = []

  // Otağ: ortada, silindir gövde + konik dam, turkuaz kuşak.
  parts.push(paint(new CylinderGeometry(2.2, 2.2, 1.6, 12), FELT, { z: z + 9, y: 0.8 }))
  parts.push(paint(new CylinderGeometry(2.25, 2.25, 0.25, 12), TURQUOISE, { z: z + 9, y: 1.35 }))
  parts.push(paint(new ConeGeometry(2.4, 1.6, 12), FELT_DARK, { z: z + 9, y: 2.4 }))

  // Çadırlar: otağın iki yanında yay şeklinde.
  const tents: [number, number][] = [
    [-8, 7],
    [-4.5, 11.5],
    [4.5, 11.5],
    [8, 7],
    [-11.5, 11],
    [11.5, 11],
  ]
  for (const [x, dz] of tents) {
    parts.push(paint(new ConeGeometry(1.5, 2.3, 6), FELT, { x, z: z + dz, y: 1.15 }))
    parts.push(paint(new CylinderGeometry(0.2, 0.2, 0.3, 6), WOOD, { x, z: z + dz, y: 2.35 }))
  }

  // Tuğ: otağın önünde direk, altın top ve at kılı.
  parts.push(paint(new CylinderGeometry(0.07, 0.09, 5, 6), WOOD, { z: z + 5.5, y: 2.5 }))
  parts.push(paint(new SphereGeometry(0.22, 8, 6), GOLD, { z: z + 5.5, y: 5.1 }))
  parts.push(paint(new ConeGeometry(0.35, 1.2, 8), HAIR, { z: z + 5.5, y: 4.3, rx: Math.PI }))

  // Hat kazıkları: ordunun ön hattı buraya varırsa savaş biter.
  for (let x = -LINE_HALF_WIDTH; x <= LINE_HALF_WIDTH; x += 4) {
    parts.push(paint(new CylinderGeometry(0.06, 0.08, 1.1, 5), WOOD, { x, z, y: 0.55 }))
    parts.push(paint(new ConeGeometry(0.16, 0.35, 5), TURQUOISE, { x, z, y: 1.25 }))
  }

  return merge(parts)
}

export function Camp() {
  const geometry = useMemo(buildCamp, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.9} flatShading />
    </mesh>
  )
}
