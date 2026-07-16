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
import type { Vec2 } from '../mechanics/types'
import { useGameStore } from '../store/gameStore'
import { isPlaying, world } from '../sim/world'

// Simülasyon sırası: oyuncu (0) → düşmanlar (1) → yönetmen (2).
// Yönetmen en son çalışır; oyuncu ve düşmanlar o kareyi çoktan işlemiştir.
const DIRECTOR_PRIORITY = 2

/** HUD'u 60Hz yerine ~12Hz güncelle — enerji çubuğu CSS ile yumuşatılıyor. */
const HUD_SYNC_INTERVAL = 0.08

/** Bu hızın altında hareket eden oyuncu kaçmıyor, hattını tutuyordur. */
const MIN_EVASION_SPEED = 1

/** Bu hızdan daha sert bir yaklaşma "hücum"dur; düşmanın düzenini bozmaz. */
const APPROACH_TOLERANCE = 1.5

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

      if (world.strikeTimer > 0) {
        world.strikeTimer = Math.max(0, world.strikeTimer - dt)
      } else if (world.strikeRequested && isStrikeReady(world.energy)) {
        // Vuruş, enerji ilerletilmeden ÖNCE değerlendirilir: oyuncu HUD'da
        // gördüğü enerjiye basıyor, bu karede hesaplanacak olana değil.
        world.totalKills += executeStrike(world.enemies, world.player, world.facing)
        world.strikeOrigin.x = world.player.x
        world.strikeOrigin.z = world.player.z
        world.strikeFacing = world.facing
        world.strikeTimer = HILAL_CONFIG.strikeDuration
        world.energy = 0
      } else {
        world.energy = stepEnergy(world.energy, siege.vulnerability, dt)
      }

      world.phase = resolvePhase({
        vulnerability: siege.vulnerability,
        isRetreating: world.isRetreating,
        strikeTimer: world.strikeTimer,
      })

      // Vuruş sonrası düşen düşman sayısı yukarıda değişmiş olabilir; sonuç
      // bu yüzden en sonda, güncel sayıyla belirlenir.
      world.outcome = resolveOutcome(world.playerHealth, countAlive())
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
        strikeReady: isStrikeReady(world.energy),
        totalKills: world.totalKills,
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
