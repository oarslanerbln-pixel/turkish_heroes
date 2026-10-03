import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from './gameStore'
import { haptic } from '../audio/sfx'
import { shakeStrength } from '../components/shake'
import { resetWorld, world } from '../sim/world'

describe('hareketi azalt', () => {
  afterEach(() => {
    useGameStore.setState({ reducedMotion: false })
    vi.unstubAllGlobals()
  })

  it('titreşimi kapatır, kalkınca geri açar', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    useGameStore.setState({ reducedMotion: true })
    haptic(40)
    expect(vibrate).not.toHaveBeenCalled()
    useGameStore.setState({ reducedMotion: false })
    haptic(40)
    expect(vibrate).toHaveBeenCalledWith(40)
  })

  it('vuruş ve yara sarsıntısı hareketi azaltta sıfır', () => {
    resetWorld()
    world.strikeTimer = 0.2
    world.hurtTimer = 0.1
    expect(shakeStrength(world, false)).toBeGreaterThan(0)
    expect(shakeStrength(world, true)).toBe(0)
    world.strikeTimer = 0
    expect(shakeStrength(world, false)).toBeGreaterThan(0)
    expect(shakeStrength(world, true)).toBe(0)
  })

  it('oyuncu titreşimi kapatınca titreşmez', async () => {
    const { setHapticsEnabled } = await import('../audio/sfx')
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    setHapticsEnabled(false)
    haptic(40)
    expect(vibrate).not.toHaveBeenCalled()
    setHapticsEnabled(true)
    haptic(40)
    expect(vibrate).toHaveBeenCalledTimes(1)
  })
})
