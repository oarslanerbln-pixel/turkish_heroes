// Bozkır arazisinin şekli ve rengi — saf fonksiyonlar, çizimden bağımsız.
//
// Arena bilerek dümdüz: birimler y = 0 düzleminde yürüyor; zeminde bir tümsek
// olsaydı atlar havada ya da toprağın içinde görünürdü. Arenanın dışında arazi
// yükselip tepelere dönüşüyor. Kamera 45° aşağı baktığı için ekranın üst kenarı
// yaklaşık 60 birim öteyi görüyor: tepeler savaş alanını bir vadi gibi çerçeveler.

import { Color } from 'three'
import { passHalfWidth } from '../../mechanics/pass'

/** Bu yarıçapın içinde yükseklik tam sıfır (oyuncu sınırı 29'da). */
export const FLAT_RADIUS = 34

/** Arena sınırını gösteren aşınmış yolun yarıçapı. */
export const TRACK_RADIUS = 29.4

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Yumuşak değer gürültüsü, 0–1 arası; aynı girdi her zaman aynı sonucu verir. */
export function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi)
  const b = hash(xi + 1, zi)
  const c = hash(xi, zi + 1)
  const d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** Üç oktavlı fraktal gürültü, yaklaşık 0–1. */
export function fbm(x: number, z: number): number {
  return (
    valueNoise(x, z) * 0.57 +
    valueNoise(x * 2.03 + 17, z * 2.03 - 9) * 0.29 +
    valueNoise(x * 4.1 - 5, z * 4.1 + 13) * 0.14
  )
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Geçidin (Miryokefalon) duvarları: taban kenarından 3,5 birimde dikleşip
 * 7–14 birime yükselir. Taban (|x| ≤ yarı genişlik) tam sıfır: birimler y = 0'da
 * yürümeye devam eder, yalnızca yamaçtaki kollar duvarın üstünde durur.
 */
export function passWallHeight(x: number, z: number): number {
  const edge = passHalfWidth(z)
  const rise = smoothstep(edge, edge + 3.5, Math.abs(x))
  if (rise === 0) return 0
  return rise * (7 + 7 * fbm(x * 0.09 + 3.1, z * 0.09 - 5.7))
}

/**
 * Arazinin (x, z) noktasındaki yüksekliği. Arenada tam sıfır; geçitte
 * (`pass`) taban dışı duvar.
 */
export function terrainHeight(x: number, z: number, pass = false): number {
  const rise = smoothstep(FLAT_RADIUS, 110, Math.hypot(x, z))
  const hills = rise === 0 ? 0 : rise * (5 + 16 * fbm(x * 0.025 + 7.3, z * 0.025 - 2.1))
  return pass ? Math.max(hills, passWallHeight(x, z)) : hills
}

// Renkler three'nin çalışma uzayında (doğrusal) karıştırılıyor; Color hex'i
// kendisi dönüştürüyor.
const EARTH = new Color('#5c4428')
const STRAW = new Color('#98793f')
const HILL = new Color('#6b683c')
const TRACK = new Color('#42301d')
const ROCK = new Color('#6e6254')

/** (x, z) noktasının zemin rengini `out` içine yazar; geçitte duvarlar kaya. */
export function terrainColor(x: number, z: number, out: Color, pass = false): Color {
  const r = Math.hypot(x, z)
  // Kuru ot öbekleri ile çıplak toprak lekeleri.
  out.copy(EARTH).lerp(STRAW, smoothstep(0.35, 0.72, fbm(x * 0.08, z * 0.08)))
  // Tepeler biraz daha yeşilimsi: derinlik hissi.
  out.lerp(HILL, smoothstep(FLAT_RADIUS, 75, r) * 0.6)
  if (pass) {
    // Geçitte sınırı duvarlar gösterir: çevre yolu yok, yamaçlar kaya.
    out.lerp(ROCK, smoothstep(0.4, 3, passWallHeight(x, z)) * 0.85)
  } else {
    // Aşınmış çevre yolu: sınırı bir çizgi yerine arazinin kendisi gösterir.
    out.lerp(TRACK, (1 - smoothstep(0, 1.8, Math.abs(r - TRACK_RADIUS))) * 0.55)
  }
  // İnce ayrıntı: aynı renkte geniş alanlar plastik görünür.
  out.multiplyScalar(0.9 + 0.2 * valueNoise(x * 0.7, z * 0.7))
  return out
}

// Üreteç simülasyonla ortak (bot testleri de tohumlu); süsleme buradan alıyor.
export { mulberry32 } from '../../mechanics/random'
