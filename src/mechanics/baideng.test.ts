// Baideng (Metehan'ın dördüncü dalgası): kuralları tek tek sabitler.
// Görsel ve ses sim/scenarios.ts ile bileşenlerde; burada yalnızca yağmurun
// isabeti, Han'ın kendi okları, çember ve barış.

import { describe, expect, it } from 'vitest'
import {
  afterBaidengStrike,
  BAIDENG,
  type BaidengEvent,
  COMMAND,
  createBaidengArmy,
  createBaidengState,
  ringClosed,
  ringRadius,
  stepCommand,
  stepPeace,
  stepVolleys,
  SWARM,
} from './baideng'
import { executeStrike } from './hilalSystem'
import { kiter, runWaves, SKILLS } from './waveBots'
import { WAVES } from './waves'
import type { Enemy, Vec2 } from './types'

const DT = 1 / 60
const COUNT = WAVES[3].enemyCount
const STILL: Vec2 = { x: 0, z: 0 }

function army() {
  const enemies = createBaidengArmy(COUNT)
  const s = createBaidengState(COUNT)
  const events: BaidengEvent[] = []
  return { enemies, s, events }
}

/** Gövdeyi sahadan çeker: yağmur testlerinde atlılar halkaya rastlamasın. */
function clearSwarm(enemies: Enemy[]): void {
  for (const e of enemies) if (e.corps === SWARM) e.pos = { x: 100, z: 100 }
}

/** İlk yağmur halkası belirene kadar ilerletir. */
function untilAimed(a: ReturnType<typeof army>, player: Vec2, vel = STILL): number {
  let damage = 0
  for (let t = 0; t < BAIDENG.firstVolley + 1 && a.s.volleys.length === 0; t += DT) {
    damage += stepVolleys(a.s, a.enemies, player, vel, DT, a.events)
  }
  return damage
}

describe('Baideng — ordu', () => {
  it('gövde, Gaozu ve sekiz muhafız; Gaozu gövdenin arkasında ve hep korunur', () => {
    const { enemies, s } = army()
    expect(enemies).toHaveLength(COUNT)
    expect(enemies.filter((e) => e.corps === SWARM)).toHaveLength(s.swarm)
    const emperor = enemies.filter((e) => e.emperor)
    expect(emperor).toHaveLength(1)
    expect(emperor[0].guarded).toBe(true)
    expect(enemies.filter((e) => e.guard)).toHaveLength(BAIDENG.guards)
    expect(enemies.filter((e) => e.corps === COMMAND)).toHaveLength(1 + BAIDENG.guards)
    const swarmZ = Math.min(...enemies.filter((e) => e.corps === SWARM).map((e) => e.pos.z))
    expect(emperor[0].pos.z).toBeLessThan(swarmZ)
  })

  it('vuruş muhafızı düşürür, Gaozu\'yu asla', () => {
    const { enemies } = army()
    const emperor = enemies.find((e) => e.emperor)!
    const guard = enemies.find((e) => e.guard)!
    clearSwarm(enemies)
    emperor.pos = { x: 0.5, z: 6 }
    guard.pos = { x: -0.5, z: 6 }
    const player: Vec2 = { x: 0, z: 0 }
    expect(executeStrike(enemies, player, 0)).toBeGreaterThanOrEqual(1)
    expect(guard.alive).toBe(false)
    expect(emperor.alive).toBe(true)
  })
})

describe('Baideng — arbalet yağmuru', () => {
  it('halka önce belirir, oklar gecikmeyle düşer; halkada kalan yaralanır', () => {
    const a = army()
    clearSwarm(a.enemies)
    const player: Vec2 = { x: 0, z: 0 }
    expect(untilAimed(a, player)).toBe(0)
    expect(a.events.map((e) => e.type)).toEqual(['volleyAimed'])
    // Duran oyuncunun tam üstüne nişan alınır.
    expect(a.s.volleys[0].x).toBeCloseTo(0)
    expect(a.s.volleys[0].z).toBeCloseTo(0)

    let damage = 0
    for (let t = 0; t < BAIDENG.volleyTelegraph - 0.1; t += DT) {
      damage += stepVolleys(a.s, a.enemies, player, STILL, DT, a.events)
    }
    expect(damage).toBe(0)
    for (let t = 0; t < 0.2; t += DT) damage += stepVolleys(a.s, a.enemies, player, STILL, DT, a.events)
    expect(damage).toBe(BAIDENG.volleyDamage)
    expect(a.events.find((e) => e.type === 'volleyLanded')).toMatchObject({ hit: true })
  })

  it('düz koşan yakalanır, yön değiştiren kaçar', () => {
    const run = (turn: boolean) => {
      const a = army()
      clearSwarm(a.enemies)
      const player: Vec2 = { x: 0, z: 0 }
      const vel: Vec2 = { x: 6, z: 0 }
      untilAimed(a, player, vel)
      let damage = 0
      for (let t = 0; t < BAIDENG.volleyTelegraph + 0.1; t += DT) {
        // Halka belirince keskin dönüş: gidişe dik, aynı hızla.
        const v = turn ? { x: 0, z: 6 } : vel
        player.x += v.x * DT
        player.z += v.z * DT
        damage += stepVolleys(a.s, a.enemies, player, v, DT, a.events)
      }
      return damage
    }
    expect(run(false)).toBe(BAIDENG.volleyDamage)
    expect(run(true)).toBe(0)
  })

  it('halkadaki Han atlıları kendi oklarıyla düşer; muhafız ve bozguncu düşmez', () => {
    const a = army()
    clearSwarm(a.enemies)
    const swarm = a.enemies.filter((e) => e.corps === SWARM)
    const guard = a.enemies.find((e) => e.guard)!
    const player: Vec2 = { x: 0, z: 0 }
    untilAimed(a, player)
    swarm[0].pos = { x: 1, z: 0 }
    swarm[1].pos = { x: -1, z: 1 }
    swarm[2].pos = { x: 0, z: 1 }
    swarm[2].routed = true
    guard.pos = { x: 0, z: -1 }
    for (let t = 0; t < BAIDENG.volleyTelegraph + 0.1; t += DT) {
      stepVolleys(a.s, a.enemies, player, STILL, DT, a.events)
    }
    expect([swarm[0].alive, swarm[1].alive, swarm[2].alive, guard.alive]).toEqual([false, false, true, true])
    expect(a.s.felled).toBe(2)
    const landed = a.events.find((e) => e.type === 'volleyLanded')
    expect(landed?.type === 'volleyLanded' && landed.felled).toHaveLength(2)
  })

  it('muhafız düştükçe yağmur seyrekleşir; hiç kalmayınca ya da çember kurulunca durur', () => {
    const firstAim = (alive: number) => {
      const a = army()
      clearSwarm(a.enemies)
      a.enemies.filter((e) => e.guard).forEach((g, i) => (g.alive = i < alive))
      let t = 0
      while (a.s.volleys.length === 0 && t < 60) {
        stepVolleys(a.s, a.enemies, STILL, STILL, DT, a.events)
        t += DT
      }
      return t
    }
    const full = firstAim(BAIDENG.guards)
    expect(full).toBeCloseTo(BAIDENG.firstVolley, 1)
    expect(firstAim(BAIDENG.guards / 2)).toBeCloseTo(full * 2, 0)
    expect(firstAim(0)).toBeGreaterThanOrEqual(60)

    const a = army()
    a.s.ring = { center: { x: 0, z: -25 }, t: 0 }
    for (let t = 0; t < BAIDENG.firstVolley * 2; t += DT) stepVolleys(a.s, a.enemies, STILL, STILL, DT, a.events)
    expect(a.events).toHaveLength(0)
  })
})

