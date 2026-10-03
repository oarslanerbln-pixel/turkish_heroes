import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
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
import { calcContactDamage, countAttackers } from '../mechanics/combat'
import type { Enemy } from '../mechanics/types'
import { useGameStore } from '../store/gameStore'
import { enterMode, isPlaying, simDelta, stepAnnouncements, stepTime, world } from '../sim/world'
import {
  earnedLore,
  isUnlocked,
  recordBattleEnd,
  recordLadder,
  recordLore,
  recordStars,
  recordVictory,
} from '../sim/progress'
import { pickLore } from '../lore/lore'
import { scenarioOf, SCORE_PER_KILL, type Scenario } from '../sim/scenarios'
import { saveBestScore } from '../sim/score'
import { haptic, play } from '../audio/sfx'
import { duck, setBattleMusic } from '../audio/ambience'
import { COMMANDERS } from '../mechanics/scenario'
import { debrief } from '../debrief/debrief'
import type { Refusal, TelemetryEvent } from '../telemetry/summary'
import { advanceClock, battleActive, nextAttempt, projectEnd, track } from '../telemetry/track'

// Simülasyon sırası: oyuncu (0) → düşmanlar (1) → yönetmen (2).
// Yönetmen en son çalışır; oyuncu ve düşmanlar o kareyi çoktan işlemiştir.
const DIRECTOR_PRIORITY = 2

/** HUD'u 60Hz yerine ~12Hz güncelle — enerji çubuğu CSS ile yumuşatılıyor. */
const HUD_SYNC_INTERVAL = 0.08

/** Ret mesajının ekranda kalma süresi (saniye). */
const REFUSAL_DURATION = 1.4

/** Vuruş anındaki donma süreleri (saniye). */
const HITSTOP_SMALL = 0.04
const HITSTOP_BIG = 0.07

function refuse(reason: Refusal): void {
  play('refuse')
  track({ type: 'strike_refused', reason })
  world.refusal = reason
  world.refusalTimer = REFUSAL_DURATION
}

/**
 * Savaş bitti: puan, ilerleme (kilit, Metehan merdiveni), rekor, karne ve
 * olay kaydı. Karne kayıttan önce hesaplanır: gösterilen tavsiye de
 * battle_end'in içinde kayda geçsin ("tavsiye işe yarıyor mu" sorusu için).
 */
function finishBattle(scenario: Scenario): void {
  const victory = world.outcome === 'victory'
  const locked = COMMANDERS.filter((c) => !isUnlocked(c.id)).map((c) => c.id)
  if (victory) {
    // victoryBonus yıldızları da yazar (world.stars); kayıt ondan sonra.
    world.score += scenario.victoryBonus(world)
    recordVictory(world.commander)
    recordStars(world.commander, world.stars)
  }
  if (world.battle) recordBattleEnd(world.commander)
  else recordLadder(victory)
  world.unlocked = locked.find((id) => isUnlocked(id)) ?? null
  world.bestScore = saveBestScore(world.commander, world.score)

  const end: Extract<TelemetryEvent, { type: 'battle_end' }> = {
    type: 'battle_end',
    outcome: victory ? 'victory' : 'defeat',
    cause: victory ? null : world.battle?.reachedCamp ? 'camp' : 'health',
    score: world.score,
    stars: world.stars,
    health: Math.round(world.playerHealth),
    wave: world.waveIndex,
    // Bozguna uğrayıp kaçmakta olan artık savaşmıyor.
    remaining: world.enemies.reduce((n, e) => n + (e.alive && !e.routed ? 1 : 0), 0),
    // Malazgirt'in saati gün çizgisininki: battle.time.
    simTime: world.battle?.time ?? world.time,
  }
  const summary = projectEnd(end)
  world.debrief = summary ? debrief(summary, { best: world.bestScore }) : null
  // Kart hemen kaydedilir: oyuncu sonuç ekranını beklemeden kapatsa da kazanılmış sayılır.
  world.lore = summary ? pickLore(summary, earnedLore()) : null
  if (world.lore) recordLore(world.lore.id)
  track({ ...end, advice: world.debrief?.advice.id })

  play(victory ? 'victory' : 'defeat')
  if (!victory) haptic(200)
}

