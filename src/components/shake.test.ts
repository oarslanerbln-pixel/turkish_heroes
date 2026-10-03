import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { HILAL_CONFIG } from '../mechanics/hilalSystem'
import { HURT_CONFIG } from '../sim/hurt'
import { resetWorld, world } from '../sim/world'
import { shakeOffset } from './shake'

describe('sarsıntı (K3)', () => {
  it('vuruşta yayın kapandığı yönde salınır, yanlara kaymaz', () => {
    resetWorld()
    world.strikeFacing = Math.PI / 2 // +x
    const out = new Vector3()
    let peak = 0
    for (let t = 0; t < HILAL_CONFIG.strikeDuration; t += 1 / 60) {
      world.strikeTimer = HILAL_CONFIG.strikeDuration - t
      shakeOffset(world, false, out)
      expect(Math.abs(out.z)).toBeLessThan(1e-9)
      peak = Math.max(peak, out.x)
    }
    // İlk hareket vuruş yönüne: tepme.
    world.strikeTimer = HILAL_CONFIG.strikeDuration - 1 / 60
    expect(shakeOffset(world, false, out).x).toBeGreaterThan(0)
    expect(peak).toBeGreaterThan(0.1)
  })

  it('aynı anda aynı kaydırma: rastgele değil', () => {
    resetWorld()
    world.strikeTimer = 0.5
    world.hurtTimer = HURT_CONFIG.shake / 2
    const a = shakeOffset(world, false, new Vector3())
    const b = shakeOffset(world, false, new Vector3())
    expect(a.equals(b)).toBe(true)
    expect(a.length()).toBeGreaterThan(0)
  })

  it('sarsıntı bitince kaydırma yok', () => {
    resetWorld()
    expect(shakeOffset(world, false, new Vector3()).length()).toBe(0)
  })
})
