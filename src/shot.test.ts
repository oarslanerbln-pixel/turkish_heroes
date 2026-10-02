import { describe, expect, it } from 'vitest'
import { parseShot } from './shot'

describe('çekim anı', () => {
  it('saniyeyi ya da savaş sonunu okur', () => {
    expect(parseShot('?shot=6')).toBe(6)
    expect(parseShot('?seed=1071&shot=104.5')).toBe(104.5)
    expect(parseShot('?shot=end')).toBe('end')
  })

  it('geçersizse null: çekim kipi açılmaz', () => {
    for (const search of ['', '?shot=', '?shot=-1', '?shot=1e3', '?shot=1000', '?shot=6.125', '?shot=son']) {
      expect(parseShot(search)).toBeNull()
    }
  })
})
