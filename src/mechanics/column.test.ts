// II. Kılıçarslan — Miryokefalon: geçit, kol, sıkışma ve YOLU KES.
//
// İlk blok kuralları sabitler; ikinci blok tasarımın sözünü bot taramasıyla:
// NEREDE kestiğin sonucu belirler. Tarama sırasında iki tasarım hatası
// yakalandı ve buradaki ölçütlerle kilitlendi: (1) tacizle yavaşlayan baş da
// kolu sıkıştırıyordu, yığının yeri hiçbir şeyi değiştirmiyordu — sıkışma
// artık yalnızca sert duruştan birikir; (2) geçit baştan sona dar olduğu için
// her yerde aynı sonuç çıkıyordu — huni kısaldı.

import { describe, expect, it } from 'vitest'
import { blockerBot, passiveBot, sweep } from './battleBots'
import {
  CENTER,
  COLUMN_CONFIG,
  createBattle,
  dropBlockade,
  MIRYOKEFALON,
  MODE_CHARGE,
  stepBattle,
  type BattleState,
} from './corps'
import { confineToPass, narrowness, PASS, passHalfWidth } from './pass'
import type { Enemy, Vec2 } from './types'

const DT = 1 / 60
/** Kolun hiçbir yerinden taciz menziline girmeyen bir nokta (sahanın dışı). */
const FAR: Vec2 = { x: 0, z: 60 }

function run(b: BattleState, enemies: Enemy[], player: Vec2, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) stepBattle(b, enemies, player, DT)
}

function column() {
  return createBattle(3, MIRYOKEFALON)
}

describe('Miryokefalon — geçit ve kol', () => {
  it('geçit boğazda en dar, iki yana açılır; oyuncu duvarların arasında kalır', () => {
    expect(passHalfWidth(PASS.neckZ)).toBe(PASS.neckHalf)
    expect(passHalfWidth(PASS.entryZ)).toBe(PASS.wideHalf)
    expect(passHalfWidth(PASS.exitZ)).toBe(PASS.exitHalf)
    expect(narrowness(PASS.neckZ)).toBe(1)
    expect(narrowness(-15)).toBe(0)
    const p = { x: 20, z: PASS.neckZ }
    confineToPass(p)
    expect(Math.abs(p.x)).toBeLessThan(PASS.neckHalf)
  })

  it('kol güneyden kuzeye yürür; kimse yolu kesmezse geçidi aşar', () => {
    const { battle, enemies } = column()
    expect(battle.corps.map((c) => c.anchor.z)).toEqual([...battle.corps.map((c) => c.anchor.z)].sort((a, b) => b - a))
    run(battle, enemies, FAR, 120)
    expect(battle.reachedCamp).toBe(true)
  })

  it('yavaşlayan baş kolu sıkıştırmaz; yalnızca sert duruş sıkıştırır', () => {
    const slowed = column()
    // Öncüyü sürekli yavaşlatan bir taciz: kol birlikte yavaşlar.
    for (let t = 0; t < 40; t += DT) {
      const lead = slowed.battle.corps[0].anchor
      stepBattle(slowed.battle, slowed.enemies, { x: 0, z: lead.z + 9.5 }, DT)
    }
    expect(Math.max(...slowed.battle.corps.map((c) => c.jam))).toBe(0)

    const blocked = column()
    dropBlockade(blocked.battle, PASS.neckZ + 3)
    run(blocked.battle, blocked.enemies, FAR, 60)
    expect(blocked.battle.corps[CENTER].jam).toBeGreaterThan(0.5)
  })

  it('aynı duruş boğazda genişte olduğundan çok daha sıkıştırır', () => {
    const wide = column()
    dropBlockade(wide.battle, -3)
    run(wide.battle, wide.enemies, FAR, 70)
    const neck = column()
    dropBlockade(neck.battle, PASS.neckZ + 3)
    run(neck.battle, neck.enemies, FAR, 70)
    const peak = (b: BattleState) => b.corps[CENTER].jam
    expect(peak(wide.battle)).toBeLessThanOrEqual(COLUMN_CONFIG.wideJamCap + 0.2)
    expect(peak(neck.battle)).toBeGreaterThan(peak(wide.battle) + 0.3)
  })

  it('YOLU KES savaş başına bir kez; baş yığında durur, yığın zamanla temizlenir', () => {
    const { battle, enemies } = column()
    const z = PASS.neckZ + 3
    expect(dropBlockade(battle, z)).toBe(true)
    expect(dropBlockade(battle, 0)).toBe(false)
    run(battle, enemies, FAR, 60)
    expect(battle.corps[0].anchor.z).toBeLessThanOrEqual(z - COLUMN_CONFIG.headroom + 0.01)
    expect(battle.events).toContain('blockade')
    // Taciz yokken yığın clearTime'da temizlenir, kol yürümeyi sürdürür.
    run(battle, enemies, FAR, COLUMN_CONFIG.clearTime)
    expect(battle.blockade).toBeNull()
    expect(battle.events).toContain('blockadeCleared')
  })

  it('düzendeki asker yığını aşamaz; hamle eden atlı aşar', () => {
    const { battle, enemies } = column()
    dropBlockade(battle, PASS.neckZ + 3)
    run(battle, enemies, FAR, 50)
    const bz = battle.blockade!.z
    expect(enemies.filter((e) => e.alive).every((e) => e.pos.z <= bz)).toBe(true)
    // Yığının hemen ötesindeki oyuncuya hamle: atlılar üstünden geçer.
    const player = { x: 0, z: bz + 3 }
    run(battle, enemies, player, 4)
    const chargers = enemies.filter((_, i) => battle.mode[i] === MODE_CHARGE)
    expect(chargers.some((e) => e.pos.z > bz)).toBe(true)
  })

  it('Manuel ancak merkez boğazda sıkışıp düzeni kırılınca korumasız kalır', () => {
    const { battle, enemies } = column()
    battle.corps[CENTER].jam = COLUMN_CONFIG.exposeJam - 0.05
    battle.corps[CENTER].cohesion = 0.6
    stepBattle(battle, enemies, FAR, DT)
    expect(battle.emperorExposed).toBe(false)
    battle.corps[CENTER].jam = 1
    battle.corps[CENTER].anchor.z = PASS.neckZ
    battle.corps[CENTER].limit = PASS.neckZ
    stepBattle(battle, enemies, FAR, DT)
    expect(battle.emperorExposed).toBe(true)
  })
})

