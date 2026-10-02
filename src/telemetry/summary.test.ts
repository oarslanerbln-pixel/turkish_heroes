import { describe, expect, it } from 'vitest'
import { applyEvent, startSummary, type Stamped } from './summary'

function play(events: Stamped[]) {
  const s = startSummary({ type: 'battle_start', commander: 'metehan', attempt: 2, assist: 0.7, seed: null }, 'abc', 1000)
  for (const e of events) applyEvent(s, e)
  return s
}

describe('savaş özeti', () => {
  it('vuruşları, retleri ve dalgaları sırasıyla toplar', () => {
    const s = play([
      { type: 'strike_refused', reason: 'notReady', t: 3 },
      { type: 'strike_refused', reason: 'notReady', t: 3.5 },
      { type: 'strike', kills: 6, alive: 16, t: 9.2 },
      { type: 'strike_refused', reason: 'steady', t: 12 },
      { type: 'strike', kills: 10, alive: 10, t: 15 },
      { type: 'wave_clear', wave: 0, health: 82, t: 15 },
    ])
    expect(s.strikes).toEqual([
      { t: 9.2, kills: 6, alive: 16 },
      { t: 15, kills: 10, alive: 10 },
    ])
    expect(s.refusals).toEqual({ notReady: 2, noTargets: 0, steady: 1 })
    expect(s.waves).toEqual([{ wave: 0, t: 15, health: 82 }])
    expect(s.wave).toBe(1)
    expect(s.duration).toBe(15)
    expect(s.outcome).toBe('playing')
  })

  it('sonuç, nedeni ve son durumu yazar', () => {
    const s = play([
      { type: 'battle_event', event: 'charge', t: 40 },
      {
        type: 'battle_end',
        outcome: 'defeat',
        cause: 'health',
        score: 1200,
        stars: 0,
        health: 0,
        wave: 1,
        remaining: 7,
        simTime: 41.1,
        t: 41.3,
      },
    ])
    expect(s).toMatchObject({
      session: 'abc',
      startedAt: 1000,
      commander: 'metehan',
      attempt: 2,
      assist: 0.7,
      outcome: 'defeat',
      cause: 'health',
      score: 1200,
      health: 0,
      wave: 1,
      remaining: 7,
      simTime: 41.1,
      duration: 41.3,
      events: [{ event: 'charge', t: 40 }],
    })
  })

  it('molaları ve moladan çıkışı kaydeder', () => {
    const s = play([
      { type: 'pause', auto: true, t: 20 },
      { type: 'pause', auto: false, t: 31.5 },
      { type: 'battle_end', outcome: 'quit', cause: null, score: 300, stars: 0, health: 64, wave: 0, remaining: 9, simTime: 30, t: 31.5 },
    ])
    expect(s.pauses).toEqual([
      { t: 20, auto: true },
      { t: 31.5, auto: false },
    ])
    expect(s.outcome).toBe('quit')
  })

  it('kollara verilen emirleri sırasıyla kaydeder', () => {
    const s = play([
      { type: 'wing_order', wing: 0, order: 'harass', t: 14 },
      { type: 'wing_order', wing: 1, order: 'charge', t: 101.2 },
    ])
    expect(s.orders).toEqual([
      { t: 14, wing: 0, order: 'harass' },
      { t: 101.2, wing: 1, order: 'charge' },
    ])
  })

  it('gün batımı anını ve gösterilen tavsiyeyi kaydeder', () => {
    const s = play([
      { type: 'dusk', cohesion: [0.6, 0.7, 0.9, 0.85], wings: [1, 0.4], health: 72, t: 101 },
      {
        type: 'battle_end',
        outcome: 'victory',
        cause: null,
        score: 4000,
        stars: 2,
        health: 70,
        wave: 0,
        remaining: 12,
        simTime: 160,
        advice: 'breakRear',
        t: 163,
      },
    ])
    expect(s.dusk).toEqual({ t: 101, cohesion: [0.6, 0.7, 0.9, 0.85], wings: [1, 0.4], health: 72 })
    expect(s.advice).toBe('breakRear')
    expect(s.simTime).toBe(160)
  })

  it('JSON gidiş-dönüşünde bozulmaz (localStorage kaydı)', () => {
    const s = play([{ type: 'strike', kills: 3, alive: 5, t: 2 }])
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})
