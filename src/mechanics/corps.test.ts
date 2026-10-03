// Alp Arslan savaşının kuralları ve denge sözleri.
//
// İlk blok kuralları tek tek sabitler (taciz, hamle, dönüş, artçı, imparator,
// vuruş bütçesi). İkinci blok tasarım belgesinin bot ölçütleridir: bir sabit
// oynanıp bunlardan biri bozulursa test kırılır. Bot döngüsü GameDirector'ın
// savaş kolunu izler (bkz. battleBots.ts).

import { describe, expect, it } from 'vitest'
import {
  afterStrike,
  BATTLE_CONFIG,
  battleSiege,
  BATTLE_SIZE,
  CENTER,
  CORPS,
  createBattle,
  harassEffect,
  MODE_CHARGE,
  MODE_FORMATION,
  MODE_TELEGRAPH,
  REARGUARD,
  resolveBattle,
  stepBattle,
  strikeBudget,
  type BattleState,
} from './corps'
import { greedyBot, passiveBot, provokerBot, safeHarasser, sweep } from './battleBots'
import { calcFacing, countInCrescent, executeStrike } from './hilalSystem'
import type { Enemy, Vec2 } from './types'

const DT = 1 / 60
/** Ordudan çok uzak: taciz yok, hamle yok. */
const FAR: Vec2 = { x: 0, z: 28 }

function run(b: BattleState, enemies: Enemy[], player: Vec2, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) stepBattle(b, enemies, player, DT)
}

/**
 * Birliğin ekseninde, ön safının `dist` önünde bir nokta. Eksende: komşu
 * birliğin kenar askerinden hamle tetiğinin ötesinde kalsın.
 */
function inFrontOf(enemies: readonly Enemy[], corps: number, dist: number): Vec2 {
  const soldiers = enemies.filter((e) => e.alive && e.corps === corps)
  const x = soldiers.reduce((s, e) => s + e.pos.x, 0) / soldiers.length
  const frontZ = Math.max(...soldiers.map((e) => e.pos.z))
  return { x, z: frontZ + dist }
}

