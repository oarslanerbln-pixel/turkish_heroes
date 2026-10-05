// Simülasyonun bir adımı: oyunun ve botların ortak kuralı (MIMARI.md S1, S4).
//
// Oyunda yönetmen (GameDirector) her karede, botlar sabit adımla bunu çağırır;
// aynı dünya, girdi ve adım aynı sonuca varır. Sıra: oyuncu → düşmanlar →
// temas → hilal yönü → vuruş/enerji → savaşın akışı → sonuç. Kurallar yalnız
// dünyayı okur ve yazar; ses, titreşim, olay kaydı ve bir kezlik ipuçları
// `fx` üzerinden gelir: oyunda gerçek, botlarda sessiz.

import type { Sfx } from '../audio/sfx'
import { calcContactDamage, countAttackers } from '../mechanics/combat'
import { defeatCause } from '../mechanics/corps'
import { ENEMY_CONFIG } from '../mechanics/enemySim'
import {
  approachAngle,
  calcFacing,
  countInCrescent,
  executeStrike,
  HILAL_CONFIG,
  isRetreatingFrom,
  isStrikeReady,
  resolvePhase,
  stepEnergy,
} from '../mechanics/hilalSystem'
import { confineToPass } from '../mechanics/pass'
import type { Enemy, Vec2 } from '../mechanics/types'
import type { Refusal, TelemetryEvent } from '../telemetry/summary'
import { stepHurt } from './hurt'
import type { HintId } from './progress'
import { scenarioOf, SCORE_PER_KILL, type Scenario } from './scenarios'
import type { World } from './world'

export interface StepInput {
  /**
   * Hareket çubuğu, retreatSpeed'in kesri: uzunluk 1'e sınırlanır. Klavye
   * birim yön verir, joystick kısmi itişte kısmi hız.
   */
  move: Vec2
  /** Bu adımda vuruş istendi. */
  strike: boolean
}

/** Adımın dünyadan dışarı uzanan yan etkileri. */
export interface StepEffects {
  play(sfx: Sfx, intensity?: number): void
  haptic(pattern: number | number[]): void
  /** Vuruş anında ortam sesini kısar; pay: düşen / sahadaki. */
  duck(share: number): void
  track(e: TelemetryEvent): void
  /** Bir kezlik ipucu: true ise şimdi gösterilir (ve gösterilmiş sayılır). */
  hint(id: HintId): boolean
}

/** Botlar ve testler için: ses, titreşim ve kayıt yok; ipucu hiç gösterilmez. */
export const SILENT_FX: StepEffects = {
  play: () => undefined,
  haptic: () => undefined,
  duck: () => undefined,
  track: () => undefined,
  hint: () => false,
}

/** Ret mesajının ekranda kalma süresi (saniye). */
const REFUSAL_DURATION = 1.4

/** Vuruş anındaki donma süreleri (saniye, gerçek zaman; bkz. world.stepTime). */
const HITSTOP_SMALL = 0.04
const HITSTOP_BIG = 0.07

/**
 * Dünyayı `dt` saniye ilerletir. Yalnız savaş sürerken çağrılır; dt sıfır
 * olabilir (vuruş donması): o zaman hiçbir şey ilerlemez.
 * @param scenario Verilmezse komutanınki; botlar eski kuralları böyle dener.
 */
export function stepGame(
  w: World,
  input: StepInput,
  dt: number,
  fx: StepEffects,
  scenario: Scenario = scenarioOf(w),
): void {
  movePlayer(w, input.move, dt)
  // Düşmanlar bir önceki adımın kaçış durumuyla (isRetreating) yürür.
  scenario.moveEnemies(w, dt)

  const siege = scenario.siege(w)
  w.time += dt
  w.density = siege.density
  w.vulnerability = siege.vulnerability
  w.isRetreating = siege.centroid ? isRetreatingFrom(w.player, w.playerVel, siege.centroid) : false

  w.attackers = countAttackers(w.enemies, w.player)
  const damage =
    calcContactDamage(w.attackers, dt, scenario.contactDamage(w)) + scenario.hazards(w, dt, fx)
  w.playerHealth = Math.max(0, w.playerHealth - damage)
  stepHurt(w, damage, dt, fx)

  // Hedef yön ayrık ve sıçrayabilir; yay ona sınırlı hızla döner.
  // Histerezis hedef üzerinde çalışmalı, dönerken geçilen ara açılar üzerinde değil.
  w.facingTarget = calcFacing(w.enemies, w.player, w.facingTarget, siege.centroid)
  w.facing = approachAngle(w.facing, w.facingTarget, HILAL_CONFIG.facingTurnRate * dt)
  w.inCrescent = countInCrescent(w.enemies, w.player, w.facing, scenario.fallFilter(w))

  w.refusalTimer = Math.max(0, w.refusalTimer - dt)

  const wasReady = isStrikeReady(w.energy)
  if (w.strikeTimer > 0) {
    // Vuruştan sonraki donma: enerji dolmaz, istek dinlenmez.
    w.strikeTimer = Math.max(0, w.strikeTimer - dt)
  } else if (input.strike && !isStrikeReady(w.energy)) {
    refuse(w, 'notReady', fx)
    w.energy = stepEnergy(w.energy, siege.vulnerability, dt)
  } else if (input.strike && w.inCrescent === 0) {
    // Boş havaya kapanan kuşatma anlamsız; dolu enerjiyi harcatma. Yayda
    // asker var ama hiçbiri düşmeyecekse sebep başka: düzenleri sağlam.
    const anyInArc = countInCrescent(w.enemies, w.player, w.facing) > 0
    refuse(w, anyInArc ? 'steady' : 'noTargets', fx)
  } else if (input.strike) {
    // Vuruş, enerji ilerletilmeden ÖNCE değerlendirilir: oyuncu HUD'da
    // gördüğü enerjiye basıyor, bu adımda hesaplanacak olana değil.
    strike(w, siege.aliveCount, scenario, fx)
  } else {
    w.energy = stepEnergy(w.energy, siege.vulnerability, dt)
  }

  // Hilal kurulduğu an duyulsun: oyuncunun gözü düşmandayken de bilsin.
  if (!wasReady && isStrikeReady(w.energy)) fx.play('ready')

  // Dalga geçişi / gün saati olayları — vuruştan sonra, güncel sayıyla.
  scenario.advance(w, dt, fx)

  w.phase = resolvePhase({
    vulnerability: siege.vulnerability,
    isRetreating: w.isRetreating,
    strikeTimer: w.strikeTimer,
  })

  const prevOutcome = w.outcome
  w.outcome = scenario.outcome(w)
  // Zafer puanı (yıldızlar dahil) sonucun geldiği adımda: botlar oyunun puanını görür.
  if (prevOutcome === 'playing' && w.outcome === 'victory') w.score += scenario.victoryBonus(w)
}

