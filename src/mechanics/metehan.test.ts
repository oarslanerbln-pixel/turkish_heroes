// Metehan'ın dalgalı savaşı: adalet kuralları ve denge sözleri.
//
// İlk blok kuralları tek tek sabitler (bozgun, doğuş yeri, zorluk merdiveni).
// İkinci blok olasılıksal bot ölçütleridir: insan gibi kusurlu botlar
// (tepki gecikmesi, direksiyon hatası, kötü hamle; bkz. waveBots.ts) sabit
// tohumlarla koşturulur. Her ölçüt bir kuralın neden var olduğunu belgeler;
// kural gevşetilirse ya da bir sabit oynanırsa test kırılır.

import { describe, expect, it } from 'vitest'
import { countAttackers } from './combat'
import { createEnemies, ENEMY_CONFIG, stepEnemies } from './enemySim'
import { calcSiegeState, countInCrescent, executeStrike } from './hilalSystem'
import { kiter, runWaves, SKILLS, type WaveBot } from './waveBots'
import {
  DAMAGE_LADDER,
  LADDER_TOP,
  ladderScale,
  nextLadderStep,
  restHealth,
  routLimit,
  routSurvivors,
  SPAWN_CLEARANCE,
  spawnWave,
  WAVES,
  wavesStarHealth,
  wavesStars,
} from './waves'
import type { Enemy, Vec2 } from './types'

const DT = 1 / 60

function leaveAlive(enemies: Enemy[], n: number): void {
  enemies.forEach((e, i) => (e.alive = i < n))
}

