// Selçuklu kollarının kuralları ve denge sözleri (bkz. wings.ts).

import { describe, expect, it } from 'vitest'
import { BATTLE_CONFIG, CENTER, createBattle, stepBattle, type BattleState } from './corps'
import {
  ambushWings,
  eagerWings,
  harassWings,
  passiveBot,
  provokerBot,
  safeHarasser,
  sweep,
  withWings,
  type WingPolicy,
} from './battleBots'
import { nextOrder, orderWing, WING_CONFIG, type WingOrder } from './wings'
import type { Enemy, Vec2 } from './types'

const DT = 1 / 60
/** Ordudan çok uzak: oyuncunun tacizi yok, hamle yok. */
const FAR: Vec2 = { x: 0, z: 28 }
const LEFT = 0
const RIGHT = 1

function run(b: BattleState, enemies: Enemy[], seconds: number): void {
  for (let t = 0; t < seconds; t += DT) stepBattle(b, enemies, FAR, DT)
}

/** Gün batımından bir kare önce: sonraki adım dönüşü başlatır. */
/** Gün batımından `delay` sn sonra iki kola HÜCUM; öncesinde pusu. */
const lateCharge =
  (delay: number): WingPolicy =>
  (b) =>
    b.time < b.layout.dayLength + delay ? ['ambush', 'ambush'] : ['charge', 'charge']

/** Gündüz sabırsız; akşam yorgun kolu dinlendirir, gücü `ready`'ye varınca hücum. */
const restAtDusk =
  (ready: number): WingPolicy =>
  (b) =>
    b.time < b.layout.dayLength
      ? ['charge', 'charge']
      : b.wings.map((w): WingOrder => (w.order === 'charge' || w.strength >= ready ? 'charge' : 'ambush'))

function atSunset(seed = 1) {
  const s = createBattle(seed)
  s.battle.time = BATTLE_CONFIG.dayLength - DT / 2
  return s
}

describe('Selçuklu kolları — kurallar', () => {
  it('emirler sırayla döner: pusu → taciz → hücum → pusu', () => {
    expect(nextOrder('ambush')).toBe('harass')
    expect(nextOrder('harass')).toBe('charge')
    expect(nextOrder('charge')).toBe('ambush')
  })

  it('kollar pusuda başlar; pusudaki kol savaşa dokunmaz', () => {
    const { battle, enemies } = createBattle(1)
    run(battle, enemies, 30)
    for (const w of battle.wings) {
      expect(w.order).toBe('ambush')
      expect(w.strength).toBe(1)
    }
    expect(battle.corps.every((c) => c.cohesion === 1 && c.pinned === 0)).toBe(true)
  })

  it('taciz eden kol karşısındaki kanadı yıpratır, yavaşlatır ve yorulur', () => {
    const { battle, enemies } = createBattle(1)
    orderWing(battle.wings[LEFT], 'harass')
    run(battle, enemies, 40)
    const [left, , right] = battle.corps
    expect(left.cohesion).toBeLessThan(0.9)
    expect(left.cohesion).toBeGreaterThanOrEqual(BATTLE_CONFIG.dayFloor)
    expect(right.cohesion).toBe(1)
    expect(left.anchor.z).toBeLessThan(right.anchor.z)
    expect(battle.wings[LEFT].strength).toBeLessThan(1)
    expect(battle.wings[RIGHT].strength).toBe(1)
  })

  it('gündüz hücum ilerleyişi durdurmaz: düzenli birlik karşılar, kol çabuk yorulur', () => {
    const harass = createBattle(1)
    const charge = createBattle(1)
    orderWing(harass.battle.wings[LEFT], 'harass')
    orderWing(charge.battle.wings[LEFT], 'charge')
    run(harass.battle, harass.enemies, 15)
    run(charge.battle, charge.enemies, 15)
    const c = charge.battle.corps[LEFT]
    expect(c.status).toBe('advancing')
    expect(c.pinned).toBe(0)
    expect(c.anchor.z).toBeGreaterThan(BATTLE_CONFIG.armyStartZ)
    expect(charge.battle.wings[LEFT].strength).toBeLessThan(harass.battle.wings[LEFT].strength)
  })

  it('akşam dönen birliğe hücum: ilk darbe düzeni sarsar, birlik tutulur, dönüşü uzar', () => {
    const { battle, enemies } = atSunset()
    // Kol yerinde beklesin: varış süresi ölçümü bulandırmasın.
    const w = battle.wings[LEFT]
    orderWing(w, 'charge')
    const anchor = battle.corps[LEFT].anchor
    w.pos = { x: anchor.x - WING_CONFIG.chargeOffset, z: anchor.z }
    stepBattle(battle, enemies, FAR, DT)
    run(battle, enemies, 1)

    expect(battle.events).toContain('wingShockLeft')
    const [left, , right] = battle.corps
    expect(left.cohesion).toBeLessThan(right.cohesion - WING_CONFIG.shock * 0.9)
    expect(left.pinned).toBeGreaterThan(0.9)
    // Aynı süre dönen iki kanattan tutulanın çarkı geride.
    expect(left.turn).toBeLessThan(right.turn)
    // İlk darbe hücum başına bir kez.
    run(battle, enemies, 2)
    expect(battle.events.filter((e) => e === 'wingShockLeft')).toHaveLength(1)
  })

  it('yorgun kol pusuya döner, dinlenmeden çıkmaz, pusuda dinlenir', () => {
    const { battle, enemies } = createBattle(1)
    const w = battle.wings[LEFT]
    orderWing(w, 'charge')
    w.strength = WING_CONFIG.minStrength + 0.02
    run(battle, enemies, 10)
    expect(w.order).toBe('ambush')
    expect(battle.events).toContain('wingTiredLeft')
    expect(orderWing(w, 'harass')).toBe(false)

    run(battle, enemies, 20)
    expect(w.strength).toBeGreaterThan(WING_CONFIG.readyStrength)
    expect(orderWing(w, 'harass')).toBe(true)
  })

  it('kanadı kalmayan kollar merkeze kapanır; akşam merkezi tutarlarsa imparatorun arkası açılır', () => {
    const { battle, enemies } = atSunset()
    for (const e of enemies) if (e.corps === 0 || e.corps === 2) e.alive = false
    battle.corps[CENTER].cohesion = 0.7
    for (const w of battle.wings) orderWing(w, 'charge')
    run(battle, enemies, 12)

    expect(battle.wings.every((w) => w.target === CENTER)).toBe(true)
    expect(battle.rearguardLeft).toBe(false)
    expect(battle.emperorExposed).toBe(true)
  })
})

