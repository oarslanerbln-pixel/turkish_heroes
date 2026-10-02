// Savaş karnesinin kuralları: hangi sonuçta hangi başlık, hedef ve tavsiye.
// Özetler elle kuruluyor; oyundaki olay takibiyle aynı yoldan (applyEvent).

import { describe, expect, it } from 'vitest'
import { BATTLE_CONFIG, BATTLE_SIZE } from '../mechanics/corps'
import { applyEvent, startSummary, type BattleSummary, type TelemetryEvent } from '../telemetry/summary'
import { debrief } from './debrief'
import type { CommanderId } from '../mechanics/scenario'

type Timed = [number, TelemetryEvent]

function summary(commander: CommanderId, events: Timed[], assist = 1): BattleSummary {
  const s = startSummary({ type: 'battle_start', commander, attempt: 1, assist, seed: null }, 'test', 0)
  for (const [t, e] of events) applyEvent(s, { ...e, t })
  return s
}

function end(
  outcome: 'victory' | 'defeat',
  fields: Partial<Extract<TelemetryEvent, { type: 'battle_end' }>> = {},
): TelemetryEvent {
  return {
    type: 'battle_end',
    outcome,
    cause: outcome === 'defeat' ? 'health' : null,
    score: 0,
    stars: 0,
    health: 50,
    wave: 0,
    remaining: 0,
    simTime: 0,
    ...fields,
  }
}

const strike = (kills: number, alive = 40): TelemetryEvent => ({ type: 'strike', kills, alive })
const event = (name: Extract<TelemetryEvent, { type: 'battle_event' }>['event']): TelemetryEvent => ({
  type: 'battle_event',
  event: name,
})
const dusk = (cohesion: number[], wings = [1, 1], health = 80): TelemetryEvent => ({
  type: 'dusk',
  cohesion,
  wings,
  health,
})

describe('savaş karnesi — Metehan', () => {
  it('yenilgi: dalga ve kalan düşman, zafere ilerleme; az kalan "az kaldı" sayılır', () => {
    const d = debrief(
      summary('metehan', [
        [10, strike(12, 16)],
        [11, { type: 'rout', count: 2 }],
        [14, { type: 'wave_clear', wave: 0, health: 70 }],
        [30, strike(20, 26)],
        [40, end('defeat', { wave: 1, remaining: 4, health: 0 })],
      ]),
      { best: 0 },
    )
    expect(d.headline).toBe('2. dalgada düştün — 4 düşman kalmıştı.')
    expect(d.close).toBe(true)
    // Bozguna uğrayanlar da yolun parçası: 12 + 2 + 20.
    expect(d.goal).toEqual({ label: 'Zafere', value: 34, target: 80, unit: 'düşman' })
    expect(d.peak).toBe('En büyük hilalin: tek vuruşta 20 düşman (2. dalga)')
    expect(d.timeline.dusk).toBeNull()
    expect(d.timeline.marks.map((m) => m.kind).sort()).toEqual(['rout', 'strike', 'strike', 'wave'])
  })

  it('dalganın çoğu dururken düşmek "az kaldı" değildir', () => {
    const d = debrief(summary('metehan', [[20, end('defeat', { wave: 2, remaining: 38 })]]), {
      best: 0,
    })
    expect(d.close).toBe(false)
    expect(d.peak).toBeNull()
  })

  it('tavsiye sırası: erken basma → menzil → küçük vuruş → hep kaç', () => {
    const refused = (reason: 'notReady' | 'noTargets'): TelemetryEvent => ({
      type: 'strike_refused',
      reason,
    })
    const advice = (events: Timed[]) =>
      debrief(summary('metehan', [...events, [60, end('defeat')]]), { best: 0 }).advice.id

    expect(advice([[1, refused('notReady')], [2, refused('notReady')], [3, refused('notReady')]])).toBe(
      'waitReady',
    )
    expect(advice([[1, refused('noTargets')], [2, refused('noTargets')]])).toBe('closeRange')
    expect(advice([[5, strike(2)], [9, strike(3)]])).toBe('tighten')
    expect(advice([[5, strike(8)], [9, strike(6)]])).toBe('kite')
  })

  it('zafer: kıl payıysa söylenir; üç yıldızdan sonra rekorun altındaysa hedef rekor', () => {
    const d = debrief(summary('metehan', [[80, end('victory', { health: 9, score: 7000, stars: 3 })]]), {
      best: 9000,
    })
    expect(d.close).toBe(true)
    expect(d.advice.id).toBe('clean')
    expect(d.goal).toEqual({ label: 'Rekor', value: 7000, target: 9000, unit: 'puan' })

    const routed = debrief(
      summary('metehan', [
        [30, { type: 'rout', count: 3 }],
        [80, end('victory', { health: 40 })],
      ]),
      { best: 0 },
    )
    expect(routed.advice.id).toBe('sweep')
    expect(routed.advice.text).toContain('3 düşman')

    const best = debrief(summary('metehan', [[80, end('victory', { health: 60, score: 9500, stars: 3 })]]), {
      best: 9500,
    })
    expect(best.close).toBe(false)
    expect(best.goal).toBeNull()

    const flawless = debrief(summary('metehan', [[80, end('victory', { health: 100 })]]), { best: 0 })
    expect(flawless.advice.id).toBe('flawless')
  })

  it('zafer: üç yıldız yoksa hedef bir sonraki yıldızın bu basamaktaki canı', () => {
    const goal = (health: number, stars: number, assist: number) =>
      debrief(summary('metehan', [[80, end('victory', { health, stars, score: 100 })]], assist), {
        best: 9000,
      }).goal
    // Yarı hasar: 2. yıldız 50, 3. yıldız 68 can ister.
    expect(goal(40, 1, 0.5)).toEqual({ label: '2. yıldız: az yara', value: 40, target: 50, unit: 'can' })
    expect(goal(55, 2, 0.5)).toEqual({ label: '3. yıldız: az yara', value: 55, target: 68, unit: 'can' })
    expect(goal(20, 2, 1)).toMatchObject({ target: 35 })
  })
})

