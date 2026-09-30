// Bozkır rüzgârı: çimenin eğilmesi, tozun sürüklenmesi ve rüzgâr sesi aynı
// esintiyi izlesin diye tek yerde. Esinti alan boyunca rüzgâr yönünde yürür:
// bir noktadaki şiddet, rüzgârın üst tarafındaki noktanın biraz önceki şiddeti.
// Aynı formülün GLSL karşılığı (GUST_GLSL) çimen gölgelendiricisinde çalışır.

/** Rüzgârın estiği yön (birim vektör, XZ): kamera açısından sağa ve öne. */
export const WIND_DIR = { x: 0.8, z: 0.6 }

/** Esinti cephesinin alan boyunca ilerleme hızı (birim/sn). */
export const GUST_SPEED = 9

/** Tozun rüzgârla sürüklenme hızı: durgun + esintiyle artan (birim/sn). */
export const WIND_DRIFT_CALM = 0.8
export const WIND_DRIFT_GUST = 2.4

/**
 * Üç yavaş sinüs (~20, ~9 ve ~3 sn): periyotları birbirinin katı olmadığı
 * için örüntü kısa sürede tekrar etmiyor.
 */
const WAVES = [
  { amp: 0.5, freq: 0.31, phase: 0 },
  { amp: 0.3, freq: 0.73, phase: 1.7 },
  { amp: 0.2, freq: 1.9, phase: 0.4 },
] as const

/** > 1: esintiler kısa, durgunluk uzun. */
const SHARPNESS = 1.6

/** 0–1 esinti şiddeti, t anında (x, z) noktasında. */
export function windGust(t: number, x = 0, z = 0): number {
  const s = t - (x * WIND_DIR.x + z * WIND_DIR.z) / GUST_SPEED
  let raw = 0
  for (const w of WAVES) raw += w.amp * Math.sin(s * w.freq + w.phase)
  return Math.pow(Math.max(0, 0.5 + 0.5 * raw), SHARPNESS)
}

const f = (n: number) => n.toFixed(4)

/** `float windGust(float t, vec2 p)` — windGust ile birebir aynı formül. */
export const GUST_GLSL = [
  'float windGust(float t, vec2 p) {',
  `  float s = t - dot(p, vec2(${f(WIND_DIR.x)}, ${f(WIND_DIR.z)})) / ${f(GUST_SPEED)};`,
  `  float raw = ${WAVES.map((w) => `${f(w.amp)} * sin(s * ${f(w.freq)} + ${f(w.phase)})`).join(' + ')};`,
  `  return pow(max(0.0, 0.5 + 0.5 * raw), ${f(SHARPNESS)});`,
  '}',
].join('\n')
