// At üstünde süvari — ilkel şekillerden, doku dosyası olmadan.
//
// Model dışarıdan gelene kadar (PLAN.md P2) kapsüllerin yerini alıyor. Her
// parça köşe rengiyle boyanıp tek geometride birleştiriliyor: düşman sürüsü
// yine tek çizim çağrısı. Model +z'ye bakar, ayakları y = 0'da durur;
// yön mantığı (rotation.y = atan2(vx, vz)) kapsüllerle aynı kalır.

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  TorusGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Beyaz = boyanabilir: instanceColor bu parçalara olduğu gibi geçer. */
const TINT = '#ffffff'
const SHAFT = '#7a5c3a'
/**
 * Mızrak ve direk kalınlığı. Taktik kamerada bir birim ~13 piksel: 0,035
 * birimlik mızrak yarım pikseldi, kenar yumuşatmada kayboluyordu (STIL.md §Siluet).
 */
const POLE = 0.09

export interface Placement {
  x?: number
  y?: number
  z?: number
  /** x ekseni etrafında eğim (radyan) — boyun, kuyruk, mızrak. */
  rx?: number
  /** z ekseni etrafında eğim — kalkan yana dönük. */
  rz?: number
}

export function paint(geometry: BufferGeometry, hex: string, p: Placement = {}): BufferGeometry {
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

export function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  if (!merged) throw new Error('riderGeometry: parçalar birleştirilemedi')
  return merged
}

export type RiderStyle = 'enemy' | 'hero' | 'ally'
/** `tint`: don instanceColor'dan gelir (Baideng'in dört renkli Hun çemberi). */
export type Coat = RiderStyle | 'tint'

/**
 * At donu tarafı söyler (STIL.md §Değer): kahraman ak at — birlikler arasında
 * tek açık leke; Selçuklu doru; Bizans yağız, en koyu. Yele ve kuyruk her
 * donda gövdeden ayrı tonda: at, kutu değil at gibi okunsun.
 */
const COATS: Record<Coat, { coat: string; dark: string }> = {
  hero: { coat: '#e6dfd2', dark: '#8c8478' },
  ally: { coat: '#4e2a17', dark: '#1e120a' },
  enemy: { coat: '#262019', dark: '#0f0c0a' },
  tint: { coat: TINT, dark: '#4a423a' },
}

