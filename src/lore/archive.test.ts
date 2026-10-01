// Bilgi Hazinesi: kilitli notun metni hiçbir yoldan sızmasın; sayaçlar ve
// varsayılan seçim doğru olsun.

import { describe, expect, it } from 'vitest'
import { COMMANDERS } from '../mechanics/scenario'
import { archiveCount, archiveOf, defaultEntry, roman } from './archive'
import { LORE, loreOf } from './lore'

describe('Bilgi Hazinesi', () => {
  it('kilitli notun başlığı ve ipucu görünür, metni ve kaynağı hiç yok', () => {
    for (const c of COMMANDERS) {
      for (const e of archiveOf(c.id, [])) {
        expect(e.earned).toBe(false)
        expect(e.title.length).toBeGreaterThan(0)
        expect('text' in e, e.id).toBe(false)
        expect('source' in e, e.id).toBe(false)
        if (!e.earned) expect(e.hint.length).toBeGreaterThan(0)
        // Metnin herhangi bir parçası da başka bir alana karışmamış.
        const card = LORE.find((x) => x.id === e.id)!
        expect(JSON.stringify(e)).not.toContain(card.text.slice(0, 24))
      }
    }
  })

  it('kazanılan notun metni ve kaynağı tam', () => {
    const [first] = loreOf('alp-arslan')
    const entry = archiveOf('alp-arslan', [first.id])[0]
    expect(entry.earned).toBe(true)
    if (entry.earned) {
      expect(entry.text).toBe(first.text)
      expect(entry.source).toBe(first.source)
    }
  })

  it('notlar anlatı sırasıyla numaralı; başka komutanın notu karışmaz', () => {
    for (const c of COMMANDERS) {
      const entries = archiveOf(c.id, LORE.map((x) => x.id))
      expect(entries.map((e) => e.id)).toEqual(loreOf(c.id).map((x) => x.id))
      expect(entries.map((e) => e.no)).toEqual(entries.map((_, i) => i + 1))
    }
  })

  it('sayaç komutan başına ve bütün hazine için', () => {
    const earned = ['sahte-ricat', 'onluk', 'taciz'] as const
    expect(archiveCount(earned, 'metehan')).toEqual({ earned: 2, total: loreOf('metehan').length })
    expect(archiveCount(earned, 'kilicarslan')).toEqual({ earned: 0, total: loreOf('kilicarslan').length })
    expect(archiveCount(earned)).toEqual({ earned: 3, total: LORE.length })
  })

  it('açılışta komutanın en son kazanılan notu seçili, hiç yoksa ilki', () => {
    expect(defaultEntry('metehan', ['onluk', 'taciz', 'sahte-ricat'])).toBe('sahte-ricat')
    expect(defaultEntry('alp-arslan', ['onluk', 'taciz', 'sahte-ricat'])).toBe('taciz')
    expect(defaultEntry('kilicarslan', ['onluk'])).toBe(loreOf('kilicarslan')[0].id)
  })

  it('Roma rakamları', () => {
    expect([1, 2, 3, 4, 5, 9, 14].map(roman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'IX', 'XIV'])
  })
})
