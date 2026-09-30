import { describe, expect, it } from 'vitest'
import { DUSK_FALL, DUSK_HOLD, DUSK_RISE, INTRO_TIME, shotDone, shotWeight } from './cameraShots'

describe('sinematik çekimler', () => {
  it('açılış tam sinematik başlar, taktik duruşta biter', () => {
    expect(shotWeight('intro', 0)).toBe(1)
    expect(shotWeight('intro', 0.4)).toBe(1)
    expect(shotWeight('intro', INTRO_TIME / 2)).toBeGreaterThan(0)
    expect(shotWeight('intro', INTRO_TIME / 2)).toBeLessThan(1)
    expect(shotWeight('intro', INTRO_TIME)).toBe(0)
    expect(shotDone('intro', INTRO_TIME)).toBe(true)
  })

  it('gün batımı taktikten başlar, alçalır, bekler ve geri döner', () => {
    expect(shotWeight('dusk', 0)).toBe(0)
    expect(shotWeight('dusk', DUSK_RISE)).toBe(1)
    expect(shotWeight('dusk', DUSK_RISE + DUSK_HOLD / 2)).toBe(1)
    const end = DUSK_RISE + DUSK_HOLD + DUSK_FALL
    expect(shotWeight('dusk', end)).toBe(0)
    expect(shotDone('dusk', end - 0.01)).toBe(false)
    expect(shotDone('dusk', end)).toBe(true)
  })

  it('ağırlık sıçramaz: ardışık karelerde küçük adımlarla değişir', () => {
    for (const cue of ['intro', 'dusk'] as const) {
      let prev = shotWeight(cue, 0)
      for (let t = 1 / 60; t < 6; t += 1 / 60) {
        const w = shotWeight(cue, t)
        expect(Math.abs(w - prev)).toBeLessThan(0.05)
        prev = w
      }
    }
  })
})
