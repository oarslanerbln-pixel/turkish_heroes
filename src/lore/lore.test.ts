// Tarih notları: kurallar ve erişilebilirlik.
//
// Erişilebilirlik tasarımın asıl sözü: kazanılamayan kart, koleksiyonda
// sonsuza dek kilitli duran bir boşluktur ve oyuncuya "eksiksin" der. Her
// kart, oyunda gerçekten yapılabilen bir hamleyle açılmalı — botlar oyundaki
// olayların aynısını üretir, özet aynı applyEvent'le kurulur.

import { describe, expect, it } from 'vitest'
import { ambushWings, baiterBot, blockerBot, provokerBot, runBattle, withWings } from '../mechanics/battleBots'
import { MIRYOKEFALON } from '../mechanics/corps'
import { PASS } from '../mechanics/pass'
import { COMMANDERS, type CommanderId } from '../mechanics/scenario'
import { kiter, runWaves, SKILLS } from '../mechanics/waveBots'
import { applyEvent, startSummary, type BattleSummary, type TelemetryEvent } from '../telemetry/summary'
import { LORE, LORE_LIMITS, loreOf, pickLore, type LoreId } from './lore'

function summary(commander: CommanderId, events: TelemetryEvent[] = []): BattleSummary {
  const s = startSummary({ type: 'battle_start', commander, attempt: 1, assist: 1, seed: null }, 'test', 0)
  events.forEach((e, i) => applyEvent(s, { ...e, t: i + 1 }))
  return s
}

function recorder() {
  let s: BattleSummary | null = null
  return {
    record: (e: TelemetryEvent, t: number) => {
      if (e.type === 'battle_start') s = startSummary(e, 'bot', 0)
      if (s) applyEvent(s, { ...e, t })
    },
    summary: () => s!,
  }
}

const strike = (kills: number): TelemetryEvent => ({ type: 'strike', kills, alive: 40 })

describe('tarih notları — kurallar', () => {
  it('kimlikler tekil; metin tek soluk, başlık kısa; kaynak ve ipucu var', () => {
    expect(new Set(LORE.map((c) => c.id)).size).toBe(LORE.length)
    for (const c of LORE) {
      expect(c.text.length, c.id).toBeLessThanOrEqual(LORE_LIMITS.text)
      expect(c.title.length, c.id).toBeLessThanOrEqual(LORE_LIMITS.title)
      expect(c.source.length, c.id).toBeGreaterThan(0)
      expect(c.hint.length, c.id).toBeGreaterThan(0)
    }
  })

  it('kartlar ve hikâye kaynakla çelişmez, sonuçtan geriye bakmaz (MIMARI.md §10.7)', () => {
    // T1 barışı sultan önerdi; T2 öncü geçti, yolu kesen kaya kurgu; T6 ordu
    // dağıldı; T7 teleoloji yok. Oyunun YOLU KES'i kaya yığınıdır, kart değil.
    const banned = [/Manuel[^.]*istedi/, /kaya/i, /öncü durdu/i, /kolun başı dur/i, /teslim oldu/i, /Türk yurdu/i, /kalıcı/i]
    const texts = [
      ...LORE.map((c) => [c.id, `${c.title}. ${c.text}`]),
      ...COMMANDERS.map((c) => [c.id, [c.context, c.narrator, c.outcome.victory, c.outcome.defeat].join(' ')]),
    ]
    for (const [id, text] of texts) for (const b of banned) expect(text, id).not.toMatch(b)
  })

  it('her brifing bir bağlam satırıyla açılır, Aydoğdu her savaşı anlatır (HIKAYE.md §7)', () => {
    for (const c of COMMANDERS) {
      for (const text of [c.context, c.narrator, c.outcome.victory, c.outcome.defeat]) {
        expect(text.trim().length, c.id).toBeGreaterThan(0)
      }
    }
    // T3: Mete'nin Modu olduğu olgu değil, Türk tarih geleneğinin kabulü.
    expect(COMMANDERS.find((c) => c.id === 'metehan')?.context).toMatch(/Türk tarih geleneği/)
  })

  it('her komutanın en az dört kartı var', () => {
    for (const c of COMMANDERS) expect(loreOf(c.id).length, c.id).toBeGreaterThanOrEqual(4)
  })

  it('hiçbir şey yapmayan savaş kart kazanmaz', () => {
    for (const c of COMMANDERS) expect(pickLore(summary(c.id), [])).toBeNull()
  })

  it('aynı savaşta birden çok kart kazanılırsa en nadiri seçilir, görülen atlanır', () => {
    const s = summary('metehan', [strike(24), { type: 'rout', count: 3 }])
    expect(pickLore(s, [])?.id).toBe('yay')
    expect(pickLore(s, ['yay'])?.id).toBe('bozgun')
    expect(pickLore(s, ['yay', 'bozgun', 'sahte-ricat'])).toBeNull()
  })

  it('kart yalnızca kendi komutanının savaşında çıkar', () => {
    // Geçitte de taciz olayı var; Malazgirt'in taciz kartı orada çıkmamalı.
    const pass = summary('kilicarslan', [{ type: 'battle_event', event: 'harass' }])
    expect(pickLore(pass, [])).toBeNull()
  })
})

describe('tarih notları — her kart oyunda kazanılabilir', () => {
  it('iyi oynayan botlar bütün kartları açar', { timeout: 60000 }, () => {
    const earned = new Set<LoreId>()
    const collect = (s: BattleSummary) => {
      for (const c of loreOf(s.commander)) if (c.earn(s)) earned.add(c.id)
    }

    for (const seed of [1, 2, 3]) {
      const r = recorder()
      runWaves(kiter(SKILLS.expert, seed), r.record, true, true, 1)
      collect(r.summary())
    }
    for (const bot of [provokerBot, baiterBot]) {
      for (const seed of [1, 2]) {
        const r = recorder()
        runBattle(withWings(bot, ambushWings)(), seed, r.record)
        collect(r.summary())
      }
    }
    for (const seed of [1, 2]) {
      const r = recorder()
      runBattle(blockerBot(PASS.neckZ + 2, 4)(), seed, r.record, MIRYOKEFALON)
      collect(r.summary())
    }

    const missing = LORE.filter((c) => !earned.has(c.id)).map((c) => c.id)
    expect(missing).toEqual([])
  })

  it('ilk savaşını kaybeden acemi de bir kart kazanır', { timeout: 20000 }, () => {
    const r = recorder()
    runWaves(kiter(SKILLS.novice, 1), r.record, true, true, 0.5)
    const s = r.summary()
    expect(s.outcome).toBe('defeat')
    expect(pickLore(s, [])).not.toBeNull()
  })
})
