import { describe, expect, it } from 'vitest'
import { CHARGE_COLOR, CHARGING_COLOR, READY_COLOR } from './palette'

// sRGB → doğrusal → OKLab (Ottosson). Renk körlüğü Machado 2009, tam şiddet,
// doğrusal RGB'de.
type Rgb = [number, number, number]

function linear(hex: string): Rgb {
  return [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as Rgb
}

function oklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const VISION: Record<string, number[][] | null> = {
  normal: null,
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

function seen(hex: string, m: number[][] | null): Rgb {
  const c = linear(hex)
  if (!m) return c
  return m.map((row) => Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2]))) as Rgb
}

function deltaE(a: string, b: string, m: number[][] | null): number {
  const [x, y] = [oklab(seen(a, m)), oklab(seen(b, m))]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

describe('durum renkleri', () => {
  for (const [name, m] of Object.entries(VISION)) {
    it(`hazır, hamle kırmızısından ayrılır (${name}, ΔE_OK ≥ 0,15)`, () => {
      expect(deltaE(READY_COLOR, CHARGE_COLOR, m)).toBeGreaterThanOrEqual(0.15)
    })
    it(`hazır, şarjdan ayrılır (${name}, ΔE_OK ≥ 0,15)`, () => {
      expect(deltaE(READY_COLOR, CHARGING_COLOR, m)).toBeGreaterThanOrEqual(0.15)
    })
  }
})