/** At: gövde, boyun, baş, yele, dört bacak, kuyruk. */
export function buildHorseGeometry(style: Coat): BufferGeometry {
  const { coat, dark } = COATS[style]
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

/**
 * Binici. `enemy`: gövde, eyer örtüsü, kalkan ve flama beyaz — disiplin rengi
 * instanceColor ile gelir. `hero`: Metehan'ın sabit renkleri ve sırtında tuğ
 * (at kılı sancak): sürünün içinde tek bakışta bulunsun diye. `ally`: Selçuklu
 * atlı okçusu — komutanla aynı renk ailesi, daha koyu; mızrak yerine yay.
 */
export function buildRiderGeometry(style: RiderStyle): BufferGeometry {
  const hero = style === 'hero'
  const ally = style === 'ally'
  const cloth = hero ? '#2a9d8f' : ally ? '#1f6f66' : TINT
  const trim = hero ? '#e9c46a' : ally ? '#b8862b' : TINT
  const metal = hero || ally ? '#c9a227' : '#9aa0a6'
  const parts = [
    paint(new BoxGeometry(0.58, 0.08, 0.5), trim, { y: 1.26, z: -0.05 }),
    paint(new BoxGeometry(0.36, 0.52, 0.26), cloth, { y: 1.6, z: -0.08 }),
    paint(new BoxGeometry(0.11, 0.42, 0.14), '#3a2a1e', { x: 0.26, y: 1.25, z: -0.02 }),
    paint(new BoxGeometry(0.11, 0.42, 0.14), '#3a2a1e', { x: -0.26, y: 1.25, z: -0.02 }),
    paint(new BoxGeometry(0.2, 0.22, 0.2), '#c8a47a', { y: 2.0, z: -0.08 }),
    paint(new ConeGeometry(0.15, 0.26, 6), metal, { y: 2.22, z: -0.08 }),
  ]
  if (ally) {
    // Yay: sol elde, dikey, kameraya dönük; açık boynuz rengi koyu doru ve
    // kaftan üstünde seçilsin. Selçuklu atlısının imzası: mızrak yok, yay var.
    parts.push(paint(new TorusGeometry(0.5, 0.06, 3, 8, Math.PI), '#a8773f', { x: -0.34, y: 1.6, z: 0.1, rz: Math.PI / 2 }))
  } else if (hero) {
    // Mızrak: ucu öne ve yukarı — kahraman saldırıda.
    parts.push(paint(new BoxGeometry(POLE, POLE, 2.2), SHAFT, { x: 0.27, y: 1.75, z: 0.4, rx: -0.35 }))
  } else {
    // Bizans mızrağı dik, ucunun altında flama: sürü yukarıdan bir mızrak
    // ormanı olarak okunur. Flama boyanabilir: düzen ve hamle rengini taşır.
    parts.push(
      paint(new BoxGeometry(POLE, 2.6, POLE), SHAFT, { x: 0.27, y: 2.3, z: 0.1 }),
      paint(new BoxGeometry(0.32, 0.22, 0.02), TINT, { x: 0.47, y: 3.3, z: 0.1 }),
    )
  }
  if (hero) {
    // Tuğ: direk, altın tepelik, koyu at kılı püskül — sürünün üstünde ilk
    // görülen şey (kahramanın koyu yarısı; ak at açık yarısı).
    parts.push(
      paint(new BoxGeometry(0.07, 1.9, 0.07), '#5a4630', { x: -0.2, y: 2.5, z: -0.3 }),
      paint(new BoxGeometry(0.18, 0.18, 0.18), '#e9c46a', { x: -0.2, y: 3.5, z: -0.3 }),
      paint(new ConeGeometry(0.26, 0.8, 6), '#2b1b12', { x: -0.2, y: 3.0, z: -0.3, rx: Math.PI }),
    )
  } else if (!ally) {
    // Yuvarlak kalkan, sol yanda.
    parts.push(paint(new CylinderGeometry(0.2, 0.2, 0.05, 6), cloth, { x: -0.24, y: 1.55, rz: Math.PI / 2 }))
  }
  return merge(parts)
}

export type Emperor = 'romanos' | 'manuel' | 'gaozu'

/**
 * İmparator sancağı: imparatorun yanında taşınan, ordunun üstüne çıkan direk.
 * Altın binici ve iri ölçek tek başına kalabalıkta kayboluyordu. İki imparator
 * ayrı okunsun: Romanos (Malazgirt) mor kare sancak, altın haç; Manuel
 * (Miryokefalon) kızıl, çatal kuyruklu, altın kuşak; Gaozu (Baideng) uzun,
 * dar, kara kenarlı kızıl flama — Liu Bang'ın bayrakları kızıldı (Shiji 8).
 * Tarihî arma iddiası yok — ayırt etme imzası (STIL.md §Siluet).
 */
export function buildStandardGeometry(emperor: Emperor): BufferGeometry {
  const parts = [
    paint(new BoxGeometry(POLE, 3.4, POLE), SHAFT, { x: 0.4, y: 2.6, z: 0.1 }),
    paint(new BoxGeometry(1.0, POLE, POLE), SHAFT, { x: 0.4, y: 4.15, z: 0.1 }),
    paint(new ConeGeometry(0.12, 0.3, 6), '#e9c46a', { x: 0.4, y: 4.45, z: 0.1 }),
  ]
  if (emperor === 'romanos') {
    parts.push(
      paint(new BoxGeometry(0.9, 0.95, 0.03), '#5b2a86', { x: 0.4, y: 3.62, z: 0.1 }),
      paint(new BoxGeometry(0.14, 0.75, 0.05), '#e9c46a', { x: 0.4, y: 3.62, z: 0.1 }),
      paint(new BoxGeometry(0.6, 0.14, 0.05), '#e9c46a', { x: 0.4, y: 3.72, z: 0.1 }),
    )
  } else if (emperor === 'gaozu') {
    parts.push(
      paint(new BoxGeometry(0.5, 1.6, 0.03), '#b3261e', { x: 0.4, y: 3.32, z: 0.1 }),
      paint(new BoxGeometry(0.08, 1.6, 0.05), '#1a1716', { x: 0.65, y: 3.32, z: 0.1 }),
      paint(new BoxGeometry(0.5, 0.08, 0.05), '#1a1716', { x: 0.4, y: 4.08, z: 0.1 }),
      paint(new BoxGeometry(0.5, 0.08, 0.05), '#1a1716', { x: 0.4, y: 2.56, z: 0.1 }),
    )
  } else {
    parts.push(
      paint(new BoxGeometry(0.9, 0.7, 0.03), '#9e1f1f', { x: 0.4, y: 3.75, z: 0.1 }),
      paint(new BoxGeometry(0.3, 0.5, 0.03), '#9e1f1f', { x: 0.1, y: 3.15, z: 0.1 }),
      paint(new BoxGeometry(0.3, 0.5, 0.03), '#9e1f1f', { x: 0.7, y: 3.15, z: 0.1 }),
      paint(new BoxGeometry(0.9, 0.12, 0.05), '#e9c46a', { x: 0.4, y: 3.75, z: 0.1 }),
    )
  }
  return merge(parts)
}