describe('Baideng — dört renkli çember ve barış', () => {
  it('gövde kırılana kadar çember yok; kırılınca artık bozguna uğrar, çember Gaozu\'da kurulur', () => {
    const a = army()
    const swarm = a.enemies.filter((e) => e.corps === SWARM)
    const limit = Math.floor(a.s.swarm * BAIDENG.routShare)
    swarm.forEach((e, i) => (e.alive = i <= limit))
    a.s.volleys.push({ x: 0, z: 0, left: 1 })
    afterBaidengStrike(a.s, a.enemies, a.events)
    expect(a.s.ring).toBeNull()

    swarm[limit].alive = false
    afterBaidengStrike(a.s, a.enemies, a.events)
    const emperor = a.enemies.find((e) => e.emperor)!
    expect(a.s.ring?.center).toEqual(emperor.pos)
    expect(swarm.filter((e) => e.alive).every((e) => e.routed)).toBe(true)
    // Bekleyen halka iptal: çember kurulunca arbaletler susar.
    expect(a.s.volleys).toHaveLength(0)
    expect(a.events).toEqual([{ type: 'encircle', center: a.s.ring!.center, routed: limit }])
  })

  it('çember kapanırken komuta grubu içinde kalır; muhafız yaşadıkça barış yok', () => {
    const a = army()
    const emperor = a.enemies.find((e) => e.emperor)!
    a.s.ring = { center: { ...emperor.pos }, t: 0 }
    const player: Vec2 = { x: emperor.pos.x + 3, z: emperor.pos.z }
    expect(ringRadius(a.s.ring)).toBe(BAIDENG.ringFrom)
    for (let t = 0; t < BAIDENG.ringClose + 2; t += DT) {
      stepCommand(a.s, a.enemies, player, DT)
      stepPeace(a.s, a.enemies, a.events)
    }
    expect(ringClosed(a.s.ring)).toBe(true)
    expect(ringRadius(a.s.ring)).toBe(BAIDENG.ringTo)
    for (const e of a.enemies.filter((x) => x.corps === COMMAND)) {
      const d = Math.hypot(e.pos.x - a.s.ring.center.x, e.pos.z - a.s.ring.center.z)
      expect(d).toBeLessThanOrEqual(BAIDENG.ringTo)
    }
    expect(a.s.peace).toBe(false)

    for (const g of a.enemies.filter((e) => e.guard)) g.alive = false
    stepPeace(a.s, a.enemies, a.events)
    expect(a.s.peace).toBe(true)
    // Gaozu esir düşmez, ölmez: savaş alanından çekilir.
    expect(emperor.alive).toBe(false)
    expect(emperor.fled).toBe(true)
    expect(a.events.at(-1)).toEqual({ type: 'peace' })
  })

  it('çember kapanmadan son muhafız düşse de barış çember kapanınca gelir', () => {
    const a = army()
    a.s.ring = { center: { x: 0, z: -25 }, t: 0 }
    for (const g of a.enemies.filter((e) => e.guard)) g.alive = false
    stepPeace(a.s, a.enemies, a.events)
    expect(a.s.peace).toBe(false)
    a.s.ring.t = BAIDENG.ringClose
    stepPeace(a.s, a.enemies, a.events)
    expect(a.s.peace).toBe(true)
  })
})

describe('Baideng — denge', () => {
  it('tam canla başlayan uzman Baideng\'i neredeyse her zaman bitirir', { timeout: 30000 }, () => {
    const runs = Array.from({ length: 12 }, (_, i) => runWaves(kiter(SKILLS.expert, i + 1), undefined, true, true, 1, 3))
    expect(runs.filter((r) => r.result === 'victory').length).toBeGreaterThanOrEqual(10)
  })
})
