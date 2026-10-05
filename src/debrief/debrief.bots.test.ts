// Savaş karnesinin olasılıksal doğrulaması: her bot türünün bilinen bir hatası
// (ya da ustalığı) var; karne o hatayı bulabiliyor mu?
//
// Botlar oyundaki olay takibiyle aynı olayları üretir (runBattle / runWaves
// `record`), özet aynı applyEvent'le kurulur, karne aynı fonksiyondan çıkar.
// Tavsiyelerin nedenselliği ayrı testlerde ölçülü: tavsiyeye uyan bot daha iyi
// oynuyor mu —
//   useWings  → kolsuz tacizci < kolları akşama saklayan (wings.test.ts)
//   saveWings → kolları gündüz tüketen < pusuda tutan (wings.test.ts)
//   breakRear → güvenli tacizci 1–2 yıldız, artçıyı kışkırtıp kollarını saklayan 3 yıldız (wings.test.ts)
//   closeWings → artçıyı kaçırıp kolları sürmeyen ≤ 2 yıldız, gün batımında hücum veren 3 yıldız (wings.test.ts)
//   saveHilal → gündüz vuran açgözlü < hilali saklayan (corps.test.ts)
//   waitReady → davranış zararsız ama mekaniğin anlaşılmadığını gösterir;
//               tavsiye hilalin nasıl dolduğunu anlatır (nedensellik iddiası yok).

import { describe, expect, it } from 'vitest'
import {
  ambushWings,
  blockerBot,
  eagerWings,
  greedyBot,
  passiveBot,
  provokerBot,
  runBattle,
  safeHarasser,
  withWings,
  type Bot,
} from '../mechanics/battleBots'
import { MIRYOKEFALON } from '../mechanics/corps'
import { kiter, runWaves, SKILLS, type KiterSkill } from '../mechanics/waveBots'
import { applyEvent, startSummary, type BattleSummary, type TelemetryEvent } from '../telemetry/summary'
import { debrief, type AdviceId, type Debrief } from './debrief'

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

interface Graded {
  summary: BattleSummary
  report: Debrief
}

function battles(makeBot: () => Bot, seeds: readonly number[]): Graded[] {
  return seeds.map((seed) => {
    const r = recorder()
    runBattle(makeBot(), seed, r.record)
    return { summary: r.summary(), report: debrief(r.summary(), { best: 0 }) }
  })
}

function waves(skill: KiterSkill, seeds: readonly number[], damageScale: number): Graded[] {
  return seeds.map((seed) => {
    const r = recorder()
    runWaves(kiter(skill, seed), r.record, true, true, damageScale)
    return { summary: r.summary(), report: debrief(r.summary(), { best: Infinity }) }
  })
}

/** Seçilen koşulardan kaçının tavsiyesi `id`. */
function share(runs: Graded[], id: AdviceId): number {
  if (runs.length === 0) return 0
  return runs.filter((r) => r.report.advice.id === id).length / runs.length
}

const oneStar = (runs: Graded[]) =>
  runs.filter((r) => r.summary.outcome === 'victory' && r.summary.stars === 1)
const twoStars = (runs: Graded[]) =>
  runs.filter((r) => r.summary.outcome === 'victory' && r.summary.stars === 2)

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

