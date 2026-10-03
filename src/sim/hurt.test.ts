import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../audio/sfx', () => ({ play: vi.fn(), haptic: vi.fn() }))

import { haptic, play } from '../audio/sfx'
import { HURT_CONFIG, stepHurt } from './hurt'
import { resetWorld, world } from './world'

const DT = 1 / 60

/** sn saniye boyunca saniyede dps hasar; kaç yara tepkisi verildi. */
function bleed(dps: number, seconds: number): number {
  let n = 0
  for (let i = 0; i < Math.round(seconds / DT); i++) if (stepHurt(world, dps * DT, DT)) n++
  return n
}

describe('yara geri bildirimi', () => {
  beforeEach(() => {
    resetWorld()
    world.events.length = 0
    vi.mocked(play).mockClear()
    vi.mocked(haptic).mockClear()
  })

  it('hasarda ses, titreşim ve olay verir', () => {
    expect(bleed(8, 1)).toBeGreaterThanOrEqual(1)
    expect(vi.mocked(play).mock.calls.filter(([s]) => s === 'hurt').length).toBeGreaterThanOrEqual(1)
    expect(vi.mocked(haptic).mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(world.events.some((e) => e.type === 'hurt')).toBe(true)
    expect(world.hurtTimer).toBeGreaterThan(0)
  })

  it('hasar yoksa tepki yok', () => {
    expect(bleed(0, 2)).toBe(0)
    expect(play).not.toHaveBeenCalled()
    expect(haptic).not.toHaveBeenCalled()
  })

  it('sürekli temasta vızıltıya dönmez: aralık en az cooldown', () => {
    // En kalabalık temas: tek karede eşik aşılır, yine de sıklık sınırlı.
    const n = bleed(200, 3)
    expect(n).toBeLessThanOrEqual(Math.ceil(3 / HURT_CONFIG.cooldown))
    expect(n).toBeGreaterThanOrEqual(Math.floor(3 / HURT_CONFIG.cooldown) - 1)
  })

  it('eşik altındaki hasar birikir, kaybolmaz', () => {
    stepHurt(world, HURT_CONFIG.step / 2, DT)
    expect(play).not.toHaveBeenCalled()
    expect(stepHurt(world, HURT_CONFIG.step / 2, DT)).toBe(true)
  })
})