export function GameDirector() {
  const hudTimer = useRef(0)
  const syncHud = useGameStore((s) => s.syncHud)

  useFrame((_, delta) => {
    const dt = simDelta(delta)
    const realDelta = Math.min(delta, 0.1)
    world.animTime += dt
    const scenario = scenarioOf(world)
    const siege = scenario.siege(world)

    if (isPlaying()) {
      if (!battleActive()) {
        track({
          type: 'battle_start',
          commander: world.commander,
          attempt: nextAttempt(world.commander),
          assist: scenario.assist(world),
          seed: world.seed,
        })
      }
      world.time += dt
      world.density = siege.density
      world.vulnerability = siege.vulnerability
      world.isRetreating = siege.centroid
        ? isRetreatingFrom(world.player, world.playerVel, siege.centroid)
        : false

      world.attackers = countAttackers(world.enemies, world.player)
      world.playerHealth = Math.max(
        0,
        world.playerHealth - calcContactDamage(world.attackers, dt, scenario.contactDamage(world)),
      )

      // Hedef yön ayrık ve sıçrayabilir; yay ona sınırlı hızla döner.
      // Histerezis hedef üzerinde çalışmalı, dönerken geçilen ara açılar üzerinde değil.
      world.facingTarget = calcFacing(
        world.enemies,
        world.player,
        world.facingTarget,
        siege.centroid,
      )
      world.facing = approachAngle(
        world.facing,
        world.facingTarget,
        HILAL_CONFIG.facingTurnRate * dt,
      )
      world.inCrescent = countInCrescent(
        world.enemies,
        world.player,
        world.facing,
        scenario.fallFilter(world),
      )

      world.refusalTimer = Math.max(0, world.refusalTimer - dt)

      const wasReady = isStrikeReady(world.energy)
      if (world.strikeTimer > 0) {
        world.strikeTimer = Math.max(0, world.strikeTimer - dt)
      } else if (world.strikeRequested && !isStrikeReady(world.energy)) {
        refuse('notReady')
        world.energy = stepEnergy(world.energy, siege.vulnerability, dt)
      } else if (world.strikeRequested && world.inCrescent === 0) {
        // Boş havaya kapanan kuşatma anlamsız; dolu enerjiyi harcatma. Yayda
        // asker var ama hiçbiri düşmeyecekse sebep başka: düzenleri sağlam.
        const anyInArc = countInCrescent(world.enemies, world.player, world.facing) > 0
        refuse(anyInArc ? 'steady' : 'noTargets')
      } else if (world.strikeRequested) {
        // Vuruş, enerji ilerletilmeden ÖNCE değerlendirilir: oyuncu HUD'da
        // gördüğü enerjiye basıyor, bu karede hesaplanacak olana değil.
        const aliveBefore = siege.aliveCount
        const fallen: Enemy[] = []
        const kills = executeStrike(
          world.enemies,
          world.player,
          world.facing,
          fallen,
          scenario.fallFilter(world),
        )
        world.events.push({
          type: 'strike',
          origin: { x: world.player.x, z: world.player.z },
          facing: world.facing,
          victims: fallen.map((e) => ({ id: e.id, x: e.pos.x, z: e.pos.z })),
        })
        scenario.afterStrike(world)
        track({ type: 'strike', kills, alive: aliveBefore })
        // Kalabalığın büyük kısmını düşüren vuruş daha ağır hissettirsin.
        const share = kills / Math.max(1, aliveBefore)
        play('strike', share)
        duck(share)
        haptic(kills >= 5 ? [40, 30, 60] : 40)
        // Hitstop: kuşatmanın kapandığı an kısa bir süre asılı kalır. Oyun hissi
        // rehberinin 30–80 ms aralığı; büyük vuruş daha uzun.
        world.hitstop = kills >= 5 ? HITSTOP_BIG : HITSTOP_SMALL
        world.totalKills += kills
        world.score += kills * SCORE_PER_KILL
        world.strikeOrigin.x = world.player.x
        world.strikeOrigin.z = world.player.z
        world.strikeFacing = world.facing
        world.strikeTimer = HILAL_CONFIG.strikeDuration
        world.energy = 0
        world.refusal = 'none'
        world.refusalTimer = 0
      } else {
        world.energy = stepEnergy(world.energy, siege.vulnerability, dt)
      }

      // Hilal kurulduğu an duyulsun: oyuncunun gözü düşmandayken de bilsin.
      if (!wasReady && isStrikeReady(world.energy)) play('ready')

      // Dalga geçişi / gün saati olayları — vuruştan sonra, güncel sayıyla.
      scenario.advance(world, dt)

      world.phase = resolvePhase({
        vulnerability: siege.vulnerability,
        isRetreating: world.isRetreating,
        strikeTimer: world.strikeTimer,
      })

      const prevOutcome = world.outcome
      world.outcome = scenario.outcome(world)
      if (world.outcome !== 'playing' && prevOutcome === 'playing') {
        enterMode('outcome')
        finishBattle(scenario)
        // Sonuç bu karede eşitlensin: kare döngüsü sonuçta durur, karne beklemesin.
        hudTimer.current = HUD_SYNC_INTERVAL
      }
    }

    // Müzik savaşla başlar, sonuçta susar; kös hilal enerjisiyle hızlanır.
    setBattleMusic(isPlaying(), world.energy / HILAL_CONFIG.strikeThreshold)

    // İstek her karede tüketilir: vuruş hazır değilken basılan tuş birikip
    // enerji dolar dolmaz kendiliğinden patlamasın.
    world.strikeRequested = false

    // Yönetmen en son çalışan simülasyon adımı: donma ve hız bir sonraki
    // karede oyuncu ve düşmanlar için de geçerli olur.
    if (world.mode !== 'paused') stepTime(realDelta)
    // Duyurular da gerçek zamanla: yavaşlayan dünyada uzamasınlar.
    if (isPlaying()) {
      stepAnnouncements(realDelta)
      advanceClock(realDelta)
    }

    // Gerçek zamanla: ağır çekimde HUD ~4 Hz'e düşüyor, donmada hiç güncellenmiyordu.
    hudTimer.current += realDelta
    if (hudTimer.current >= HUD_SYNC_INTERVAL) {
      hudTimer.current = 0
      const b = world.battle
      syncHud({
        phase: world.phase,
        outcome: world.outcome,
        hilalEnergy: world.energy,
        playerHealth: world.playerHealth,
        attackers: world.attackers,
        enemyClusterDensity: siege.density,
        enemyDiscipline: siege.discipline,
        vulnerability: siege.vulnerability,
        enemiesAlive: siege.aliveCount,
        inCrescent: world.inCrescent,
        refusal: world.refusalTimer > 0 ? world.refusal : 'none',
        strikeReady: isStrikeReady(world.energy),
        totalKills: world.totalKills,
        waveIndex: world.waveIndex,
        score: world.score,
        bestScore: world.bestScore,
        announcement: world.announceTimer > 0 ? world.announcement : '',
        stars: world.stars,
        battleTime: b?.time ?? 0,
        campDistance: b ? Math.max(0, b.layout.objectiveZ - b.frontZ) : 0,
        corpsCohesion: b ? b.corps.map((c) => (c.alive > 0 ? c.cohesion : -1)) : [],
        wingOrders: b ? b.wings.map((w) => w.order) : [],
        wingStrength: b ? b.wings.map((w) => w.strength) : [],
        defeatCause: b?.reachedCamp ? 'camp' : 'health',
        emperorCaptured: b?.emperorCaptured ?? false,
        debrief: world.debrief,
        unlocked: world.unlocked,
        lore: world.lore,
        canBlock: !!b?.layout.pass && !b.blockadeUsed,
        blockade: b?.blockade?.strength ?? 0,
      })
    }
  }, DIRECTOR_PRIORITY)

  return null
}