describe('Alp Arslan — kurallar', () => {
  it('ordu dört birlik ve korunan bir imparatordan oluşur', () => {
    const { battle, enemies } = createBattle(1)
    expect(enemies).toHaveLength(BATTLE_SIZE)
    CORPS.forEach((def, ci) => {
      const soldiers = enemies.filter((e) => e.corps === ci && !e.emperor)
      expect(soldiers).toHaveLength(def.size)
    })
    const emperors = enemies.filter((e) => e.emperor)
    expect(emperors).toHaveLength(1)
    expect(emperors[0].corps).toBe(CENTER)
    expect(emperors[0].guarded).toBe(true)
    expect(battle.corps.every((c) => c.cohesion === 1 && c.status === 'advancing')).toBe(true)
  })

  it('taciz etkisi yakında tam, menzilin dış sınırında zayıf, ötesinde yok', () => {
    expect(harassEffect(3)).toBe(1)
    expect(harassEffect(BATTLE_CONFIG.harassNear)).toBe(1)
    expect(harassEffect(BATTLE_CONFIG.harassFar)).toBeCloseTo(BATTLE_CONFIG.harassFarEffect)
    expect(harassEffect(BATTLE_CONFIG.harassFar + 0.1)).toBe(0)
  })

  it('taciz edilen birliğin düzeni düşer ama gündüz tabanın altına inmez', () => {
    const { battle, enemies } = createBattle(1)
    const player = inFrontOf(enemies, 0, 8)
    // Oyuncu yerinde; birlik ilerledikçe mesafe kapanır, hamle de gelebilir —
    // burada yalnızca düzenin tabanı ölçülüyor.
    run(battle, enemies, player, 60)
    expect(battle.corps[0].cohesion).toBeGreaterThanOrEqual(BATTLE_CONFIG.dayFloor)
    expect(battle.corps[0].cohesion).toBeLessThan(0.75)
    // Uzaktaki birlik yıpranmadı.
    expect(battle.corps[2].cohesion).toBe(1)
  })

  it('taciz edilen birlik daha yavaş ilerler', () => {
    const a = createBattle(1)
    const b = createBattle(1)
    run(a.battle, a.enemies, FAR, 10)
    run(b.battle, b.enemies, inFrontOf(b.enemies, CENTER, 9), 10)
    expect(b.battle.corps[CENTER].anchor.z).toBeLessThan(a.battle.corps[CENTER].anchor.z)
  })

  it('dibinde oyalanan oyuncuya en yakın askerler uyarıdan sonra hamle eder', () => {
    const { battle, enemies } = createBattle(1)
    const player = inFrontOf(enemies, CENTER, 4)
    run(battle, enemies, player, BATTLE_CONFIG.chargeDwell + 0.05)
    const telegraph = enemies.filter((_, i) => battle.mode[i] === MODE_TELEGRAPH)
    expect(telegraph).toHaveLength(BATTLE_CONFIG.chargeSize)
    expect(telegraph.every((e) => e.corps === CENTER && !e.emperor)).toBe(true)
    expect(battle.corps[CENTER].cohesion).toBeLessThan(1)
    expect(battle.events).toContain('charge')
    // Sunum için: hangi birlik, nereden (hamle edenlerin ortası).
    expect(battle.charges).toHaveLength(1)
    expect(battle.charges[0].corps).toBe(CENTER)
    const n = telegraph.length
    const midX = telegraph.reduce((sum, e) => sum + e.pos.x / n, 0)
    const midZ = telegraph.reduce((sum, e) => sum + e.pos.z / n, 0)
    expect(Math.hypot(battle.charges[0].pos.x - midX, battle.charges[0].pos.z - midZ)).toBeLessThan(1)

    run(battle, enemies, player, BATTLE_CONFIG.chargeTelegraph)
    expect(enemies.filter((_, i) => battle.mode[i] === MODE_CHARGE)).toHaveLength(
      BATTLE_CONFIG.chargeSize,
    )
    run(battle, enemies, FAR, BATTLE_CONFIG.chargeDuration + 0.1)
    expect(battle.mode.every((m) => m === MODE_FORMATION)).toBe(true)
  })

  it('gün batımında ordu döner; artçı yıprandıysa savaş alanını terk eder', () => {
    const { battle, enemies } = createBattle(1)
    battle.corps[REARGUARD].cohesion = BATTLE_CONFIG.rearguardThreshold - 0.05
    battle.corps[0].cohesion = 0.6
    battle.time = BATTLE_CONFIG.dayLength - DT / 2
    stepBattle(battle, enemies, FAR, DT)

    expect(battle.events).toContain('sunset')
    expect(battle.rearguardLeft).toBe(true)
    expect(battle.corps[REARGUARD].status).toBe('fleeing')
    expect(battle.corps[0].status).toBe('turning')
    // Düzeni düşük birliğin dönüşü uzun.
    expect(battle.corps[0].turnDuration).toBeGreaterThan(battle.corps[2].turnDuration)

    // Terk eden askerler düşmüş değil, kaçmış sayılır.
    run(battle, enemies, FAR, 20)
    const rear = enemies.filter((e) => e.corps === REARGUARD)
    expect(rear.every((e) => !e.alive && e.fled)).toBe(true)
  })

  it('dönüşün ortasında disiplin sıfıra iner, sonra birlik çekilir', () => {
    const { battle, enemies } = createBattle(1)
    battle.time = BATTLE_CONFIG.dayLength
    // Gün batımı olayını tetiklemek için bir kare önce başla.
    battle.time -= DT / 2
    stepBattle(battle, enemies, FAR, DT)
    const c = battle.corps[0]
    run(battle, enemies, FAR, c.turnDuration / 2 - DT)
    const soldier = enemies.find((e) => e.corps === 0)!
    expect(soldier.discipline).toBeLessThan(0.05)
    run(battle, enemies, FAR, c.turnDuration / 2 + 0.1)
    expect(c.status).toBe('withdrawing')
    expect(soldier.discipline).toBeCloseTo(c.cohesion)
  })

  it('imparator yalnızca artçı gittiyse ve merkez yıprandıysa korumasız kalır', () => {
    const exposed = createBattle(1)
    exposed.battle.corps[REARGUARD].cohesion = 0.7
    exposed.battle.corps[CENTER].cohesion = 0.65
    exposed.battle.time = BATTLE_CONFIG.dayLength - DT / 2
    stepBattle(exposed.battle, exposed.enemies, FAR, DT)
    expect(exposed.battle.emperorExposed).toBe(true)
    expect(exposed.enemies.find((e) => e.emperor)!.guarded).toBe(false)

    const guarded = createBattle(1)
    guarded.battle.corps[REARGUARD].cohesion = 0.7
    guarded.battle.corps[CENTER].cohesion = 0.9
    guarded.battle.time = BATTLE_CONFIG.dayLength - DT / 2
    stepBattle(guarded.battle, guarded.enemies, FAR, DT)
    expect(guarded.battle.emperorExposed).toBe(false)
  })

  it('korunan imparator yayda olsa da düşmez; korumasız olan esir alınır', () => {
    const { battle, enemies } = createBattle(1)
    const emperor = enemies.find((e) => e.emperor)!
    // Yalnızca imparator kalsın: yayın hedefi o.
    for (const e of enemies) if (!e.emperor) e.alive = false
    const origin = { x: emperor.pos.x, z: emperor.pos.z + 6 }
    const facing = calcFacing(enemies, origin, Math.PI, emperor.pos)

    expect(executeStrike(enemies, origin, facing, undefined, strikeBudget(battle))).toBe(0)
    expect(emperor.alive).toBe(true)

    emperor.guarded = false
    battle.emperorExposed = true
    expect(executeStrike(enemies, origin, Math.PI, undefined, strikeBudget(battle))).toBe(1)
    afterStrike(battle, enemies)
    expect(battle.emperorCaptured).toBe(true)
    expect(resolveBattle(battle, enemies, 50)).toBe('victory')
  })

  it('vuruş birliğin yalnızca düzeni bozulmuş kısmını düşürür', () => {
    const { battle, enemies } = createBattle(1)
    const wing = 0
    const size = CORPS[wing].size
    // Kanadın önünden, tüm kanadı yaya alacak mesafe.
    const origin = inFrontOf(enemies, wing, 8)
    const inArc = countInCrescent(enemies, origin, Math.PI)
    expect(inArc).toBeGreaterThanOrEqual(size)

    // Tam düzen: kimse düşmez.
    expect(countInCrescent(enemies, origin, Math.PI, strikeBudget(battle))).toBe(0)
    // Gündüz tabanı: %40.
    battle.corps[wing].cohesion = BATTLE_CONFIG.dayFloor
    expect(countInCrescent(enemies, origin, Math.PI, strikeBudget(battle))).toBe(
      Math.round(size * (1 - BATTLE_CONFIG.dayFloor)),
    )
    // Dönüşün ortası: hepsi.
    battle.corps[wing].status = 'turning'
    battle.corps[wing].turn = 0.5
    expect(countInCrescent(enemies, origin, Math.PI, strikeBudget(battle))).toBe(size)
  })

  it('gündüz vuruşu tüm orduyu toparlar, akşam vuruşu toparlamaz', () => {
    const day = createBattle(1)
    day.battle.corps.forEach((c) => (c.cohesion = 0.6))
    afterStrike(day.battle, day.enemies)
    expect(day.battle.corps.every((c) => c.cohesion === 0.6 + BATTLE_CONFIG.strikeRecovery)).toBe(
      true,
    )

    const dusk = createBattle(1)
    dusk.battle.time = BATTLE_CONFIG.dayLength + 1
    dusk.battle.corps.forEach((c) => (c.cohesion = 0.6))
    afterStrike(dusk.battle, dusk.enemies)
    expect(dusk.battle.corps.every((c) => c.cohesion === 0.6)).toBe(true)
  })

  it('kuşatılabilirlik en savunmasız birlikten gelir', () => {
    const { battle, enemies } = createBattle(1)
    expect(battleSiege(battle, enemies).vulnerability).toBe(0)
    for (const e of enemies) if (e.corps === 2) e.discipline = 0.3
    const siege = battleSiege(battle, enemies)
    expect(siege.vulnerability).toBeGreaterThan(0.4)
    expect(siege.aliveCount).toBe(BATTLE_SIZE)
  })

  it('ordu gündüz ordugaha varırsa yenilgi, gece çökerse zafer', () => {
    const camp = createBattle(1)
    camp.battle.corps.forEach((c) => (c.anchor.z = BATTLE_CONFIG.campZ + 0.1))
    stepBattle(camp.battle, camp.enemies, FAR, DT)
    expect(resolveBattle(camp.battle, camp.enemies, 100)).toBe('defeat')

    const night = createBattle(1)
    night.battle.time = BATTLE_CONFIG.nightAt
    expect(resolveBattle(night.battle, night.enemies, 100)).toBe('victory')
    expect(resolveBattle(night.battle, night.enemies, 0)).toBe('defeat')
  })

  it('simülasyon karesi 100 µs altında kalır', () => {
    const { battle, enemies } = createBattle(1)
    const player = inFrontOf(enemies, CENTER, 9)
    let facing = Math.PI
    const frames = 3000
    // Isınma: JIT derlesin.
    for (let i = 0; i < 300; i++) stepBattle(battle, enemies, player, DT)
    const start = performance.now()
    for (let i = 0; i < frames; i++) {
      stepBattle(battle, enemies, player, DT)
      const siege = battleSiege(battle, enemies)
      facing = calcFacing(enemies, player, facing, siege.centroid)
      countInCrescent(enemies, player, facing, strikeBudget(battle))
    }
    const perFrameUs = ((performance.now() - start) / frames) * 1000
    expect(perFrameUs).toBeLessThan(100)
  })
})