describe('Metehan — kurallar', () => {
  it('bozgun eşiği dalganın %15\'i: 16 → 2, 26 → 3, 28 → 4; Baideng\'de gövdenin: 24 → 3', () => {
    expect(WAVES.map((_, i) => routLimit(i))).toEqual([2, 3, 4, 3])
  })

  it('vuruştan sonra artık eşiğin altındaysa bozguna uğrar, üstündeyse savaşır', () => {
    const many = spawnWave(0)
    leaveAlive(many, 3)
    expect(routSurvivors(many, 0)).toBe(0)
    expect(many.some((e) => e.routed)).toBe(false)

    const few = spawnWave(0)
    leaveAlive(few, 2)
    expect(routSurvivors(few, 0)).toBe(2)
    expect(few.filter((e) => e.alive).every((e) => e.routed)).toBe(true)
    // Bir kez bozguna uğrayan ikinci kez sayılmaz.
    expect(routSurvivors(few, 0)).toBe(0)
  })

  it('bozguna uğrayan ne hedef ne tehdit; sınıra kaçıp sahadan çıkar', () => {
    const enemies = createEnemies(2)
    const player: Vec2 = { x: 0, z: 0 }
    enemies[0].pos = { x: 0, z: 1 }
    enemies[1].pos = { x: 0, z: 6 }
    for (const e of enemies) e.routed = true

    expect(countAttackers(enemies, player)).toBe(0)
    expect(countInCrescent(enemies, player, 0)).toBe(0)
    expect(executeStrike(enemies, player, 0)).toBe(0)
    expect(calcSiegeState(enemies).aliveCount).toBe(0)

    // Oyuncu peşlerinden koşsa da yetişemez: kaçış hızı oyuncununkinden yüksek.
    for (let t = 0; t < 6; t += DT) {
      stepEnemies(enemies, player, DT, true)
      player.z += 6 * DT
    }
    expect(enemies.every((e) => !e.alive && e.fled)).toBe(true)
  })

  it('yeni dalga oyuncunun yakasında ama düzen mesafesinin dışında doğar', () => {
    for (const player of [
      { x: 0, z: 14 },
      { x: -14, z: 0 },
      { x: 10, z: -10 },
      { x: 0, z: 26 },
      { x: 3, z: -3 },
    ]) {
      for (let wave = 1; wave < WAVES.length; wave++) {
        const enemies = spawnWave(wave, player)
        const nearest = Math.min(
          ...enemies.map((e) => Math.hypot(e.pos.x - player.x, e.pos.z - player.z)),
        )
        expect(nearest).toBeGreaterThanOrEqual(SPAWN_CLEARANCE)
        expect(enemies.every((e) => Math.hypot(e.pos.x, e.pos.z) <= ENEMY_CONFIG.arenaRadius)).toBe(
          true,
        )
        // Ana gövdenin merkezi oyuncunun yarısında (merkezden bakınca aynı
        // yarım düzlem). Kıskaç müfrezesi ayrı ölçülür (aşağıda).
        const main = enemies.slice(0, enemies.length - (WAVES[wave].flank ?? 0))
        const cx = main.reduce((s, e) => s + e.pos.x, 0) / main.length
        const cz = main.reduce((s, e) => s + e.pos.z, 0) / main.length
        if (Math.hypot(player.x, player.z) > 10) expect(cx * player.x + cz * player.z).toBeGreaterThan(0)
      }
    }
    // Oyuncusuz (ilk dalga): eski diziliş, -z'de.
    const first = spawnWave(0)
    expect(first.every((e) => e.pos.z < 0)).toBe(true)
  })

  it('kıskaç: müfreze oyuncunun gittiği yönde, düzen mesafesinin dışında, gövdeden ayrı doğar', () => {
    const wave = WAVES.findIndex((w) => w.flank)
    const n = WAVES[wave].flank!
    for (const [player, heading] of [
      [{ x: 0, z: 14 }, { x: 6, z: 0 }],
      [{ x: -14, z: 0 }, { x: 0, z: -6 }],
      [{ x: 10, z: -10 }, { x: 4, z: 4 }],
      [{ x: 3, z: -3 }, { x: 0, z: 0 }],
    ] as [Vec2, Vec2][]) {
      const enemies = spawnWave(wave, player, heading)
      expect(enemies).toHaveLength(WAVES[wave].enemyCount)
      const flank = enemies.slice(-n)
      const main = enemies.slice(0, -n)
      for (const e of flank) {
        expect(Math.hypot(e.pos.x - player.x, e.pos.z - player.z)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE)
        expect(Math.hypot(e.pos.x, e.pos.z)).toBeLessThanOrEqual(ENEMY_CONFIG.arenaRadius)
        const apart = Math.min(...main.map((m) => Math.hypot(e.pos.x - m.pos.x, e.pos.z - m.pos.z)))
        expect(apart).toBeGreaterThanOrEqual(8)
      }
      // Koşan oyuncunun önünde: müfreze merkezi gidiş yönünün yarım düzleminde.
      if (Math.hypot(heading.x, heading.z) > 0) {
        const fx = flank.reduce((s, e) => s + e.pos.x, 0) / n - player.x
        const fz = flank.reduce((s, e) => s + e.pos.z, 0) / n - player.z
        expect(fx * heading.x + fz * heading.z).toBeGreaterThan(0)
      }
    }
  })

  it("mola yalnızca Baideng'den önce; can tam canı aşmaz", () => {
    const rest = WAVES.findIndex((w) => w.rest)
    expect(WAVES[rest].baideng).toBe(true)
    expect(WAVES.filter((w) => w.rest)).toHaveLength(1)
    expect(restHealth(20, rest)).toBe(20 + WAVES[rest].rest!)
    expect(restHealth(60, rest)).toBe(100)
    expect(restHealth(20, rest - 1)).toBe(20)
  })

  it('zorluk merdiveni: yarı hasardan başlar, zaferle çıkar, yenilgiyle iner, sınırlarda durur', () => {
    expect(DAMAGE_LADDER[0]).toBe(0.5)
    expect(DAMAGE_LADDER[LADDER_TOP]).toBe(1)
    expect(nextLadderStep(0, false)).toBe(0)
    expect(nextLadderStep(0, true)).toBe(1)
    expect(nextLadderStep(LADDER_TOP, true)).toBe(LADDER_TOP)
    expect(nextLadderStep(LADDER_TOP, false)).toBe(LADDER_TOP - 1)
    // Basamaklar tekdüze artar.
    for (let i = 1; i <= LADDER_TOP; i++) expect(ladderScale(i)).toBeGreaterThan(ladderScale(i - 1))
  })

  it('yıldız yarayı tam hasar karşılığıyla ölçer: merdiven basamağı yıldız vermez', () => {
    // Tam hasarda 60 yara (40 can) = yarı hasarda 30 yara (70 can): ikisi de 3 yıldız.
    expect(wavesStars(40, 1)).toBe(3)
    expect(wavesStars(70, 0.5)).toBe(3)
    expect(wavesStars(20, 1)).toBe(2)
    expect(wavesStars(60, 0.5)).toBe(2)
    // Yarı hasarda 40 can: tam hasarda ölürdü, zafer merdivenin.
    expect(wavesStars(40, 0.5)).toBe(1)
    // Tam hasarda kazanmak en az 2 yıldız.
    expect(wavesStars(1, 1)).toBe(2)
    // Karnenin hedefi (wavesStarHealth) eşiğe tam oturur: bir can eksiği yetmez.
    for (const scale of DAMAGE_LADDER) {
      for (const n of [2, 3] as const) {
        const need = wavesStarHealth(n, scale)
        expect(wavesStars(need, scale)).toBeGreaterThanOrEqual(n)
        expect(wavesStars(need - 1, scale)).toBeLessThan(n)
      }
    }
  })

  it('moladan dönen can yıldıza yazılmaz, molaya giren can tam hasar karşılığıyla ölçülür', () => {
    // Tam hasarda molaya 40 canla giren (60 yara) Baideng'i yarasız bitirse
    // 100'e döner (+70, tavan) ve 3 yıldız alır; aynı 60 yarayı yarı hasarda
    // 30 yarayla (70 can) taşıyan da.
    expect(wavesStars(100, 1, 40)).toBe(3)
    expect(wavesStars(100, 0.5, 70)).toBe(3)
    // Yarı hasarda molaya 40 canla giren tam hasarda ölmüştü: tavan dönen canı silmez.
    expect(wavesStars(100, 0.5, 40)).toBeLessThan(3)
    for (const scale of DAMAGE_LADDER) {
      for (const preRest of [10, 30, 50, 80]) {
        for (const n of [2, 3] as const) {
          const need = wavesStarHealth(n, scale, preRest)
          if (need < 2 || need > 100) continue
          expect(wavesStars(need, scale, preRest)).toBeGreaterThanOrEqual(n)
          expect(wavesStars(need - 1, scale, preRest)).toBeLessThan(n)
        }
      }
    }
  })
})

