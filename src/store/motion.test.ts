import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from './gameStore'
import { haptic } from '../audio/sfx'

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
})
