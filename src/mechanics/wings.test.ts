// Selçuklu kollarının kuralları ve denge sözleri (bkz. wings.ts).

import { describe, expect, it } from 'vitest'
import {
  BATTLE_CONFIG,
  CENTER,
  createBattle,
  MIRYOKEFALON,
  MODE_CHARGE,
  REARGUARD,
  stepBattle,
  type BattleState,
} from './corps'
import {
  ambushWings,
  baiterBot,
  eagerWings,
  harassWings,
  passiveBot,
  provokerBot,
  runBattle,
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

/** Gün batımından bir kare önce: sonraki adım dönüşü başlatır. */
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

  it('erken salınan kol dönmemiş hatta çarpar: darbe boşa gider, emri yenileyen sarsar', () => {
    const { battle, enemies } = atSunset()
    battle.time -= 1
    const w = battle.wings[LEFT]
    orderWing(w, 'charge')
    const anchor = battle.corps[LEFT].anchor
    w.pos = { x: anchor.x - WING_CONFIG.chargeOffset, z: anchor.z }
    run(battle, enemies, 0.5)
    expect(battle.events).toContain('wingMetLeft')

    // Sancak döndü, kanat çark ediyor: aynı hücumun darbesi çoktan harcandı.
    run(battle, enemies, 1)
    expect(battle.corps[LEFT].status).toBe('turning')
    expect(battle.events).not.toContain('wingShockLeft')

    orderWing(w, 'ambush')
    orderWing(w, 'charge')
    run(battle, enemies, 0.5)
    expect(battle.events).toContain('wingShockLeft')
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

describe('Yem bölük — kurallar', () => {
  /**
   * Birliğin ilk `n` askeri, kolun pusu yerinin 4 birim önünde oyuncuyu
   * (pusu yerinde) kovalıyor.
   */
  function bait(seed: number, corps: number, side: -1 | 1, n = 4) {
    const s = createBattle(seed)
    const w = s.battle.wings[side < 0 ? LEFT : RIGHT]
    const player = { ...w.home }
    s.enemies
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.corps === corps && !e.emperor)
      .slice(0, n)
      .forEach(({ e, i }, k) => {
        e.pos = { x: w.home.x + (k - n / 2), z: w.home.z - 4 }
        s.battle.mode[i] = MODE_CHARGE
        s.battle.modeTimer[i] = BATTLE_CONFIG.chargeDuration
      })
    return { ...s, w, player }
  }
  const step = (s: ReturnType<typeof bait>) => stepBattle(s.battle, s.enemies, s.player, DT)

  it('pusudaki kola yaklaşan hamle bölüğü kesilir; kanadın komutanı esir düşer', () => {
    const s = bait(1, LEFT, -1)
    const before = s.battle.corps[LEFT].alive
    step(s)
    expect(s.battle.events).toEqual(expect.arrayContaining(['ambushLeft', 'commanderCaptured']))
    expect(s.battle.corps[LEFT].alive).toBe(before - 4)
    expect(s.enemies.filter((e) => e.corps === LEFT && !e.alive)).toHaveLength(4)
    expect(s.battle.corps[LEFT].leaderless).toBe(true)
    expect(s.w.sprung).toBe(true)
    expect(s.w.strength).toBeCloseTo(1 - BATTLE_CONFIG.ambushCost)
    expect(s.battle.ambushes).toEqual([
      expect.objectContaining({ corps: LEFT, side: -1, taken: 4, commander: true }),
    ])
  })

  it('pusu kol başına bir kez tutar', () => {
    const s = bait(1, LEFT, -1, 2)
    step(s)
    // İkinci bölük aynı yerden kovalıyor: pusunun yeri artık biliniyor.
    const next = s.enemies
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.alive && e.corps === LEFT)
      .slice(0, 3)
    for (const { e, i } of next) {
      e.pos = { x: s.w.home.x, z: s.w.home.z - 4 }
      s.battle.mode[i] = MODE_CHARGE
      s.battle.modeTimer[i] = BATTLE_CONFIG.chargeDuration
    }
    step(s)
    expect(s.battle.events.filter((e) => e === 'ambushLeft')).toHaveLength(1)
    expect(next.every(({ e }) => e.alive)).toBe(true)
  })

  it('merkezin ve artçının bölüğü kesilir ama komutanı esir düşmez', () => {
    for (const corps of [CENTER, REARGUARD]) {
      const s = bait(1, corps, 1, 3)
      step(s)
      expect(s.battle.events).toContain('ambushRight')
      expect(s.battle.events).not.toContain('commanderCaptured')
      expect(s.battle.corps[corps].leaderless).toBe(false)
      expect(s.battle.ambushes[0]).toEqual(expect.objectContaining({ corps, taken: 3, commander: false }))
    }
  })

  it('yorgun, emirdeki ya da yerinde olmayan kol pusu kurmaz; geçitte pusu yok', () => {
    const tired = bait(1, LEFT, -1)
    tired.w.strength = WING_CONFIG.readyStrength - 0.05
    const ordered = bait(1, LEFT, -1)
    orderWing(ordered.w, 'harass')
    const away = bait(1, LEFT, -1)
    away.w.pos = { x: away.w.home.x + 3, z: away.w.home.z }
    for (const s of [tired, ordered, away]) {
      step(s)
      expect(s.battle.events).not.toContain('ambushLeft')
    }

    const pass = createBattle(1, MIRYOKEFALON)
    const w = pass.battle.wings[LEFT]
    const i = pass.enemies.findIndex((e) => !e.emperor)
    pass.enemies[i].pos = { x: w.home.x, z: w.home.z - 1 }
    pass.battle.mode[i] = MODE_CHARGE
    pass.battle.modeTimer[i] = BATTLE_CONFIG.chargeDuration
    stepBattle(pass.battle, pass.enemies, { ...w.home }, DT)
    expect(pass.battle.events.some((e) => e === 'ambushLeft' || e === 'ambushRight')).toBe(false)
  })

  it('komutansız kanadın akşam çarkı uzar; kol onu bırakıp merkeze kapanır', () => {
    const s = bait(1, LEFT, -1)
    step(s)
    s.battle.corps[LEFT].cohesion = s.battle.corps[2].cohesion
    s.battle.time = BATTLE_CONFIG.dayLength - DT / 2
    s.battle.events.length = 0
    step(s)
    expect(s.battle.events).toContain('corpsBreaks')
    const [left, , right] = s.battle.corps
    expect(left.status).toBe('turning')
    expect(left.turnDuration).toBeCloseTo(right.turnDuration * BATTLE_CONFIG.leaderlessTurn)

    orderWing(s.w, 'charge')
    orderWing(s.battle.wings[RIGHT], 'charge')
    step(s)
    expect(s.w.target).toBe(CENTER)
    expect(s.battle.wings[RIGHT].target).toBe(2)
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

  // Sancak penceresi (merkezin çarkı) yıpranmış merkezde ~6 sn; kolların
  // merkeze varması ~2 sn. 30 tohumda 3★: 2 sn'de salan 25, 3,5 sn'de 16, 4 sn'de 0.
  it('sancak penceresi insan tepkisine yeter, geç salan kaçırır; kolları akşam dinlendiren geç kalır', { timeout: 30000 }, () => {
    const quick = sweep(withWings(provokerBot, lateCharge(2)), SEEDS)
    expect(quick.filter((r) => r.stars === 3).length).toBeGreaterThanOrEqual(SEEDS.length / 2)
    const late = sweep(withWings(provokerBot, lateCharge(6)), SEEDS)
    expect(late.every((r) => r.stars < 3)).toBe(true)
    const rested = sweep(withWings(provokerBot, restAtDusk(0.5)), SEEDS)
    expect(rested.every((r) => r.stars < 3)).toBe(true)
  })

  // 30 tohumda (kışkırtıcı → yemci): 3★ 27 → 28, düşen 19,0 → 23,2, puan 5847 → 5807;
  // yemci 60 pusunun 53'ünde kanat komutanını esir aldı.
  it('yem bölük: hamle edeni pusuya çeken her kolla bir bölük keser, daha çok düşürür', { timeout: 30000 }, () => {
    const runs = (bot: () => ReturnType<typeof provokerBot>) =>
      SEEDS.map((seed) => {
        const ambushes: { commander: boolean }[] = []
        const r = runBattle(bot(), seed, (e) => {
          if (e.type === 'ambush') ambushes.push(e)
        })
        return { ...r, ambushes }
      })
    const provoker = runs(withWings(provokerBot, ambushWings))
    const baiter = runs(withWings(baiterBot, ambushWings))
    for (const r of baiter) {
      expect(r.ambushes).toHaveLength(2)
      expect(r.ambushes.some((a) => a.commander)).toBe(true)
    }
    expect(mean(baiter.map((r) => r.fallen))).toBeGreaterThan(mean(provoker.map((r) => r.fallen)) + 2)
    expect(baiter.filter((r) => r.stars === 3).length).toBeGreaterThanOrEqual(
      provoker.filter((r) => r.stars === 3).length,
    )
    expect(mean(baiter.map((r) => r.score))).toBeGreaterThan(mean(provoker.map((r) => r.score)) * 0.95)
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