describe('Metehan — denge (olasılıksal bot ölçütleri)', () => {
  const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

  it('bozgun son düşman tuzağını kaldırır', { timeout: 30000 }, () => {
    // ≤2 düşmanla 20 sn'den uzun geçen koşu sayısı. Tuzak: disiplinsiz son
    // düşman oyuncudan hızlı, dibine yapışıyor ve yayın iç yarıçapında kalıyor.
    const stuck = (rout: boolean) =>
      seeds(40).filter((s) => {
        const base = kiter(SKILLS.skilled, s)
        let since = -1
        let worst = 0
        const bot: WaveBot = (v) => {
          const n = v.enemies.filter((e) => e.alive && !e.routed).length
          if (n > 0 && n <= 2) {
            if (since < 0) since = v.time
            worst = Math.max(worst, v.time - since)
          } else since = -1
          return base(v)
        }
        runWaves(bot, undefined, rout)
        return worst > 20
      }).length

    expect(stuck(false)).toBeGreaterThanOrEqual(8)
    expect(stuck(true)).toBe(0)
  })

  it('dalganın oyuncunun yakasında doğması şansı sonuçtan çıkarır', { timeout: 30000 }, () => {
    // Sabit doğuşta sonucu doğuş anında oyuncunun çemberin neresinde olduğu
    // belirliyordu; aynı uzman bot 30 koşunun yalnızca 10'unu kazanıyordu.
    const wins = (spawnAway: boolean) =>
      seeds(30).filter(
        (s) => runWaves(kiter(SKILLS.expert, s), undefined, true, spawnAway).result === 'victory',
      ).length
    expect(wins(false)).toBeLessThanOrEqual(15)
    expect(wins(true)).toBeGreaterThanOrEqual(27)
  })

  it('tam hasar kapıda duvardır: orta oyuncu neredeyse hiç kazanamaz', { timeout: 30000 }, () => {
    // Merdivenin var olma nedeni. Bu değişirse (ör. oyun kolaylaşırsa)
    // merdivenin basamakları yeniden ölçülmeli.
    const wins = seeds(30).filter(
      (s) => runWaves(kiter(SKILLS.average, s)).result === 'victory',
    ).length
    expect(wins).toBeLessThanOrEqual(2)
  })

  it('merdivenle her orta oyuncu ilk 8 denemede kazanır; uzman tam hasara yerleşir', { timeout: 60000 }, () => {
    const career = (skill: (typeof SKILLS)[keyof typeof SKILLS], player: number, attempts: number) => {
      let step = 0
      let firstWin = -1
      for (let a = 0; a < attempts; a++) {
        const r = runWaves(kiter(skill, player * 100 + a), undefined, true, true, ladderScale(step))
        if (r.result === 'victory' && firstWin < 0) firstWin = a + 1
        step = nextLadderStep(step, r.result === 'victory')
      }
      return { firstWin, step }
    }
    const average = seeds(12).map((p) => career(SKILLS.average, p, 8))
    expect(average.every((c) => c.firstWin > 0)).toBe(true)

    const expert = seeds(6).map((p) => career(SKILLS.expert, p, 6))
    expect(expert.every((c) => c.firstWin === 1 && c.step === LADDER_TOP)).toBe(true)
  })

  it('yıldızlar beceriyi ayırır: 3. yıldız uzmanın bile her seferinde alamadığı an', { timeout: 30000 }, () => {
    // Yarı hasarda (herkesin başladığı basamak) 30 oyuncu. Taramada: uzman
    // 30 zaferin 28'i 2+, 13'ü 3 yıldız; iyi 19 zaferde 3 yıldız yok; orta 7
    // zaferin 1'i şanslı bir koşuyla 3.
    const stars = (skill: (typeof SKILLS)[keyof typeof SKILLS]) =>
      seeds(30).map((s) => runWaves(kiter(skill, s), undefined, true, true, DAMAGE_LADDER[0]).stars)
    const count = (xs: number[], n: number) => xs.filter((x) => x >= n).length

    const expert = stars(SKILLS.expert)
    expect(count(expert, 2)).toBeGreaterThanOrEqual(27)
    expect(count(expert, 3)).toBeGreaterThanOrEqual(5)
    expect(count(expert, 3)).toBeLessThanOrEqual(18)
    expect(count(stars(SKILLS.skilled), 3)).toBeLessThanOrEqual(3)
    expect(count(stars(SKILLS.average), 3)).toBeLessThanOrEqual(1)
  })
})
