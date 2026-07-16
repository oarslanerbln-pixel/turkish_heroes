import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  approachAngle,
  calcFacing,
  calcSiegeState,
  countInCrescent,
  executeStrike,
  HILAL_CONFIG,
  isStrikeReady,
  resolvePhase,
  stepEnergy,
} from '../mechanics/hilalSystem'
import { calcContactDamage, countAttackers, resolveOutcome } from '../mechanics/combat'
import type { StrikeRefusal, Vec2 } from '../mechanics/types'
import { spawnWave, TOTAL_WAVES, waveClearBonus } from '../mechanics/waves'
import { useGameStore } from '../store/gameStore'
import { isPlaying, world } from '../sim/world'
import { saveBestScore } from '../sim/score'

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

/** Düşürülen düşman başına puan. */
const SCORE_PER_KILL = 100
/** Zaferde kalan can başına bonus — efficient/temiz oynamayı ödüllendirir. */
const HEALTH_BONUS_PER_POINT = 5

function refuse(reason: StrikeRefusal): void {
  world.refusal = reason
  world.refusalTimer = REFUSAL_DURATION
}

export function GameDirector() {
  const hudTimer = useRef(0)
  const syncHud = useGameStore((s) => s.syncHud)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const siege = calcSiegeState(world.enemies)

    if (isPlaying()) {
      world.density = siege.density
      world.vulnerability = siege.vulnerability
      world.isRetreating = siege.centroid ? detectRetreat(siege.centroid) : false

      world.attackers = countAttackers(world.enemies, world.player)
      world.playerHealth = Math.max(
        0,
        world.playerHealth - calcContactDamage(world.attackers, dt),
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
      world.inCrescent = countInCrescent(world.enemies, world.player, world.facing)

      world.refusalTimer = Math.max(0, world.refusalTimer - dt)

      if (world.strikeTimer > 0) {
        world.strikeTimer = Math.max(0, world.strikeTimer - dt)
      } else if (world.strikeRequested && !isStrikeReady(world.energy)) {
        refuse('notReady')
        world.energy = stepEnergy(world.energy, siege.vulnerability, dt)
      } else if (world.strikeRequested && world.inCrescent === 0) {
        // Boş havaya kapanan kuşatma anlamsız; dolu enerjiyi harcatma.
        refuse('noTargets')
      } else if (world.strikeRequested) {
        // Vuruş, enerji ilerletilmeden ÖNCE değerlendirilir: oyuncu HUD'da
        // gördüğü enerjiye basıyor, bu karede hesaplanacak olana değil.
        const kills = executeStrike(world.enemies, world.player, world.facing)
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

      // Vuruş sonrası düşen düşman sayısı yukarıda değişmiş olabilir; dalga
      // temizlendi mi kontrolü bu yüzden burada, güncel sayıyla yapılır.
      // alive sadece executeStrike ile azaldığı için tek bir noktada kontrol
      // etmek yeterli — temas hasarı düşman öldürmüyor.
      if (countAlive() === 0 && world.waveIndex < TOTAL_WAVES - 1) {
        world.score += waveClearBonus(world.waveIndex)
        world.waveIndex++
        world.enemies = spawnWave(world.waveIndex)
      }

      world.phase = resolvePhase({
        vulnerability: siege.vulnerability,
        isRetreating: world.isRetreating,
        strikeTimer: world.strikeTimer,
      })

      const prevOutcome = world.outcome
      world.outcome = resolveOutcome(world.playerHealth, countAlive())
      if (world.outcome !== 'playing' && prevOutcome === 'playing') {
        if (world.outcome === 'victory') {
          // Son dalganın kendi temizleme bonusu yukarıdaki dalga-geçiş
          // bloğunda verilmez (waveIndex zaten TOTAL_WAVES-1'de sabitlenip
          // spawn edilmez); burada tamamlanıyor.
          world.score += waveClearBonus(world.waveIndex)
          world.score += Math.round(world.playerHealth * HEALTH_BONUS_PER_POINT)
        }
        world.bestScore = saveBestScore(world.score)
      }
    }

    // İstek her karede tüketilir: vuruş hazır değilken basılan tuş birikip
    // enerji dolar dolmaz kendiliğinden patlamasın.
    world.strikeRequested = false

    hudTimer.current += dt
    if (hudTimer.current >= HUD_SYNC_INTERVAL) {
      hudTimer.current = 0
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

function countAlive(): number {
  let n = 0
  for (const e of world.enemies) {
    if (e.alive) n++
  }
  return n
}
