import { describe, expect, it } from 'vitest'
import { newBattleWatch, resetWorld, simDelta, SLOWMO_SCALE, stepTime, world } from './world'

describe('savaş nesli', () => {
  it('her yeniden başlatmada artar, başlamış savaş korunur', () => {
    world.started = true
    const before = world.generation
    resetWorld()
    expect(world.generation).toBe(before + 1)
    expect(world.started).toBe(true)
  })

  it('bekçi yeni savaşı her görsel için bir kez bildirir', () => {
    const camera = newBattleWatch()
    const arrows = newBattleWatch()
    expect(camera()).toBe(false)
    resetWorld()
    expect(camera()).toBe(true)
    expect(camera()).toBe(false)
    expect(arrows()).toBe(true)
  })
})

describe('zaman ölçeği', () => {
  const STEP = 1 / 60
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += STEP) stepTime(STEP)
  }

  it('ağır çekime rampayla girer, süre bitince rampayla çıkar', () => {
    resetWorld()
    world.slowmo = 0.9
    stepTime(STEP)
    // Tek karede üçte bire düşmez.
    expect(world.timeScale).toBeGreaterThan(0.7)
    run(0.4)
    expect(world.timeScale).toBeCloseTo(SLOWMO_SCALE, 2)
    run(0.5)
    expect(world.slowmo).toBe(0)
    // Çıkış girişten yavaş: süre biter bitmez tam hıza dönmez.
    expect(world.timeScale).toBeLessThan(0.9)
    run(1.5)
    expect(world.timeScale).toBe(1)
  })

  it('simülasyon adımı ölçekle küçülür; donmada ve molada sıfırdır', () => {
    resetWorld()
    world.timeScale = 0.5
    expect(simDelta(STEP)).toBeCloseTo(STEP * 0.5)
    // Arka plandan dönen şişkin kare sınırlanır.
    expect(simDelta(1)).toBeCloseTo(0.05)
    world.hitstop = 0.1
    expect(simDelta(STEP)).toBe(0)
    world.hitstop = 0
    world.paused = true
    expect(simDelta(STEP)).toBe(0)
    world.paused = false
  })

  it('donma sürerken ağır çekim erimez', () => {
    resetWorld()
    world.hitstop = 0.05
    world.slowmo = 0.45
    run(0.04)
    expect(world.slowmo).toBe(0.45)
    expect(world.timeScale).toBe(1)
  })
})
