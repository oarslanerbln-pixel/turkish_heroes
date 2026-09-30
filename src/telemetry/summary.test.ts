import { describe, expect, it } from 'vitest'
import { applyEvent, startSummary, type Stamped } from './summary'

function play(events: Stamped[]) {
  const s = startSummary({ type: 'battle_start', commander: 'metehan', attempt: 2 }, 'abc', 1000)
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
        t: 41.3,
      },
    ])
    expect(s).toMatchObject({
      session: 'abc',
      startedAt: 1000,
      commander: 'metehan',
      attempt: 2,
      outcome: 'defeat',
      cause: 'health',
      score: 1200,
      health: 0,
      wave: 1,
      duration: 41.3,
      events: [{ event: 'charge', t: 40 }],
    })
  })

  it('JSON gidiş-dönüşünde bozulmaz (localStorage kaydı)', () => {
    const s = play([{ type: 'strike', kills: 3, alive: 5, t: 2 }])
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})
