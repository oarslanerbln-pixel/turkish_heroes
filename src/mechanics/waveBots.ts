// Metehan'ın dalgalı savaşı için headless oyun döngüsü ve test botları.
//
// Döngü GameDirector'ın dalga kolunu birebir izler (oyuncu → sürü → yönetmen:
// temas, yön, vuruş/enerji, dalga geçişi, sonuç). Metehan'ın dalgalarında
// rastgelelik yok; dağılım oyuncudan gelir. Botlar bu yüzden insan gibi kusurlu:
// tohumlu gürültüyle direksiyon hatası ve vuruşta tepki gecikmesi var — aynı
// "beceri" tohumdan tohuma farklı sonuç verir, eşikler olasılıkla ölçülür.
// Oyun kodu bu dosyayı içe aktarmaz.

import { calcContactDamage, COMBAT_CONFIG, countAttackers } from './combat'
import { ENEMY_CONFIG, stepEnemies } from './enemySim'
import {
  approachAngle,
  calcFacing,
  calcSiegeState,
  countInCrescent,
  executeStrike,
  HILAL_CONFIG,
  isRetreatingFrom,
  isStrikeReady,
  stepEnergy,
} from './hilalSystem'
import { mulberry32 } from './random'
import type { Enemy, Vec2 } from './types'
import {
  afterBaidengStrike,
  BAIDENG,
  createBaidengState,
  siegeCorps,
  stepCommand,
  stepPeace,
  stepVolleys,
  type BaidengEvent,
  type BaidengState,
  type Volley,
} from './baideng'
import {
  restHealth,
  routSurvivors,
  spawnWave,
  TOTAL_WAVES,
  waveBreak as breakBefore,
  waveConfig,
  wavesStars,
} from './waves'
import type { TelemetryEvent } from '../telemetry/summary'

export const WAVE_BOT_DT = 1 / 60
/** Oyuncunun başlangıcı (world.ts ile aynı). */
const PLAYER_START: Vec2 = { x: 0, z: 8 }
/** Hiçbir bot bundan uzun oynamaz (sonsuz döngü sigortası). */
const MAX_TIME = 600

export interface WaveView {
  enemies: readonly Enemy[]
  player: Vec2
  energy: number
  inCrescent: number
  health: number
  waveIndex: number
  time: number
  /** Baideng: düşmesi beklenen ok yağmurları (yerdeki halkalar). */
  volleys: readonly Volley[]
  /** Baideng: dört renkli çemberin merkezi; çember kurulmadıysa null. */
  focus: Vec2 | null
}

export interface WaveAction {
  move: Vec2
  strike: boolean
}

export type WaveBot = (view: WaveView) => WaveAction

export interface WaveRun {
  result: 'victory' | 'defeat'
  health: number
  kills: number
  time: number
  /** Ulaşılan dalga (0 tabanlı). */
  wave: number
  /** Yenilgide sahada kalan düşman. */
  remaining: number
  strikes: number[]
  /** Zaferde wavesStars (merdiven basamağı damageScale), yenilgide 0. */
  stars: number
}

/**
 * @param record Oyundaki olay takibiyle aynı olaylar (savaş karnesi testleri
 *   bot koşusunu oyuncunun özetine böyle çevirir). t: oyun süresi (sn).
 * @param rout false: bozgun kuralı olmadan (önce/sonra karşılaştırması için).
 * @param spawnAway false: dalgalar eskisi gibi hep aynı yerde doğar.
 * @param startWave Bu dalgadan, tam canla başlar (tek dalgayı ölçmek için).
 */