describe('savaş karnesi — bot türü başına tavsiye (Malazgirt)', () => {
  it('pasif oyuncu: hamlelerde yaralandığı söylenir', { timeout: 20000 }, () => {
    const runs = battles(passiveBot, SEEDS.slice(0, 4))
    expect(runs.every((r) => r.summary.outcome === 'defeat')).toBe(true)
    expect(share(runs, 'evade')).toBe(1)
    expect(runs.every((r) => r.report.advice.text.includes('hamle'))).toBe(true)
  })

  it('kolsuz güvenli tacizci: 1 yıldızda "kolları kullan"', { timeout: 30000 }, () => {
    const runs = oneStar(battles(safeHarasser(), SEEDS))
    expect(runs.length).toBeGreaterThanOrEqual(3)
    expect(share(runs, 'useWings')).toBeGreaterThanOrEqual(0.8)
  })

  it('kolları gündüz tüketen: 1 yıldızda "kolları sakla"', { timeout: 30000 }, () => {
    const runs = oneStar(battles(withWings(safeHarasser(), eagerWings), SEEDS))
    expect(runs.length).toBeGreaterThanOrEqual(3)
    expect(share(runs, 'saveWings')).toBeGreaterThanOrEqual(0.8)
  })

  it('2 yıldızda kalanlar: imparatora giden yolun adımı (artçı)', { timeout: 30000 }, () => {
    const runs = [
      ...twoStars(battles(greedyBot, SEEDS)),
      ...twoStars(battles(withWings(safeHarasser(), ambushWings), SEEDS)),
    ]
    expect(runs.length).toBeGreaterThanOrEqual(8)
    expect(share(runs, 'breakRear')).toBeGreaterThanOrEqual(0.8)
  })

  it('artçıyı kaçırıp imparatoru kaçıran: kolsuz "kollara HÜCUM ver", sabırsız "kolları sakla"', { timeout: 30000 }, () => {
    const missed = (runs: Graded[]) => [...oneStar(runs), ...twoStars(runs)]
    const idle = missed(battles(provokerBot, SEEDS))
    expect(idle.length).toBeGreaterThanOrEqual(4)
    expect(share(idle, 'useWings') + share(idle, 'closeWings')).toBeGreaterThanOrEqual(0.8)

    const eager = missed(battles(withWings(provokerBot, eagerWings), SEEDS))
    expect(eager.length).toBeGreaterThanOrEqual(4)
    expect(share(eager, 'saveWings')).toBeGreaterThanOrEqual(0.8)
  })

  it('kışkırtıcı + pusudaki kollar: çoğunlukla ustalık', { timeout: 30000 }, () => {
    const runs = battles(withWings(provokerBot, ambushWings), SEEDS)
    expect(share(runs, 'mastery')).toBeGreaterThanOrEqual(0.75)
  })

  it('her koşunun karnesi tutarlı: hedef ilerlemesi sınırda, işaretler savaşın içinde', { timeout: 30000 }, () => {
    for (const r of battles(provokerBot, SEEDS.slice(0, 4))) {
      const { goal, timeline } = r.report
      if (goal) expect(goal.value).toBeLessThanOrEqual(goal.target * 1.5)
      expect(timeline.marks.every((m) => m.at >= 0 && m.at <= 1)).toBe(true)
    }
  })
})

describe('savaş karnesi — bot türü başına tavsiye (Metehan)', () => {
  const seeds = Array.from({ length: 16 }, (_, i) => i + 1)

  it('erken basan acemi: "hilal kaçarken dolar"', { timeout: 30000 }, () => {
    const runs = waves(SKILLS.novice, seeds, 0.5).filter((r) => r.summary.outcome === 'defeat')
    expect(runs.length).toBeGreaterThanOrEqual(12)
    expect(share(runs, 'waitReady')).toBeGreaterThanOrEqual(0.9)
  })

  it('erken basmayan ama hata yapan oyuncu: "hep kaç"', { timeout: 30000 }, () => {
    const runs = waves({ ...SKILLS.average, mash: 0 }, seeds, 1).filter(
      (r) => r.summary.outcome === 'defeat',
    )
    expect(runs.length).toBeGreaterThanOrEqual(12)
    expect(share(runs, 'kite')).toBeGreaterThanOrEqual(0.75)
  })

  it('uzman: zafer; ustalık tavsiyesi bozgun ya da can üstüne', { timeout: 30000 }, () => {
    const runs = waves(SKILLS.expert, seeds.slice(0, 8), 1)
    const wins = runs.filter((r) => r.summary.outcome === 'victory')
    expect(wins.length).toBeGreaterThanOrEqual(7)
    for (const r of wins) {
      const routed = r.summary.routs.length > 0
      expect(r.report.advice.id).toBe(routed ? 'sweep' : 'clean')
    }
  })
})

describe('savaş karnesi — bot türü başına tavsiye (Miryokefalon)', () => {
  const pass = (makeBot: () => Bot, seeds: readonly number[]): Graded[] =>
    seeds.map((seed) => {
      const r = recorder()
      runBattle(makeBot(), seed, r.record, MIRYOKEFALON)
      return { summary: r.summary(), report: debrief(r.summary(), { best: 0 }) }
    })

  it('yolu hiç kesmeyen ve genişte kesen: "boğazın hemen ötesinde kes"', { timeout: 30000 }, () => {
    const runs = [...pass(blockerBot(null, 4), [1, 2]), ...pass(blockerBot(-4, 4), [1, 2])]
    expect(runs.every((r) => r.report.advice.id === 'blockNeck')).toBe(true)
  })

  it('boğazın ötesinde kesen: ustalık', { timeout: 30000 }, () => {
    const runs = pass(blockerBot(8, 4), [1, 2, 3])
    expect(share(runs, 'mastery')).toBe(1)
  })
})
