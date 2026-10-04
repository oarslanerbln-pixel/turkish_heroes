import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from './gameStore'
import { haptic } from '../audio/sfx'
import { Vector3 } from 'three'
import { shakeOffset } from '../components/shake'
import { resetWorld, world } from '../sim/world'

const shake = (reduced: boolean) => shakeOffset(world, reduced, new Vector3()).length()

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
    expect(shake(false)).toBeGreaterThan(0)
    expect(shake(true)).toBe(0)
    world.strikeTimer = 0
    expect(shake(false)).toBeGreaterThan(0)
    expect(shake(true)).toBe(0)
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
