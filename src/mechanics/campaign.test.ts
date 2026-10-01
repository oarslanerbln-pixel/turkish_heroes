// Sefer haritasının kuralları (bkz. campaign.ts).

import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_NODES,
  campaignFrontier,
  MAP_HEIGHT,
  MAP_WIDTH,
  segmentPath,
  type NodeProgress,
} from './campaign'
import { COMMANDERS, commanderInfo, type CommanderId } from './scenario'

/** Yol sırasıyla ilerleme; verilmeyen alanlar hiç oynanmamış savaş. */
function progress(...nodes: Partial<NodeProgress>[]): NodeProgress[] {
  return CAMPAIGN_NODES.map((n, i) => ({
    id: n.id,
    available: false,
    won: false,
    stars: 0,
    fresh: false,
    ...nodes[i],
  }))
}

const won = (stars: number): Partial<NodeProgress> => ({ available: true, won: true, stars })
const open: Partial<NodeProgress> = { available: true }

describe('sefer haritası — yerleşim', () => {
  it('yol komutan sırasını izler; her savaş bir öncekinin zaferiyle açılır', () => {
    expect(CAMPAIGN_NODES.map((n) => n.id)).toEqual(COMMANDERS.map((c) => c.id))
    CAMPAIGN_NODES.forEach((n, i) => {
      const prev: CommanderId | undefined = CAMPAIGN_NODES[i - 1]?.id
      expect(commanderInfo(n.id).unlockedBy).toBe(prev)
    })
  })

  it('düğümler çizim alanında, yukarıdan aşağı ve doğudan batıya dizili', () => {
    for (const n of CAMPAIGN_NODES) {
      expect(n.x).toBeGreaterThan(0)
      expect(n.x).toBeLessThan(MAP_WIDTH)
      expect(n.y).toBeGreaterThan(0)
      expect(n.y).toBeLessThan(MAP_HEIGHT)
    }
    for (let i = 1; i < CAMPAIGN_NODES.length; i++) {
      // ↑/↓ haritada da aynı yöne gitsin; yol batıya iner.
      expect(CAMPAIGN_NODES[i].y).toBeGreaterThan(CAMPAIGN_NODES[i - 1].y)
      expect(CAMPAIGN_NODES[i].x).toBeLessThan(CAMPAIGN_NODES[i - 1].x)
    }
  })

  it('yol parçası bir düğümden başlar, ötekinde biter', () => {
    const [a, b] = CAMPAIGN_NODES
    const d = segmentPath(a, b)
    expect(d.startsWith(`M ${a.x} ${a.y} `)).toBe(true)
    expect(d.endsWith(` ${b.x} ${b.y}`)).toBe(true)
  })
})

describe('sefer haritası — sancak', () => {
  it('ilk açılışta sancak ilk savaşta', () => {
    expect(campaignFrontier(progress(open))).toBe('metehan')
  })

  it('önce ilerleme: kazanılmamış ilk açık savaş', () => {
    expect(campaignFrontier(progress(won(3), open))).toBe('alp-arslan')
    // Yıldızı az olan geride kalsa da önce yeni savaş.
    expect(campaignFrontier(progress(won(1), won(1), open))).toBe('kilicarslan')
  })

  it('URL ile ileri atlanınca sancak geride kalan savaşta durur', () => {
    expect(campaignFrontier(progress(open, {}, open))).toBe('metehan')
  })

  it('hepsi kazanılınca ustalık: yıldızı en az olan, eşitlikte yolda önce gelen', () => {
    expect(campaignFrontier(progress(won(3), won(1), won(2)))).toBe('alp-arslan')
    expect(campaignFrontier(progress(won(2), won(3), won(2)))).toBe('metehan')
  })

  it('her savaş tam yıldızsa sefer tamam: sancak yok', () => {
    expect(campaignFrontier(progress(won(3), won(3), won(3)))).toBeNull()
  })
})
