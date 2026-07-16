import { create } from 'zustand'
import type { HilalPhase } from '../mechanics/types'
import { world } from '../sim/world'

/**
 * Yalnızca sunum (HUD) state'i.
 * Simülasyonun gerçek verisi `sim/world.ts` içinde yaşar ve buraya
 * GameDirector tarafından throttle'lanarak aktarılır.
 */
export interface HudSnapshot {
  phase: HilalPhase
  hilalEnergy: number // 0–100
  enemyClusterDensity: number // 0–1, kümenin sıkışıklığı
  enemyDiscipline: number // 0–1, formasyon disiplini
  vulnerability: number // 0–1, kuşatmaya açıklık — enerjiyi bu doldurur
  enemiesAlive: number
  strikeReady: boolean
  totalKills: number
}

interface GameState extends HudSnapshot {
  syncHud: (snapshot: HudSnapshot) => void
  requestStrike: () => void
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'idle',
  hilalEnergy: 0,
  enemyClusterDensity: 0,
  enemyDiscipline: 1,
  vulnerability: 0,
  enemiesAlive: 0,
  strikeReady: false,
  totalKills: 0,

  syncHud: (snapshot) => set(snapshot),

  // Simülasyona bayrak bırakır; GameDirector bir sonraki karede tüketir.
  requestStrike: () => {
    world.strikeRequested = true
  },
}))