export function runWaves(
  bot: WaveBot,
  record?: (e: TelemetryEvent, t: number) => void,
  rout = true,
  spawnAway = true,
  damageScale = 1,
  startWave = 0,
): WaveRun {
  let enemies = spawnWave(startWave)
  const player = { ...PLAYER_START }
  const vel = { x: 0, z: 0 }
  let health: number = COMBAT_CONFIG.playerMaxHealth
  /** Molaya girerkenki can (yıldızlar için); mola yoksa undefined. */
  let preRest: number | undefined
  let energy = 0
  let facing = Math.PI
  let facingTarget = Math.PI
  let retreating = false
  let waveIndex = startWave
  let waveBreak = 0
  let strikeTimer = 0
  let kills = 0
  let time = 0
  const strikes: number[] = []
  const first = waveConfig(startWave)
  let baideng: BaidengState | null = first.baideng ? createBaidengState(first.enemyCount) : null
  const baidengEvents: BaidengEvent[] = []
  const view: WaveView = {
    enemies,
    player,
    energy,
    inCrescent: 0,
    health,
    waveIndex,
    time,
    volleys: [],
    focus: null,
  }
  const alive = () => enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0)
  /** Yenilgide "kalan": savaşmaya devam eden (bozguna uğrayan sayılmaz). */
  const fighting = () => enemies.reduce((n, e) => n + (e.alive && !e.routed ? 1 : 0), 0)

  record?.({ type: 'battle_start', commander: 'metehan', attempt: 1, assist: damageScale, seed: null }, 0)

  let result: 'victory' | 'defeat' | null = null
  while (result === null && time < MAX_TIME) {
    const dt = WAVE_BOT_DT
    time += dt
    view.enemies = enemies
    view.energy = energy
    view.health = health
    view.waveIndex = waveIndex
    view.time = time
    view.volleys = baideng?.volleys ?? []
    view.focus = baideng?.ring?.center ?? null
    const action = bot(view)

    // Oyuncu (öncelik 0): hız retreatSpeed'e sınırlı, arena içinde.
    const px = player.x
    const pz = player.z
    const len = Math.hypot(action.move.x, action.move.z)
    if (len > 0) {
      const speed = Math.min(len, HILAL_CONFIG.retreatSpeed)
      player.x += (action.move.x / len) * speed * dt
      player.z += (action.move.z / len) * speed * dt
      const r = Math.hypot(player.x, player.z)
      if (r > ENEMY_CONFIG.arenaRadius) {
        player.x *= ENEMY_CONFIG.arenaRadius / r
        player.z *= ENEMY_CONFIG.arenaRadius / r
      }
    }
    vel.x = (player.x - px) / dt
    vel.z = (player.z - pz) / dt

    // Sürü (öncelik 1): yönetmenin bir önceki karede bulduğu kaçış durumuyla.
    stepEnemies(enemies, player, dt, retreating, waveConfig(waveIndex).disciplineRecoveryMult)
    if (baideng) stepCommand(baideng, enemies, player, dt)

    // Yönetmen (öncelik 2).
    const siege = calcSiegeState(enemies, baideng ? siegeCorps(baideng) : undefined)
    retreating = siege.centroid ? isRetreatingFrom(player, vel, siege.centroid) : false
    const perEnemy = COMBAT_CONFIG.damagePerEnemy * damageScale
    const volleyDamage = baideng ? stepVolleys(baideng, enemies, player, vel, dt, baidengEvents) : 0
    const contact = calcContactDamage(countAttackers(enemies, player), dt, perEnemy)
    health = Math.max(0, health - contact - volleyDamage * damageScale)
    facingTarget = calcFacing(enemies, player, facingTarget, siege.centroid)
    facing = approachAngle(facing, facingTarget, HILAL_CONFIG.facingTurnRate * dt)
    view.inCrescent = countInCrescent(enemies, player, facing)

    if (strikeTimer > 0) {
      strikeTimer = Math.max(0, strikeTimer - dt)
    } else if (action.strike && !isStrikeReady(energy)) {
      record?.({ type: 'strike_refused', reason: 'notReady' }, time)
      energy = stepEnergy(energy, siege.vulnerability, dt)
    } else if (action.strike && view.inCrescent === 0) {
      record?.({ type: 'strike_refused', reason: 'noTargets' }, time)
    } else if (action.strike) {
      const n = executeStrike(enemies, player, facing)
      record?.({ type: 'strike', kills: n, alive: siege.aliveCount }, time)
      strikes.push(n)
      kills += n
      energy = 0
      strikeTimer = HILAL_CONFIG.strikeDuration
      if (baideng) afterBaidengStrike(baideng, enemies, baidengEvents)
      else {
        const routed = rout ? routSurvivors(enemies, waveIndex) : 0
        if (routed > 0) record?.({ type: 'rout', count: routed }, time)
      }
    } else {
      energy = stepEnergy(energy, siege.vulnerability, dt)
    }
    if (baideng) stepPeace(baideng, enemies, baidengEvents)
    for (const e of baidengEvents) {
      if (e.type === 'encircle') record?.({ type: 'rout', count: e.routed }, time)
      if (e.type === 'volleyLanded') record?.({ type: 'volley', hit: e.hit, felled: e.felled.length }, time)
    }
    baidengEvents.length = 0

    // Dalga geçişi (scenarios.ts'teki waves.advance ile aynı).
    const moreWaves = waveIndex < TOTAL_WAVES - 1
    if (alive() === 0 && moreWaves) {
      if (waveBreak === 0) {
        waveBreak = breakBefore(waveIndex + 1)
        record?.({ type: 'wave_clear', wave: waveIndex, health: Math.round(health) }, time)
        if (waveConfig(waveIndex + 1).rest) {
          preRest = health
          health = restHealth(health, waveIndex + 1)
        }
      } else {
        waveBreak = Math.max(0, waveBreak - dt)
        if (waveBreak === 0) {
          waveIndex++
          const cfg = waveConfig(waveIndex)
          baideng = cfg.baideng ? createBaidengState(cfg.enemyCount) : null
          enemies = spawnWave(waveIndex, spawnAway ? player : undefined, vel)
        }
      }
    }

    const remaining = alive() + (moreWaves ? 1 : 0)
    if (health <= 0) result = 'defeat'
    else if (remaining === 0) result = 'victory'
  }

  const final = result ?? 'defeat'
  const remaining = fighting()
  const stars = final === 'victory' ? wavesStars(health, damageScale, preRest) : 0
  record?.(
    {
      type: 'battle_end',
      outcome: final,
      cause: final === 'defeat' ? 'health' : null,
      score: 0,
      stars,
      health: Math.round(health),
      wave: waveIndex,
      remaining,
      simTime: time,
    },
    time,
  )
  return { result: final, health, kills, time, wave: waveIndex, remaining, strikes, stars }
}