describe('savaş karnesi — Malazgirt', () => {
  const { dayLength, nightAt } = BATTLE_CONFIG

  it('ordugah yenilgisi: gün batımına kalan süre, "az kaldı" ve gün batımı hedefi', () => {
    const d = debrief(
      summary('alp-arslan', [
        [20, event('harass')],
        [dayLength - 6, end('defeat', { cause: 'camp', simTime: dayLength - 5.5 })],
      ]),
      { best: 0 },
    )
    expect(d.headline).toBe('Bizans ordusu ordugaha vardı — gün batımına 6 sn kala.')
    expect(d.close).toBe(true)
    expect(d.goal).toMatchObject({ label: 'Gün batımına dayan', value: 95, target: dayLength })
  })

  it('ordugah yenilgisi tavsiyesi: taciz yoksa taciz, gündüz vurduysa hilali sakla, kolsuzsa kollar', () => {
    const advice = (events: Timed[]) =>
      debrief(summary('alp-arslan', [...events, [70, end('defeat', { cause: 'camp', simTime: 70 })]]), {
        best: 0,
      }).advice.id
    expect(advice([])).toBe('harass')
    expect(advice([[10, event('harass')], [30, strike(3)], [50, strike(3)]])).toBe('saveHilal')
    expect(advice([[10, event('harass')]])).toBe('wingHarass')
    expect(
      advice([
        [10, event('harass')],
        [12, { type: 'wing_order', wing: 0, order: 'harass' }],
      ]),
    ).toBe('harass')
  })

  it('can yenilgisi: gündüz hamle; akşam düşen gündüz yaralandıysa yine hamle dersi', () => {
    const day = debrief(summary('alp-arslan', [[60, end('defeat', { simTime: 60 })]]), { best: 0 })
    expect(day.headline).toBe('Ağır süvari seni çiğnedi — gün batımına 40 sn vardı.')
    expect(day.advice.id).toBe('evade')

    const wounded = debrief(
      summary('alp-arslan', [
        [dayLength, dusk([0.7, 0.7, 0.7, 0.9], [1, 1], 30)],
        [dayLength + 10, end('defeat', { simTime: dayLength + 10 })],
      ]),
      { best: 0 },
    )
    expect(wounded.headline).toBe(`Safların arasında düştün — gece çökmesine ${nightAt - dayLength - 10} sn vardı.`)
    expect(wounded.advice.text).toContain('%30')
    expect(wounded.goal).toMatchObject({ label: 'Geceye dayan', target: nightAt })
  })

  it('1 yıldız: yarıya kalan asker hedefi; eksik az ise "az kaldı"', () => {
    const need = Math.ceil(BATTLE_SIZE / 2)
    const d = debrief(
      summary('alp-arslan', [
        [dayLength, event('sunset')],
        [dayLength + 5, strike(need - 2)],
        [nightAt, end('victory', { stars: 1, simTime: nightAt })],
      ]),
      { best: 0 },
    )
    expect(d.goal).toEqual({ label: '2. yıldız: ordunun yarısı', value: need - 2, target: need, unit: 'asker' })
    expect(d.close).toBe(true)
    expect(d.peak).toContain('(akşam)')
    expect(d.timeline.dusk).toBeCloseTo(dayLength / nightAt)
  })

  it('1 yıldız tavsiyesi: gündüz harcanan hilal → yorgun kollar → kullanılmayan kollar → akşam vuruşu', () => {
    const advice = (events: Timed[]) =>
      debrief(
        summary('alp-arslan', [
          [dayLength, event('sunset')],
          ...events,
          [nightAt, end('victory', { stars: 1, simTime: nightAt })],
        ]),
        { best: 0 },
      ).advice.id

    expect(advice([[30, strike(4)], [60, strike(4)], [dayLength + 5, strike(3)]])).toBe('saveHilal')
    expect(
      advice([
        [10, { type: 'wing_order', wing: 0, order: 'charge' }],
        [dayLength, dusk([0.7, 0.7, 0.7, 0.9], [0.2, 0.3])],
        [dayLength + 3, event('wingShockLeft')],
      ]),
    ).toBe('saveWings')
    expect(advice([[dayLength, dusk([0.7, 0.7, 0.7, 0.9])]])).toBe('useWings')
    expect(advice([[dayLength + 3, event('wingShockRight')]])).toBe('duskStrike')
  })

  it('2 yıldız: imparatora giden üç adım; kalınan adımın tavsiyesi', () => {
    const run = (events: Timed[]) =>
      debrief(
        summary('alp-arslan', [
          ...events,
          [nightAt, end('victory', { stars: 2, simTime: nightAt })],
        ]),
        { best: 0 },
      )

    const rear = run([[dayLength, dusk([0.6, 0.7, 0.6, 0.86])]])
    expect(rear.advice.id).toBe('breakRear')
    expect(rear.advice.text).toContain('%86')
    expect(rear.goal).toMatchObject({ value: 0, target: 3 })

    const center = run([
      [dayLength, dusk([0.6, 0.9, 0.6, 0.7])],
      [dayLength, event('rearguardLeaves')],
    ])
    expect(center.advice.id).toBe('breakCenter')
    expect(center.goal).toMatchObject({ value: 1 })

    const exposed = run([
      [dayLength, event('rearguardLeaves')],
      [dayLength + 20, event('emperorExposed')],
    ])
    expect(exposed.advice.id).toBe('aimEmperor')
    expect(exposed.close).toBe(true)
    expect(exposed.goal).toMatchObject({ value: 2 })
  })

  it('3 yıldız: ustalık; hedef yok, zirve imparatorun esri', () => {
    const d = debrief(
      summary('alp-arslan', [
        [dayLength + 30, strike(1)],
        [dayLength + 30, event('emperorCaptured')],
        [dayLength + 30, end('victory', { stars: 3, health: 100, simTime: dayLength + 30 })],
      ]),
      { best: 0 },
    )
    expect(d.advice.id).toBe('mastery')
    expect(d.goal).toBeNull()
    expect(d.peak).toContain('Romanos Diogenes')
    expect(d.timeline.marks.some((m) => m.kind === 'emperor')).toBe(true)
  })
})

