// Islıklı ok: kurallar ve denge sözü (bkz. whistle.ts).

import { describe, expect, it } from 'vitest'
import { stepEnemies } from './enemySim'
import type { Enemy } from './types'
import { kiter, runWaves, SKILLS, whistler } from './waveBots'
import { ladderScale } from './waves'
import { createWhistle, fireWhistle, rechargeWhistle, stepWhistle, WHISTLE } from './whistle'
import { createWorld } from '../sim/world'
import { SILENT_FX, stepGame } from '../sim/step'
import { wavesScenario } from '../sim/scenarios'

function enemy(id: number, x: number, z: number, extra: Partial<Enemy> = {}): Enemy {
  return { id, pos: { x, z }, vel: { x: 0, z: 0 }, alive: true, discipline: 1, ...extra }
}

/** Oku atıp indirir; inen adımın sonucunu döner. */
function land(s = createWhistle(), enemies: Enemy[], aim = { x: 0, z: 0 }): number {
  fireWhistle(s, { x: 0, z: 10 }, aim)
  let hit = -1
  for (let t = 0; t < 2 && hit < 0; t += 0.05) hit = stepWhistle(s, enemies, 0.05)
  return hit
}

describe('ıslıklı ok kuralları', () => {
  it('yalnız hazırken atılır; ikinci ok hilal vuruşunu bekler', () => {
    const s = createWhistle()
    expect(fireWhistle(s, { x: 0, z: 0 }, { x: 3, z: 0 })).not.toBeNull()
    expect(fireWhistle(s, { x: 0, z: 0 }, { x: 3, z: 0 })).toBeNull()
    stepWhistle(s, [], WHISTLE.flightTime)
    expect(fireWhistle(s, { x: 0, z: 0 }, { x: 3, z: 0 })).toBeNull()
    rechargeWhistle(s)
    expect(fireWhistle(s, { x: 0, z: 0 }, { x: 3, z: 0 })).not.toBeNull()
  })

  it('menzil dışına işaret menzile çekilir', () => {
    const t = fireWhistle(createWhistle(), { x: 0, z: 0 }, { x: 100, z: 0 })!
    expect(t.x).toBeCloseTo(WHISTLE.maxRange)
    expect(t.z).toBeCloseTo(0)
  })

  it('uçuş bitince iner: yağmurun altındakini durdurur ve sarsar, dışındakine dokunmaz', () => {
    const inside = enemy(0, 1, 1)
    const outside = enemy(1, WHISTLE.radius + 1, 0)
    expect(land(undefined, [inside, outside])).toBe(1)
    expect(inside.pinned).toBe(WHISTLE.pin)
    expect(inside.discipline).toBeCloseTo(1 - WHISTLE.shock)
    expect(outside.pinned).toBeUndefined()
    expect(outside.discipline).toBe(1)
  })

  it("Baideng'in komuta grubuna, kaçana ve ölüye işlemez", () => {
    const list = [
      enemy(0, 0, 0, { emperor: true }),
      enemy(1, 0, 0, { guard: true }),
      enemy(2, 0, 0, { routed: true }),
      enemy(3, 0, 0, { alive: false }),
    ]
    expect(land(undefined, list)).toBe(0)
  })

  it('kalkan altındaki atlı yerinde kalır, süre bitince yeniden yürür', () => {
    const e = enemy(0, 0, -12, { discipline: 0, pinned: WHISTLE.pin, vel: { x: 0, z: 6 } })
    const start = e.pos.z
    for (let t = 0; t < WHISTLE.pin; t += 1 / 60) stepEnemies([e], { x: 0, z: 0 }, 1 / 60, true)
    expect(e.pos.z - start).toBeLessThan(1.5)
    const held = e.pos.z
    for (let t = 0; t < 1; t += 1 / 60) stepEnemies([e], { x: 0, z: 0 }, 1 / 60, true)
    expect(e.pos.z - held).toBeGreaterThan(3)
  })

  it("adımda: ok yalnız Metehan'da var, hilal vuruşu yeniden hazırlar", () => {
    const w = createWorld('metehan')
    const scenario = wavesScenario()
    stepGame(w, { move: { x: 0, z: 0 }, strike: false, whistle: { x: 0, z: -5 } }, 1 / 60, SILENT_FX, scenario)
    expect(w.whistle.ready).toBe(false)
    expect(w.events.some((e) => e.type === 'whistleFired')).toBe(true)

    const army = createWorld('alp-arslan')
    stepGame(army, { move: { x: 0, z: 0 }, strike: false, whistle: { x: 0, z: -5 } }, 1 / 60, SILENT_FX)
    expect(army.whistle.ready).toBe(true)
    expect(army.events.some((e) => e.type === 'whistleFired')).toBe(false)
  })
})

describe('ıslıklı ok dengesi', () => {
  const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
  const wins = (aim: 'chasers' | 'steady' | null) =>
    seeds(30).filter((s) => {
      const skill = SKILLS.average
      const bot = aim ? whistler(kiter(skill, s), skill, s, aim) : kiter(skill, s)
      return runWaves(bot, undefined, true, true, ladderScale(0)).result === 'victory'
    }).length

  it('yer seçimi karardır: peşteki atlılara atan orta oyuncu belirgin kazanır, hatta atan kazanmaz', { timeout: 60000 }, () => {
    const none = wins(null)
    const chasers = wins('chasers')
    const steady = wins('steady')
    // Ölçüm (whistle.ts): ok yok 8, peştekilere 17, hatta 8.
    expect(chasers).toBeGreaterThanOrEqual(none + 6)
    expect(chasers).toBeGreaterThanOrEqual(steady + 6)
    // Cömert olmasın: orta oyuncu başlangıç basamağında hâlâ her savaşı kazanmasın.
    expect(chasers).toBeLessThanOrEqual(22)
  })
})
