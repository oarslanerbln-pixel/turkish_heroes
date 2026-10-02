import { describe, expect, it } from 'vitest'
import { newBattleWatch, resetWorld, world } from './world'

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
