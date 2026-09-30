import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { isPlaying, simDelta, world } from '../sim/world'

const game = () => useGameStore.getState()

describe('mola', () => {
  beforeEach(() => {
    game().backToMenu()
  })

  it('başlangıç ekranında mola yok', () => {
    game().pause(true)
    expect(world.paused).toBe(false)
    expect(game().paused).toBe(false)
  })

  it('simülasyonu tamamen dondurur, DEVAM sürdürür', () => {
    game().start()
    expect(isPlaying()).toBe(true)
    game().pause(true)
    expect(game().paused).toBe(true)
    expect(isPlaying()).toBe(false)
    expect(simDelta(0.016)).toBe(0)
    game().resume()
    expect(isPlaying()).toBe(true)
    expect(simDelta(0.016)).toBeCloseTo(0.016)
  })

  it('molada basılan vuruş birikmez', () => {
    game().start()
    game().pause(false)
    game().requestStrike()
    game().resume()
    expect(world.strikeRequested).toBe(false)
  })

  it('moladan yeniden başlatma molayı kapatır, savaş sürer', () => {
    game().start()
    game().pause(false)
    game().restart()
    expect(world.paused).toBe(false)
    expect(game().paused).toBe(false)
    expect(isPlaying()).toBe(true)
  })

  it('sonuç ekranında mola açılmaz', () => {
    game().start()
    world.outcome = 'defeat'
    game().pause(true)
    expect(world.paused).toBe(false)
  })
})
