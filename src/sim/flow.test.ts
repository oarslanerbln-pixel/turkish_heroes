import { describe, expect, it } from 'vitest'
import { canEnter } from './flow'

describe('akış geçişleri', () => {
  it('savaşa yalnızca menüden ya da savaş ekranlarından girilir', () => {
    expect(canEnter('menu', 'playing')).toBe(true)
    expect(canEnter('paused', 'playing')).toBe(true)
    expect(canEnter('outcome', 'playing')).toBe(true)
    expect(canEnter('playing', 'playing')).toBe(false)
  })

  it('mola yalnızca savaş sürerken; sonuç yalnızca savaştan', () => {
    expect(canEnter('playing', 'paused')).toBe(true)
    expect(canEnter('menu', 'paused')).toBe(false)
    expect(canEnter('outcome', 'paused')).toBe(false)
    expect(canEnter('playing', 'outcome')).toBe(true)
    expect(canEnter('paused', 'outcome')).toBe(false)
    expect(canEnter('menu', 'outcome')).toBe(false)
  })

  it('menüye her savaş ekranından dönülür', () => {
    for (const from of ['playing', 'paused', 'outcome'] as const) expect(canEnter(from, 'menu')).toBe(true)
    expect(canEnter('menu', 'menu')).toBe(false)
  })
})
