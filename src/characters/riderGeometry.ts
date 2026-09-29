// At üstünde süvari — ilkel şekillerden, doku dosyası olmadan.
//
// Model dışarıdan gelene kadar (PLAN.md P2) kapsüllerin yerini alıyor. Her
// parça köşe rengiyle boyanıp tek geometride birleştiriliyor: düşman sürüsü
// yine tek çizim çağrısı. Model +z'ye bakar, ayakları y = 0'da durur;
// yön mantığı (rotation.y = atan2(vx, vz)) kapsüllerle aynı kalır.

import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Beyaz = boyanabilir: instanceColor bu parçalara olduğu gibi geçer. */
const TINT = '#ffffff'

interface Placement {
  x?: number
  y?: number
  z?: number
  /** x ekseni etrafında eğim (radyan) — boyun, kuyruk, mızrak. */
  rx?: number
  /** z ekseni etrafında eğim — kalkan yana dönük. */
  rz?: number
}

function paint(geometry: BufferGeometry, hex: string, p: Placement = {}): BufferGeometry {
  if (p.rx) geometry.rotateX(p.rx)
  if (p.rz) geometry.rotateZ(p.rz)
  geometry.translate(p.x ?? 0, p.y ?? 0, p.z ?? 0)
  const c = new Color(hex)
  const count = geometry.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  if (!merged) throw new Error('riderGeometry: parçalar birleştirilemedi')
  return merged
}

/** Doru at: gövde, boyun, baş, yele, dört bacak, kuyruk. */
export function buildHorseGeometry(): BufferGeometry {
  const coat = '#6b4426'
  const dark = '#2e1d12'
  return merge([
    paint(new BoxGeometry(0.52, 0.55, 1.25), coat, { y: 0.95 }),
    // Pozitif rx üst ucu öne (+z) yatırır: boyun öne uzanır, baş aşağı bakar.
    paint(new BoxGeometry(0.3, 0.62, 0.34), coat, { y: 1.3, z: 0.55, rx: 0.55 }),
    paint(new BoxGeometry(0.24, 0.26, 0.52), coat, { y: 1.6, z: 0.86, rx: 0.35 }),
    paint(new BoxGeometry(0.08, 0.55, 0.1), dark, { y: 1.36, z: 0.44, rx: 0.55 }),
    paint(new BoxGeometry(0.13, 0.72, 0.13), coat, { x: 0.18, y: 0.36, z: 0.46 }),
    paint(new BoxGeometry(0.13, 0.72, 0.13), coat, { x: -0.18, y: 0.36, z: 0.46 }),
    paint(new BoxGeometry(0.13, 0.72, 0.13), coat, { x: 0.18, y: 0.36, z: -0.46 }),
    paint(new BoxGeometry(0.13, 0.72, 0.13), coat, { x: -0.18, y: 0.36, z: -0.46 }),
    paint(new BoxGeometry(0.1, 0.5, 0.12), dark, { y: 0.95, z: -0.72, rx: 0.5 }),
  ])
}

export type RiderStyle = 'enemy' | 'hero'

/**
 * Binici. `enemy`: gövde, eyer örtüsü ve kalkan beyaz — disiplin rengi
 * instanceColor ile gelir. `hero`: Metehan'ın sabit renkleri ve sırtında tuğ
 * (at kılı sancak): sürünün içinde tek bakışta bulunsun diye.
 */
export function buildRiderGeometry(style: RiderStyle): BufferGeometry {
  const hero = style === 'hero'
  const cloth = hero ? '#2a9d8f' : TINT
  const trim = hero ? '#e9c46a' : TINT
  const metal = hero ? '#c9a227' : '#9aa0a6'
  const parts = [
    paint(new BoxGeometry(0.58, 0.08, 0.5), trim, { y: 1.26, z: -0.05 }),
    paint(new BoxGeometry(0.36, 0.52, 0.26), cloth, { y: 1.6, z: -0.08 }),
    paint(new BoxGeometry(0.11, 0.42, 0.14), '#3a2a1e', { x: 0.26, y: 1.25, z: -0.02 }),
    paint(new BoxGeometry(0.11, 0.42, 0.14), '#3a2a1e', { x: -0.26, y: 1.25, z: -0.02 }),
    paint(new BoxGeometry(0.2, 0.22, 0.2), '#c8a47a', { y: 2.0, z: -0.08 }),
    paint(new ConeGeometry(0.15, 0.26, 6), metal, { y: 2.22, z: -0.08 }),
    // Mızrak: ucu öne ve yukarı.
    paint(new BoxGeometry(0.035, 0.035, 2.0), '#7a5c3a', { x: 0.27, y: 1.75, z: 0.35, rx: -0.35 }),
  ]
  if (hero) {
    // Tuğ: direk, altın tepelik, koyu at kılı püskül.
    parts.push(
      paint(new BoxGeometry(0.04, 1.5, 0.04), '#5a4630', { x: -0.2, y: 2.3, z: -0.3 }),
      paint(new BoxGeometry(0.12, 0.12, 0.12), '#e9c46a', { x: -0.2, y: 3.08, z: -0.3 }),
      paint(new ConeGeometry(0.16, 0.5, 6), '#2b1b12', { x: -0.2, y: 2.75, z: -0.3, rx: Math.PI }),
    )
  } else {
    // Yuvarlak kalkan, sol yanda.
    parts.push(paint(new CylinderGeometry(0.2, 0.2, 0.05, 8), cloth, { x: -0.24, y: 1.55, rz: Math.PI / 2 }))
  }
  return merge(parts)
}
