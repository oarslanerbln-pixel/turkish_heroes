import { useEffect, useMemo } from 'react'
import {
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'
import { BATTLE_CONFIG } from '../../mechanics/corps'
import { merge, paint } from '../../characters/riderGeometry'
import { applyNearFade, nearFadeDepthMaterial } from './nearFade'

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
  const parts: BufferGeometry[] = []

  // Otağ: ortada, silindir gövde + konik dam, turkuaz kuşak.
  anchor(parts, 0, z + 9, [
    paint(new CylinderGeometry(2.2, 2.2, 1.6, 12), FELT, { z: z + 9, y: 0.8 }),
    paint(new CylinderGeometry(2.25, 2.25, 0.25, 12), TURQUOISE, { z: z + 9, y: 1.35 }),
    paint(new ConeGeometry(2.4, 1.6, 12), FELT_DARK, { z: z + 9, y: 2.4 }),
  ])

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
    anchor(parts, x, z + dz, [
      paint(new ConeGeometry(1.5, 2.3, 6), FELT, { x, z: z + dz, y: 1.15 }),
      paint(new CylinderGeometry(0.2, 0.2, 0.3, 6), WOOD, { x, z: z + dz, y: 2.35 }),
    ])
  }

  // Tuğ: otağın önünde direk, altın top ve at kılı.
  anchor(parts, 0, z + 5.5, [
    paint(new CylinderGeometry(0.07, 0.09, 5, 6), WOOD, { z: z + 5.5, y: 2.5 }),
    paint(new SphereGeometry(0.22, 8, 6), GOLD, { z: z + 5.5, y: 5.1 }),
    paint(new ConeGeometry(0.35, 1.2, 8), HAIR, { z: z + 5.5, y: 4.3, rx: Math.PI }),
  ])

  // Hat kazıkları: ordunun ön hattı buraya varırsa savaş biter.
  for (let x = -LINE_HALF_WIDTH; x <= LINE_HALF_WIDTH; x += 4) {
    anchor(parts, x, z, [
      paint(new CylinderGeometry(0.06, 0.08, 1.1, 5), WOOD, { x, z, y: 0.55 }),
      paint(new ConeGeometry(0.16, 0.35, 5), TURQUOISE, { x, z, y: 1.25 }),
    ])
  }

  return merge(parts)
}

/**
 * Bir yapının parçalarını ortak inceltme çapasıyla (zemindeki noktası) ekler:
 * otağın damı, kuşağı ve gövdesi aynı mesafede, birlikte incelir.
 */
function anchor(parts: BufferGeometry[], x: number, z: number, pieces: BufferGeometry[]): void {
  for (const g of pieces) {
    const values = new Float32Array(g.attributes.position.count * 3)
    for (let i = 0; i < values.length; i += 3) {
      values[i] = x
      values[i + 2] = z
    }
    g.setAttribute('fadeAnchor', new Float32BufferAttribute(values, 3))
    parts.push(g)
  }
}

/**
 * Taktik kamera ~28 birim geride. Oyuncu ordugahın önündeyken çadırlar
 * kameraya 21–24 birim kalıyor ve ekranın altını, HUD'un arkasını kaplıyor:
 * yapılar orada bütünüyle kaybolur. Kazık hattı (≥26) kalır — kaybetme sınırı
 * hep görünsün. Bant dar: yapı ya tam görünür ya yoktur, yarı noktalı durmaz.
 */
const FADE_NEAR = 24.5
const FADE_FAR = 25.5

export function Camp() {
  const geometry = useMemo(buildCamp, [])
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })
    applyNearFade(m, FADE_NEAR, FADE_FAR, true)
    return m
  }, [])
  const depthMaterial = useMemo(() => nearFadeDepthMaterial(FADE_NEAR, FADE_FAR, true), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      depthMaterial.dispose()
    },
    [geometry, material, depthMaterial],
  )

  return (
    <mesh
      geometry={geometry}
      material={material}
      customDepthMaterial={depthMaterial}
      castShadow
      receiveShadow
    />
  )
}