// ——— Botlar ———

export interface KiterSkill {
  /** Çizilen çemberin yarıçapı. */
  radius: number
  /** Enerji dolduktan sonra vuruşa basma gecikmesi (sn), ortalama. */
  reaction: number
  /** Yayda en az bu kadar düşman varsa vurur (beklemeye sabrı biterse 1). */
  minStrike: number
  /** Hazır enerjiyle en fazla bu kadar bekler, sonra kim varsa vurur (sn). */
  patience: number
  /** Direksiyon hatası: yön sapmasının standart sapması (radyan). */
  wobble: number
  /** Kötü hamle olasılığı: saniyede bu oranla 0,4 sn kümenin üstüne yürür. */
  blunder: number
  /** Enerji dolmadan basma alışkanlığı: saniyede bu oranla boşa basar. */
  mash: number
}

export const SKILLS = {
  /** Kusursuza yakın: geniş çember, anında tepki, hata yok. */
  expert: { radius: 14, reaction: 0.1, minStrike: 8, patience: 2, wobble: 0.05, blunder: 0, mash: 0 },
  /** İyi oyuncu: arada gecikir, direksiyonu biraz dalgalı. */
  skilled: { radius: 14, reaction: 0.3, minStrike: 6, patience: 2.5, wobble: 0.15, blunder: 0.03, mash: 0.05 },
  /** Orta: taktiği anlamış ama geç basıyor, arada yanlış yöne kaçıyor. */
  average: { radius: 13, reaction: 0.5, minStrike: 4, patience: 3, wobble: 0.3, blunder: 0.08, mash: 0.2 },
  /** Acemi: dar çember, enerji dolmadan basıyor, sık hata. */
  novice: { radius: 11, reaction: 0.8, minStrike: 2, patience: 3, wobble: 0.45, blunder: 0.15, mash: 0.6 },
} as const satisfies Record<string, KiterSkill>

