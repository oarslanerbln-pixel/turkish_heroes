import { describe, expect, it } from 'vitest'
import {
  approachAngle,
  calcFacing,
  calcSiegeState,
  countInCrescent,
  CRESCENT,
  executeStrike,
  HILAL_CONFIG,
  isInCrescent,
  resolvePhase,
  stepEnergy,
} from './hilalSystem'
import type { Enemy } from './types'

function enemy(id: number, x: number, z: number, discipline = 1, alive = true): Enemy {
  return { id, pos: { x, z }, vel: { x: 0, z: 0 }, alive, discipline }
}

const ORIGIN = { x: 0, z: 0 }
// facing = atan2(dx, dz): 0 → +z yönüne bakıyor.
const FACING_PLUS_Z = 0

describe('isInCrescent', () => {
  it('yayın önündeki, menzildeki noktayı içeride sayar', () => {
    expect(isInCrescent({ x: 0, z: 8 }, ORIGIN, FACING_PLUS_Z)).toBe(true)
  })

  it('iç yarıçapın dibindekini saymaz — üstüne binen düşman yaydan kaçar', () => {
    expect(isInCrescent({ x: 0, z: CRESCENT.innerRadius - 0.1 }, ORIGIN, FACING_PLUS_Z)).toBe(false)
  })

  it('dış yarıçapın ötesini saymaz', () => {
    expect(isInCrescent({ x: 0, z: CRESCENT.outerRadius + 0.1 }, ORIGIN, FACING_PLUS_Z)).toBe(false)
  })

  it('yay açısının dışındakini saymaz', () => {
    expect(isInCrescent({ x: 8, z: 0 }, ORIGIN, FACING_PLUS_Z)).toBe(false)
    expect(isInCrescent({ x: 0, z: -8 }, ORIGIN, FACING_PLUS_Z)).toBe(false)
  })
})

describe('approachAngle', () => {
  it('hedefe en fazla maxDelta kadar döner', () => {
    expect(approachAngle(0, 1, 0.25)).toBeCloseTo(0.25)
  })

  it('-PI/PI sarmasında kısa yoldan gider', () => {
    const next = approachAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.05)
    // Uzun yoldan gitseydi açı azalırdı; kısa yol sarmayı geçer.
    expect(Math.abs(next)).toBeGreaterThan(Math.PI - 0.1)
  })
})

describe('açı sarma', () => {
  it('atan2(sin, cos) ile aynı sonucu verir', () => {
    // approachAngle, fark maxDelta'dan küçükse hedefin sarılmış halini döndürür.
    for (let a = -20; a <= 20; a += 0.037) {
      const expected = Math.atan2(Math.sin(a), Math.cos(a))
      const actual = approachAngle(0, a, 100)
      // ±PI'de iki gösterim de doğru; mutlak değerle karşılaştır.
      expect(Math.abs(Math.abs(actual) - Math.abs(expected))).toBeLessThan(1e-9)
      if (Math.abs(expected) < Math.PI - 1e-9) expect(actual).toBeCloseTo(expected, 9)
    }
  })
})

describe('calcFacing', () => {
  /** Optimizasyondan önceki algoritma: her aday yön için tam sayım. */
  function referenceFacing(enemies: Enemy[], origin: { x: number; z: number }, current: number) {
    let bestFacing = current
    let bestCount = countInCrescent(enemies, origin, current)
    for (let i = 0; i < 48; i++) {
      const angle = -Math.PI + (i / 48) * Math.PI * 2
      const count = countInCrescent(enemies, origin, angle)
      if (count > bestCount + 2) {
        bestCount = count
        bestFacing = angle
      }
    }
    return bestCount > 0 ? bestFacing : null
  }

  it('optimize edilmiş tarama eski tam sayımla birebir aynı yönü seçer', () => {
    // Deterministik sözde-rastgele üreteç: test her çalışmada aynı düzenleri görür.
    let seed = 42
    const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)

    for (let trial = 0; trial < 300; trial++) {
      const enemies = Array.from({ length: 5 + Math.floor(rand() * 40) }, (_, i) =>
        enemy(i, (rand() - 0.5) * 40, (rand() - 0.5) * 40, rand(), rand() > 0.15),
      )
      const origin = { x: (rand() - 0.5) * 20, z: (rand() - 0.5) * 20 }
      const current = (rand() - 0.5) * Math.PI * 2
      const expected = referenceFacing(enemies, origin, current)
      if (expected === null) continue // menzilde kimse yok: kümeye bakma dalı, ayrı test

      expect(calcFacing(enemies, origin, current, null)).toBe(expected)
    }
  })

  it('menzilde kimse yoksa kümenin merkezine döner', () => {
    const facing = calcFacing([enemy(0, 30, 0)], ORIGIN, 0, { x: 30, z: 0 })
    expect(facing).toBeCloseTo(Math.PI / 2) // +x yönü: atan2(1, 0)
  })
})