describe('Miryokefalon — denge: NEREDE kestiğin belirler', () => {
  const SEEDS = [1, 2, 3, 4]

  it('pasif oyuncu kaybeder', { timeout: 20000 }, () => {
    for (const r of sweep(passiveBot, SEEDS.slice(0, 2), MIRYOKEFALON)) {
      expect(r.result).toBe('defeat')
    }
  })

  it('yolu kesmeyen yalnız taciz eder: kol geçidi aşar', { timeout: 20000 }, () => {
    for (const r of sweep(blockerBot(null, 4), SEEDS, MIRYOKEFALON)) {
      expect(r.result).toBe('defeat')
      expect(r.reachedCamp).toBe(true)
      expect(Math.max(...r.peakJam)).toBe(0)
    }
  })

  it('genişte kesen 1, boğazın ötesinde kesen 3, çıkışa yakın kesen ≤ 2 yıldız', { timeout: 60000 }, () => {
    const stars = (z: number) => sweep(blockerBot(z, 4), SEEDS, MIRYOKEFALON).map((r) => r.stars)
    expect(stars(2).every((s) => s === 1)).toBe(true)
    expect(stars(PASS.neckZ + 2).every((s) => s === 3)).toBe(true)
    expect(stars(PASS.neckZ + 8).every((s) => s <= 2)).toBe(true)
  })

  it('kola yetişemeyen kesici başın önünde keser, kaçtığı yerde değil', { timeout: 20000 }, () => {
    // Eskiden z=−1 isteyen bot hamleden kaçıp çıkışta kesiyor, sonra boğazda ölüyordu.
    for (const r of sweep(blockerBot(-1, 4), SEEDS, MIRYOKEFALON)) {
      expect(r.result).toBe('victory')
      expect(r.blockadeZ!).toBeLessThan(PASS.neckZ - 2)
    }
  })

  it('simülasyon karesi 100 µs altında kalır', () => {
    const { battle, enemies } = column()
    dropBlockade(battle, PASS.neckZ + 3)
    const player = { x: 0, z: 14 }
    for (let i = 0; i < 300; i++) stepBattle(battle, enemies, player, DT)
    const frames = 3000
    const start = performance.now()
    for (let i = 0; i < frames; i++) stepBattle(battle, enemies, player, DT)
    expect(((performance.now() - start) / frames) * 1000).toBeLessThan(100)
  })
})
