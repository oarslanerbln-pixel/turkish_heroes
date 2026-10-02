import { describe, expect, it } from 'vitest'
import { parseSeed } from './random'

describe('URL tohumu', () => {
  it('sayıyı okur', () => {
    expect(parseSeed('?seed=1071')).toBe(1071)
    expect(parseSeed('?commander=alp-arslan&seed=0')).toBe(0)
  })

  it('32 bitin dışını sarar, mulberry32 de böyle okur', () => {
    expect(parseSeed('?seed=4294967296')).toBe(0)
  })

  it('geçersizse null: rastgele tohuma düşülür', () => {
    for (const search of ['', '?seed=', '?seed=-5', '?seed=1.5', '?seed=abc', '?seed=12345678901']) {
      expect(parseSeed(search)).toBeNull()
    }
  })
})