/** Tohumlu normal dağılım (Box–Muller). */
function gaussian(rand: () => number): number {
  const u = Math.max(1e-9, rand())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

/**
 * Atlı okçu: arena merkezi çevresinde çember çizerek sürüyü peşinde sürükler,
 * hilal dolunca yay yeterince doluysa vurur. Kusurları `skill` ve tohumdan.
 */
export function kiter(skill: KiterSkill, seed: number): WaveBot {
  const rand = mulberry32(seed)
  // Her oyuncunun kendi yönü: kimi saat yönünde döner, kimi tersine.
  const spin = rand() < 0.5 ? 1 : -1
  let readySince = -1
  let delay = 0
  let blunderUntil = -1
  let wobble = 0
  /** Her ok yağmurunu fark etme gecikmesi (sn). */
  const noticeDelay = new WeakMap<Volley, number>()
  return (v) => {
    const dt = WAVE_BOT_DT

    // Yön: teğet + yarıçapa dönüş, üstüne yavaş değişen direksiyon hatası.
    // Baideng çemberi kurulunca çember merkezinin çevresinde, yay menzilinde.
    const cx = v.focus?.x ?? 0
    const cz = v.focus?.z ?? 0
    const radius = v.focus ? FOCUS_RADIUS : skill.radius
    const r = Math.hypot(v.player.x - cx, v.player.z - cz) || 1
    const ux = (v.player.x - cx) / r
    const uz = (v.player.z - cz) / r
    const radial = Math.max(-1, Math.min(1, (radius - r) / 3))
    let mx = -uz * spin + ux * radial
    let mz = ux * spin + uz * radial
    wobble += (gaussian(rand) * skill.wobble - wobble) * Math.min(1, 2 * dt)
    const cos = Math.cos(wobble)
    const sin = Math.sin(wobble)
    ;[mx, mz] = [mx * cos - mz * sin, mx * sin + mz * cos]

    // Kötü hamle: kümenin üstüne yürümek (kaçmayı unutmak).
    if (blunderUntil < v.time && rand() < skill.blunder * dt) blunderUntil = v.time + 0.4
    if (v.time < blunderUntil) {
      const c = centroid(v.enemies)
      if (c) {
        mx = c.x - v.player.x
        mz = c.z - v.player.z
      }
    }
    // Ok yağmuru: halkayı tepki gecikmesiyle fark eder. İçindeyse dışarı
    // kaçar; kenarındaysa halkaya giren bileşeni atıp kenar boyunca dolanır
    // (yalnız dışarı itilse çember onu yine içeri çeker, sınırda titrerdi).
    for (const vol of v.volleys) {
      let delay = noticeDelay.get(vol)
      if (delay === undefined) {
        delay = skill.reaction * (0.5 + rand())
        noticeDelay.set(vol, delay)
      }
      if (BAIDENG.volleyTelegraph - vol.left < delay) continue
      const dx = v.player.x - vol.x
      const dz = v.player.z - vol.z
      const d = Math.hypot(dx, dz)
      if (d > BAIDENG.volleyRadius + DODGE_MARGIN) continue
      if (d < 0.01) {
        ;[mx, mz] = [-mz, mx]
        continue
      }
      const ox = dx / d
      const oz = dz / d
      if (d < BAIDENG.volleyRadius + DODGE_MARGIN / 2) {
        ;[mx, mz] = [ox, oz]
        continue
      }
      const inward = -(mx * ox + mz * oz)
      if (inward > 0) {
        mx += ox * inward
        mz += oz * inward
      }
    }

    const ml = Math.hypot(mx, mz) || 1
    const move = { x: (mx / ml) * HILAL_CONFIG.retreatSpeed, z: (mz / ml) * HILAL_CONFIG.retreatSpeed }

    // Vuruş: dolunca tepki gecikmesi, sonra yay yeterince doluysa ya da sabır bitince.
    let strike = false
    if (isStrikeReady(v.energy)) {
      if (readySince < 0) {
        readySince = v.time
        delay = skill.reaction * (0.5 + rand())
      }
      const waited = v.time - readySince
      if (waited >= delay) {
        strike = v.inCrescent >= skill.minStrike || (waited >= skill.patience && v.inCrescent > 0)
      }
    } else {
      readySince = -1
      strike = rand() < skill.mash * dt
    }
    return { move, strike }
  }
}

/** Çember kurulunca botun çember merkezine uzaklığı: yayın menzilinde. */
const FOCUS_RADIUS = 9
/** Halkanın bu kadar dışına kadar kaç. */
const DODGE_MARGIN = 0.8

function centroid(enemies: readonly Enemy[]): Vec2 | null {
  let x = 0
  let z = 0
  let n = 0
  for (const e of enemies) {
    if (!e.alive) continue
    x += e.pos.x
    z += e.pos.z
    n++
  }
  return n > 0 ? { x: x / n, z: z / n } : null
}

/** Aynı beceriyle `n` farklı oyuncu (tohum 1..n). */
export function sweepWaves(skill: KiterSkill, seeds: readonly number[]): WaveRun[] {
  return seeds.map((s) => runWaves(kiter(skill, s)))
}