describe('savaş karnesi — Miryokefalon', () => {
  const nightAt = 150
  const pass = (events: Timed[]) => summary('kilicarslan', events)
  const block = (z: number): TelemetryEvent => ({ type: 'blockade', z })

  it('yığının yeri: kesilmedi / genişte / çıkışa yakın → "boğazın hemen ötesinde kes"', () => {
    const advice = (events: Timed[]) =>
      debrief(pass([...events, [nightAt, end('victory', { stars: 1, simTime: nightAt })]]), { best: 0 })
        .advice
    expect(advice([]).id).toBe('blockNeck')
    expect(advice([[30, block(-4)]]).text).toContain('geniş vadide')
    expect(advice([[30, block(18)]]).text).toContain('çıkışa yakın')
    // İyi yerde kesip kol sıkıştıysa ders hasat.
    expect(advice([[30, block(8)], [60, event('jam')]]).id).toBe('harvestJam')
    // İyi yerde kesti ama yığın temizlendi, kol sıkışmadı.
    expect(advice([[30, block(8)], [80, event('blockadeCleared')]]).id).toBe('holdBlock')
  })

  it('geçit aşıldı: yığın temizlendiyse "yığını tut"', () => {
    const d = debrief(
      pass([
        [30, block(8)],
        [90, event('blockadeCleared')],
        [140, end('defeat', { cause: 'camp', simTime: 140 })],
      ]),
      { best: 0 },
    )
    expect(d.headline).toBe('Bizans ordusu geçidi aştı — geceye 10 sn kala.')
    expect(d.close).toBe(true)
    expect(d.advice.id).toBe('holdBlock')
    expect(d.timeline.marks.some((m) => m.kind === 'block')).toBe(true)
  })

  it('2 yıldız: Manuel\'e giden üç adım; 3 yıldız: barış', () => {
    const two = debrief(
      pass([
        [30, block(8)],
        [60, event('jam')],
        [nightAt, end('victory', { stars: 2, simTime: nightAt })],
      ]),
      { best: 0 },
    )
    expect(two.goal).toMatchObject({ label: '3. yıldız: Manuel', value: 2, target: 3 })
    expect(two.advice.id).toBe('jamCenter')

    const three = debrief(
      pass([
        [30, block(8)],
        [90, event('emperorCaptured')],
        [90, end('victory', { stars: 3, health: 80, simTime: 90 })],
      ]),
      { best: 0 },
    )
    expect(three.advice.id).toBe('mastery')
    expect(three.peak).toContain('Manuel')
  })
})