describe('Alp Arslan — denge (bot ölçütleri)', () => {
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

  it('pasif oyuncu kaybeder: taciz şart', () => {
    for (const r of sweep(passiveBot, SEEDS.slice(0, 3))) {
      expect(r.result).toBe('defeat')
    }
  })

  it('güvenli tacizci hayatta kalır: 1-2 yıldız, can %50 üstü', { timeout: 20000 }, () => {
    for (const r of sweep(safeHarasser(), SEEDS)) {
      expect(r.result).toBe('victory')
      expect(r.stars).toBeGreaterThanOrEqual(1)
      expect(r.stars).toBeLessThanOrEqual(2)
      expect(r.health).toBeGreaterThan(50)
      // Akşam dönüşü gerçek bir kuşatma fırsatı: en az 6 askerlik vuruş.
      expect(r.bestDuskStrike).toBeGreaterThanOrEqual(6)
    }
  })

  it('kışkırtıcı tohumların en az yarısında imparatoru esir alır', { timeout: 20000 }, () => {
    const runs = sweep(provokerBot, SEEDS)
    const threeStars = runs.filter((r) => r.stars === 3).length
    expect(threeStars).toBeGreaterThanOrEqual(SEEDS.length / 2)
  })

  it('hilali gündüz harcayan açgözlü bot kışkırtıcıdan az puan alır', { timeout: 20000 }, () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const greedy = mean(sweep(greedyBot, SEEDS).map((r) => r.score))
    const provoker = mean(sweep(provokerBot, SEEDS).map((r) => r.score))
    expect(greedy).toBeLessThan(provoker)
  })
})