describe('calcSiegeState', () => {
  it('hayatta kimse yoksa kuşatılabilirlik sıfır', () => {
    const s = calcSiegeState([enemy(0, 0, 0, 0, false)])
    expect(s.aliveCount).toBe(0)
    expect(s.vulnerability).toBe(0)
  })

  it('disiplinini koruyan küme ne kadar sıkışık olursa olsun kuşatılamaz', () => {
    const s = calcSiegeState([enemy(0, 0, 0, 1), enemy(1, 0.5, 0, 1)])
    expect(s.density).toBeGreaterThan(0.9)
    expect(s.vulnerability).toBe(0)
  })

  it('sıkışık ve disiplini bozuk küme kuşatılabilir', () => {
    const s = calcSiegeState([enemy(0, 0, 0, 0), enemy(1, 0.5, 0, 0)])
    expect(s.vulnerability).toBeGreaterThan(0.9)
  })

  // Regresyon: tek düşman için density 0'a sabitleniyordu ve oyun kazanılamıyordu.
  it('tek kalan düşman kuşatılabilir — son düşman softlock olmasın', () => {
    const s = calcSiegeState([enemy(0, 3, 3, 0)])
    expect(s.density).toBe(1)
    expect(s.vulnerability).toBe(1)
  })
})

describe('stepEnergy', () => {
  it('kuşatılabilirlikle dolar', () => {
    expect(stepEnergy(0, 1, 1)).toBeCloseTo(HILAL_CONFIG.energyFillRate)
  })

  it('taban altındaki kuşatılabilirlikte sızar, sıfırın altına inmez', () => {
    expect(stepEnergy(5, 0, 1)).toBe(0)
  })

  it('eşiği aşmaz', () => {
    expect(stepEnergy(99, 1, 10)).toBe(HILAL_CONFIG.strikeThreshold)
  })

  // Regresyon: dolu enerji sızınca "VUR" yazan buton sessizce işlevsiz kalıyordu.
  it('dolduktan sonra düşman toparlansa da sızmaz', () => {
    expect(stepEnergy(HILAL_CONFIG.strikeThreshold, 0, 1)).toBe(HILAL_CONFIG.strikeThreshold)
  })
})

describe('executeStrike', () => {
  it('yaydakileri düşürür, kalanların disiplinini sıfırlar (irkilme)', () => {
    const enemies = [enemy(0, 0, 8, 0), enemy(1, 0, -8, 0.2)]
    const kills = executeStrike(enemies, ORIGIN, FACING_PLUS_Z)

    expect(kills).toBe(1)
    expect(enemies[0].alive).toBe(false)
    expect(enemies[1].alive).toBe(true)
    expect(enemies[1].discipline).toBe(1)
  })

  it('ölü düşmanı tekrar saymaz', () => {
    const enemies = [enemy(0, 0, 8, 0, false)]
    expect(executeStrike(enemies, ORIGIN, FACING_PLUS_Z)).toBe(0)
    expect(countInCrescent(enemies, ORIGIN, FACING_PLUS_Z)).toBe(0)
  })
})

describe('resolvePhase', () => {
  it('vuruş her şeyin önündedir', () => {
    expect(resolvePhase({ vulnerability: 1, isRetreating: true, strikeTimer: 0.5 })).toBe('strike')
  })

  it('eşiği geçen kuşatılabilirlik "gather"', () => {
    expect(
      resolvePhase({ vulnerability: HILAL_CONFIG.gatherThreshold, isRetreating: true, strikeTimer: 0 }),
    ).toBe('gather')
  })

  it('kaçış varsa "retreat", yoksa "idle"', () => {
    expect(resolvePhase({ vulnerability: 0, isRetreating: true, strikeTimer: 0 })).toBe('retreat')
    expect(resolvePhase({ vulnerability: 0, isRetreating: false, strikeTimer: 0 })).toBe('idle')
  })
})