describe('Selçuklu kolları — denge (bot ölçütleri)', () => {
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

  it('kollar pasif oyuncuyu kurtarmaz', () => {
    for (const policy of [harassWings, eagerWings]) {
      for (const r of sweep(withWings(passiveBot, policy), SEEDS.slice(0, 3))) {
        expect(r.result).toBe('defeat')
      }
    }
  })

  it('kolları akşama saklamak işe yarar: kolsuzdan çok düşürür', { timeout: 30000 }, () => {
    const safe = sweep(safeHarasser(), SEEDS)
    const safeAmbush = sweep(withWings(safeHarasser(), ambushWings), SEEDS)
    expect(mean(safeAmbush.map((r) => r.fallen))).toBeGreaterThan(mean(safe.map((r) => r.fallen)) + 4)
    expect(mean(safeAmbush.map((r) => r.score))).toBeGreaterThan(mean(safe.map((r) => r.score)))

    const provoker = sweep(provokerBot, SEEDS)
    const provokerAmbush = sweep(withWings(provokerBot, ambushWings), SEEDS)
    expect(mean(provokerAmbush.map((r) => r.score))).toBeGreaterThan(
      mean(provoker.map((r) => r.score)),
    )
  })

  it('baskın tarif riskli: kolları gündüz tüketen imparatoru açamaz, pusudaki kollar açar (O1)', { timeout: 60000 }, () => {
    const seeds = Array.from({ length: 30 }, (_, i) => i + 1)
    const threeStars = (runs: { stars: number }[]) => runs.filter((r) => r.stars === 3).length / runs.length
    const eager = threeStars(sweep(withWings(provokerBot, eagerWings), seeds))
    const ambush = threeStars(sweep(withWings(provokerBot, ambushWings), seeds))
    expect(eager).toBeLessThanOrEqual(0.7)
    expect(ambush).toBeGreaterThanOrEqual(Math.max(eager, 0.7))
  })

  it('pencere insan tepkisine yeter; kolları akşam dinlendiren geç kalır', { timeout: 30000 }, () => {
    const late = sweep(withWings(provokerBot, lateCharge(10)), SEEDS)
    expect(late.filter((r) => r.stars === 3).length).toBeGreaterThanOrEqual(SEEDS.length / 2)
    const rested = sweep(withWings(provokerBot, restAtDusk(0.5)), SEEDS)
    expect(rested.every((r) => r.stars < 3)).toBe(true)
  })

  it('kolları gündüz tüketen akşamı zayıf karşılar', { timeout: 30000 }, () => {
    const ambush = sweep(withWings(safeHarasser(), ambushWings), SEEDS)
    const eager = sweep(withWings(safeHarasser(), eagerWings), SEEDS)
    // Gün batımında pusudan çıkan kol taze, sabırsız kol tükenmiş.
    expect(Math.min(...ambush.map((r) => Math.min(...r.duskWingStrength)))).toBe(1)
    expect(mean(eager.map((r) => Math.max(...r.duskWingStrength)))).toBeLessThan(0.5)
    expect(mean(eager.map((r) => r.fallen))).toBeLessThan(mean(ambush.map((r) => r.fallen)))
  })
})
