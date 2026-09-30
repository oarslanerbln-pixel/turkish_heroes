import { describe, expect, it } from 'vitest'
import { GUST_GLSL, GUST_SPEED, WIND_DIR, windGust } from './wind'

describe('rüzgâr', () => {
  it('esinti 0–1 aralığında ve hem durgunluk hem sert esinti görülür', () => {
    let min = 1
    let max = 0
    for (let t = 0; t < 120; t += 0.05) {
      const g = windGust(t)
      expect(g).toBeGreaterThanOrEqual(0)
      expect(g).toBeLessThanOrEqual(1)
      min = Math.min(min, g)
      max = Math.max(max, g)
    }
    expect(min).toBeLessThan(0.1)
    expect(max).toBeGreaterThan(0.8)
  })

  it('esinti rüzgâr yönünde GUST_SPEED hızla yürür', () => {
    const d = 12
    const later = d / GUST_SPEED
    for (const t of [3, 17.5, 41]) {
      expect(windGust(t + later, 5 + WIND_DIR.x * d, -2 + WIND_DIR.z * d)).toBeCloseTo(
        windGust(t, 5, -2),
        10,
      )
    }
  })

  it('yön birim vektör, GLSL karşılığı tanımlı', () => {
    expect(Math.hypot(WIND_DIR.x, WIND_DIR.z)).toBeCloseTo(1, 10)
    expect(GUST_GLSL).toContain('float windGust(float t, vec2 p)')
    expect(GUST_GLSL).not.toContain('NaN')
  })
})
