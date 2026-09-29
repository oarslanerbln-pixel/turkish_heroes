import { describe, expect, it } from 'vitest'
import { Color } from 'three'
import { ENEMY_CONFIG } from '../../mechanics/enemySim'
import { FLAT_RADIUS, fbm, mulberry32, terrainColor, terrainHeight, valueNoise } from './terrainShape'

describe('arazi', () => {
  // Birimler y = 0'da yürüyor: arenada en ufak bir tümsek atları havada bırakır.
  it('oyun alanının tamamı dümdüz', () => {
    const limit = ENEMY_CONFIG.arenaRadius + 2
    expect(FLAT_RADIUS).toBeGreaterThan(limit)
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      for (let r = 0; r <= limit; r += 1.5) {
        expect(terrainHeight(Math.cos(a) * r, Math.sin(a) * r)).toBe(0)
      }
    }
  })

  it('arenanın dışında tepeler yükselir', () => {
    expect(terrainHeight(90, 0)).toBeGreaterThan(4)
    expect(terrainHeight(0, -100)).toBeGreaterThan(terrainHeight(0, -45))
  })

  it('gürültü belirlenimci ve 0–1 aralığında', () => {
    for (let i = 0; i < 200; i++) {
      const v = valueNoise(i * 0.37, i * -0.61)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      expect(valueNoise(i * 0.37, i * -0.61)).toBe(v)
    }
    expect(fbm(3.2, 7.1)).toBe(fbm(3.2, 7.1))
  })

  it('renk her noktada geçerli', () => {
    const c = new Color()
    for (let i = 0; i < 100; i++) {
      terrainColor(i * 1.3 - 60, i * -0.9 + 40, c)
      for (const v of [c.r, c.g, c.b]) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThan(0)
      }
    }
  })

  it('sözde-rastgele üreteç aynı tohumla aynı diziyi verir', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    for (let i = 0; i < 10; i++) expect(a()).toBe(b())
  })
})
