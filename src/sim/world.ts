// Simülasyonun canlı state'i.
//
// Bilinçli olarak Zustand dışında tutuluyor: 48 düşmanın pozisyonu her karede
// store'a yazılsaydı React saniyede 60 kez re-render ederdi. Buradaki veri
// useFrame içinde yerinde mutate edilir; store'a yalnızca HUD'un gördüğü
// özet değerler throttle'lanarak aktarılır (bkz. GameDirector).

import { createEnemies } from '../mechanics/enemySim'
import type { Enemy, HilalPhase, Vec2 } from '../mechanics/types'

export interface World {
  player: Vec2
  /** Oyuncunun o karedeki hareket vektörü — çekilme tespitinde kullanılır. */
  playerVel: Vec2
  enemies: Enemy[]
  energy: number
  /** 0–1. Kümenin sıkışıklığı. */
  density: number
  /** 0–1. Kuşatmaya açıklık: density × (1 − disiplin). Enerjiyi bu doldurur. */
  vulnerability: number
  phase: HilalPhase
  /** Oyuncu kümeden uzaklaşıyor mu (sahte çekilme). */
  isRetreating: boolean
  /** Vuruş animasyonu için kalan süre; > 0 ise vuruş sürüyor. */
  strikeTimer: number
  /** Vuruşun tetiklendiği andaki küme merkezi — efekt burada çizilir. */
  strikeCenter: Vec2
  /** HUD veya klavye tarafından set edilir, GameDirector tüketir. */
  strikeRequested: boolean
  totalKills: number
}

export const world: World = {
  player: { x: 0, z: 8 },
  playerVel: { x: 0, z: 0 },
  enemies: createEnemies(),
  energy: 0,
  density: 0,
  vulnerability: 0,
  phase: 'idle',
  isRetreating: false,
  strikeTimer: 0,
  strikeCenter: { x: 0, z: 0 },
  strikeRequested: false,
  totalKills: 0,
}

export function resetWorld(): void {
  world.player.x = 0
  world.player.z = 8
  world.playerVel.x = 0
  world.playerVel.z = 0
  world.enemies = createEnemies()
  world.energy = 0
  world.density = 0
  world.vulnerability = 0
  world.phase = 'idle'
  world.isRetreating = false
  world.strikeTimer = 0
  world.strikeCenter.x = 0
  world.strikeCenter.z = 0
  world.strikeRequested = false
  world.totalKills = 0
}
