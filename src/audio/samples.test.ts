// Ses örnekleri: dosyalar, lisans kaydı ve çeşit seçimi (bkz. samples.ts).

import { describe, expect, it } from 'vitest'
import CREDITS from '../../CREDITS.md?raw'
import { pickVariant, SAMPLE_FILES } from './samples'

/** public/audio'daki dosyalar; Vite derleme anında listeler. */
const onDisk = Object.keys(import.meta.glob('../../public/audio/*', { query: '?url' })).map(
  (path) => path.slice(path.lastIndexOf('/') + 1),
)
const listed = Object.values(SAMPLE_FILES).flat()

/** Sabit tohumlu üreteç: test her çalışta aynı diziyi görür. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32
    return s / 2 ** 32
  }
}

describe('ses örnekleri — dosyalar', () => {
  it('listelenen her dosya public/audio altında var', () => {
    for (const file of listed) expect(onDisk, file).toContain(file)
  })

  it('public/audio altında listede olmayan dosya yok (önbellek boşa büyümesin)', () => {
    expect([...onDisk].sort()).toEqual([...listed].sort())
  })

  it('her dosyanın kaynağı ve lisansı CREDITS.md’de yazılı', () => {
    for (const file of listed) expect(CREDITS, file).toContain(file)
  })
})

describe('ses örnekleri — çeşit seçimi', () => {
  it('tek çeşitli bankada hep o çeşit', () => {
    const rand = seeded(1)
    expect(pickVariant(1, -1, rand)).toBe(0)
    expect(pickVariant(1, 0, rand)).toBe(0)
  })

  it('sonuç her zaman bankanın içinde', () => {
    const rand = seeded(2)
    for (const count of [2, 3, 5]) {
      let last = -1
      for (let i = 0; i < 200; i++) {
        last = pickVariant(count, last, rand)
        expect(Number.isInteger(last)).toBe(true)
        expect(last).toBeGreaterThanOrEqual(0)
        expect(last).toBeLessThan(count)
      }
    }
  })

  it('aynı çeşit arka arkaya iki kez çalmaz', () => {
    const rand = seeded(3)
    for (const count of [2, 3, 5]) {
      let last = pickVariant(count, -1, rand)
      for (let i = 0; i < 200; i++) {
        const next = pickVariant(count, last, rand)
        expect(next).not.toBe(last)
        last = next
      }
    }
  })

  it('hiçbir çeşit unutulmaz', () => {
    const rand = seeded(4)
    const seen = new Set<number>()
    let last = -1
    for (let i = 0; i < 50; i++) {
      last = pickVariant(5, last, rand)
      seen.add(last)
    }
    expect(seen.size).toBe(5)
  })
})