/**
 * Oyuncuyu girdiyle yürütür. Hız, niyetten değil gerçekleşen yer
 * değiştirmeden türetilir: arena sınırına yaslanıp itmeye devam eden oyuncu
 * "kaçıyor" sayılmasın.
 */
function movePlayer(w: World, move: Vec2, dt: number): void {
  const prevX = w.player.x
  const prevZ = w.player.z
  const len = Math.hypot(move.x, move.z)
  if (len > 0) {
    const speed = (Math.min(len, 1) * HILAL_CONFIG.retreatSpeed) / len
    w.player.x += move.x * speed * dt
    w.player.z += move.z * speed * dt
  }
  confineToArena(w.player)
  // Geçitte duvarların arasında.
  if (w.battle?.layout.pass) confineToPass(w.player)
  // Donmada dt sıfır: hız bölmesi NaN üretmesin, oyuncu eski hızını korur.
  if (dt > 0) {
    w.playerVel.x = (w.player.x - prevX) / dt
    w.playerVel.z = (w.player.z - prevZ) / dt
  }
}

function confineToArena(p: Vec2): void {
  const dist = Math.hypot(p.x, p.z)
  if (dist <= ENEMY_CONFIG.arenaRadius || dist === 0) return
  const scale = ENEMY_CONFIG.arenaRadius / dist
  p.x *= scale
  p.z *= scale
}

function refuse(w: World, reason: Refusal, fx: StepEffects): void {
  fx.play('refuse')
  fx.track({ type: 'strike_refused', reason })
  w.refusal = reason
  w.refusalTimer = REFUSAL_DURATION
}

function strike(w: World, aliveBefore: number, scenario: Scenario, fx: StepEffects): void {
  const fallen: Enemy[] = []
  const kills = executeStrike(w.enemies, w.player, w.facing, fallen, scenario.fallFilter(w))
  w.events.push({
    type: 'strike',
    origin: { x: w.player.x, z: w.player.z },
    facing: w.facing,
    victims: fallen.map((e) => ({ id: e.id, x: e.pos.x, z: e.pos.z })),
  })
  scenario.afterStrike(w, fx)
  fx.track({ type: 'strike', kills, alive: aliveBefore })
  // Kalabalığın büyük kısmını düşüren vuruş daha ağır hissettirsin.
  const share = kills / Math.max(1, aliveBefore)
  fx.play('strike', share)
  fx.duck(share)
  fx.haptic(kills >= 5 ? [40, 30, 60] : 40)
  // Hitstop: kuşatmanın kapandığı an kısa bir süre asılı kalır. Oyun hissi
  // rehberinin 30–80 ms aralığı; büyük vuruş daha uzun.
  w.hitstop = kills >= 5 ? HITSTOP_BIG : HITSTOP_SMALL
  w.totalKills += kills
  w.score += kills * SCORE_PER_KILL
  w.strikeOrigin.x = w.player.x
  w.strikeOrigin.z = w.player.z
  w.strikeFacing = w.facing
  w.strikeTimer = HILAL_CONFIG.strikeDuration
  w.energy = 0
  w.refusal = 'none'
  w.refusalTimer = 0
}

/** Savaş sonu kaydı; oyunda finishBattle, botlarda koşucu aynı biçimde yazar. */
export function battleEnd(w: World): Extract<TelemetryEvent, { type: 'battle_end' }> {
  const victory = w.outcome === 'victory'
  return {
    type: 'battle_end',
    outcome: victory ? 'victory' : 'defeat',
    cause: victory ? null : defeatCause(w.battle, w.playerHealth),
    score: w.score,
    stars: w.stars,
    health: Math.round(w.playerHealth),
    wave: w.waveIndex,
    // Bozguna uğrayıp kaçmakta olan artık savaşmıyor.
    remaining: w.enemies.reduce((n, e) => n + (e.alive && !e.routed ? 1 : 0), 0),
    // Malazgirt'in saati gün çizgisininki: battle.time.
    simTime: w.battle?.time ?? w.time,
  }
}
