import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  calcSiegeState,
  executeStrike,
  HILAL_CONFIG,
  isStrikeReady,
  resolvePhase,
  stepEnergy,
} from '../mechanics/hilalSystem'
import type { Vec2 } from '../mechanics/types'
import { useGameStore } from '../store/gameStore'
import { world } from '../sim/world'

// Simülasyon sırası: oyuncu (0) → düşmanlar (1) → yönetmen (2).
// Yönetmen en son çalışır; oyuncu ve düşmanlar o kareyi çoktan işlemiştir.
const DIRECTOR_PRIORITY = 2

/** HUD'u 60Hz yerine ~12Hz güncelle — enerji çubuğu CSS ile yumuşatılıyor. */
const HUD_SYNC_INTERVAL = 0.08

/** Bu hızın altındaki uzaklaşma "çekilme" sayılmaz (yön titremesini eler). */
const RETREAT_VELOCITY_EPSILON = 0.5

export function GameDirector() {
  const hudTimer = useRef(0)
  const syncHud = useGameStore((s) => s.syncHud)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)

    const siege = calcSiegeState(world.enemies)
    world.density = siege.density
    world.vulnerability = siege.vulnerability
    world.isRetreating = siege.centroid ? detectRetreat(siege.centroid) : false

    if (world.strikeTimer > 0) {
      world.strikeTimer = Math.max(0, world.strikeTimer - dt)
    } else {
      world.energy = stepEnergy(world.energy, siege.vulnerability, dt)
      if (world.strikeRequested && isStrikeReady(world.energy) && siege.centroid) {
        world.totalKills += executeStrike(world.enemies, siege.centroid)
        world.strikeCenter.x = siege.centroid.x
        world.strikeCenter.z = siege.centroid.z
        world.strikeTimer = HILAL_CONFIG.strikeDuration
        world.energy = 0
      }
    }

    // İstek her karede tüketilir: vuruş hazır değilken basılan tuş birikip
    // enerji dolar dolmaz kendiliğinden patlamasın.
    world.strikeRequested = false

    world.phase = resolvePhase({
      vulnerability: siege.vulnerability,
      isRetreating: world.isRetreating,
      strikeTimer: world.strikeTimer,
    })

    hudTimer.current += dt
    if (hudTimer.current >= HUD_SYNC_INTERVAL) {
      hudTimer.current = 0
      syncHud({
        phase: world.phase,
        hilalEnergy: world.energy,
        enemyClusterDensity: siege.density,
        enemyDiscipline: siege.discipline,
        vulnerability: siege.vulnerability,
        enemiesAlive: siege.aliveCount,
        strikeReady: isStrikeReady(world.energy),
        totalKills: world.totalKills,
      })
    }
  }, DIRECTOR_PRIORITY)

  return null
}

/** Oyuncu küme merkezinden uzaklaşıyorsa sahte çekilme yapıyordur. */
function detectRetreat(centroid: Vec2): boolean {
  const awayX = world.player.x - centroid.x
  const awayZ = world.player.z - centroid.z
  const len = Math.hypot(awayX, awayZ)
  if (len < 0.001) return false

  // Hareket vektörünün "merkezden uzaklaşma" yönündeki bileşeni.
  const speedAway = (world.playerVel.x * awayX + world.playerVel.z * awayZ) / len
  return speedAway > RETREAT_VELOCITY_EPSILON
}
