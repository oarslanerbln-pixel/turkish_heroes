import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  approachAngle,
  calcFacing,
  countInCrescent,
  executeStrike,
  HILAL_CONFIG,
  isStrikeReady,
  resolvePhase,
  stepEnergy,
} from '../mechanics/hilalSystem'
import { calcContactDamage, countAttackers } from '../mechanics/combat'
import { BATTLE_CONFIG } from '../mechanics/corps'
import type { Vec2 } from '../mechanics/types'
import { useGameStore } from '../store/gameStore'
import { isPlaying, simDelta, stepAnnouncements, world } from '../sim/world'
import { recordBattleEnd, recordVictory } from '../sim/progress'
import { scenarioOf, SCORE_PER_KILL } from '../sim/scenarios'
import { saveBestScore } from '../sim/score'
import { haptic, play } from '../audio/sfx'
import { duck, setBattleMusic } from '../audio/ambience'
import type { Refusal } from '../telemetry/summary'
import { advanceClock, battleActive, nextAttempt, track } from '../telemetry/track'

// Simülasyon sırası: oyuncu (0) → düşmanlar (1) → yönetmen (2).
// Yönetmen en son çalışır; oyuncu ve düşmanlar o kareyi çoktan işlemiştir.
const DIRECTOR_PRIORITY = 2

/** HUD'u 60Hz yerine ~12Hz güncelle — enerji çubuğu CSS ile yumuşatılıyor. */
const HUD_SYNC_INTERVAL = 0.08

/** Bu hızın altında hareket eden oyuncu kaçmıyor, hattını tutuyordur. */
const MIN_EVASION_SPEED = 1

/** Bu hızdan daha sert bir yaklaşma "hücum"dur; düşmanın düzenini bozmaz. */
const APPROACH_TOLERANCE = 1.5

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

export function GameDirector() {
  const hudTimer = useRef(0)
  const syncHud = useGameStore((s) => s.syncHud)

  useFrame((_, delta) => {
    const dt = simDelta(delta)
    const scenario = scenarioOf(world)
    const siege = scenario.siege(world)

    if (isPlaying()) {
      if (!battleActive()) {
        track({ type: 'battle_start', commander: world.commander, attempt: nextAttempt(world.commander) })
      }
      world.density = siege.density
      world.vulnerability = siege.vulnerability
      world.isRetreating = siege.centroid ? detectRetreat(siege.centroid) : false

      world.attackers = countAttackers(world.enemies, world.player)
      world.playerHealth = Math.max(
        0,
        world.playerHealth - calcContactDamage(world.attackers, dt, scenario.contactDamage()),
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
        world.fxKills.length = 0
        const kills = executeStrike(
          world.enemies,
          world.player,
          world.facing,
          world.fxKills,
          scenario.fallFilter(world),
        )
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
        if (world.outcome === 'victory') {
          world.score += scenario.victoryBonus(world)
          recordVictory(world.commander)
        }
        if (world.battle) recordBattleEnd()
        world.bestScore = saveBestScore(world.commander, world.score)
        track({
          type: 'battle_end',
          outcome: world.outcome,
          cause: world.outcome === 'defeat' ? (world.battle?.reachedCamp ? 'camp' : 'health') : null,
          score: world.score,
          stars: world.stars,
          health: Math.round(world.playerHealth),
          wave: world.waveIndex,
        })
        play(world.outcome)
        if (world.outcome === 'defeat') haptic(200)
      }
    }

    // Müzik savaşla başlar, sonuçta susar; kös hilal enerjisiyle hızlanır.
    setBattleMusic(isPlaying(), world.energy / HILAL_CONFIG.strikeThreshold)

    // İstek her karede tüketilir: vuruş hazır değilken basılan tuş birikip
    // enerji dolar dolmaz kendiliğinden patlamasın.
    world.strikeRequested = false

    // Hitstop gerçek zamanla erir (dt donmuşken sıfır olduğu için ona bakılmaz).
    // Yönetmen en son çalışan simülasyon adımı: donma bir sonraki karede
    // oyuncu ve düşmanlar için de geçerli olur.
    const realDelta = Math.min(delta, 0.1)
    if (world.hitstop > 0) world.hitstop = Math.max(0, world.hitstop - realDelta)
    // Ağır çekim ve duyurular da gerçek zamanla: yavaşlayan dünyada uzamasınlar.
    else if (world.slowmo > 0) world.slowmo = Math.max(0, world.slowmo - realDelta)
    if (isPlaying()) {
      stepAnnouncements(realDelta)
      advanceClock(realDelta)
    }

    hudTimer.current += dt
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
        campDistance: b ? Math.max(0, BATTLE_CONFIG.campZ - b.frontZ) : 0,
        corpsCohesion: b ? b.corps.map((c) => (c.alive > 0 ? c.cohesion : -1)) : [],
        defeatCause: b?.reachedCamp ? 'camp' : 'health',
        emperorCaptured: b?.emperorCaptured ?? false,
      })
    }
  }, DIRECTOR_PRIORITY)

  return null
}

/**
 * Oyuncu düşmanı peşinden sürüklüyor mu?
 *
 * Yalnızca "merkezden uzaklaşma" aransaydı çember çizerek kaçmak (atlı okçunun
 * asıl taktiği) sayılmazdı; teğetsel harekette uzaklaşma bileşeni sıfırdır.
 * Kural bu yüzden iki koşula dayanır: oyuncu gerçekten hareket ediyor ve
 * kümenin üstüne yürümüyor. Durmak hat tutmaktır, hücum etmek de kaçmak değildir.
 */
function detectRetreat(centroid: Vec2): boolean {
  const speed = Math.hypot(world.playerVel.x, world.playerVel.z)
  if (speed < MIN_EVASION_SPEED) return false

  const awayX = world.player.x - centroid.x
  const awayZ = world.player.z - centroid.z
  const len = Math.hypot(awayX, awayZ)
  if (len < 0.001) return false

  // Hareket vektörünün "merkezden uzaklaşma" yönündeki bileşeni.
  const speedAway = (world.playerVel.x * awayX + world.playerVel.z * awayZ) / len
  return speedAway > -APPROACH_TOLERANCE
}
