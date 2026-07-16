import { create } from 'zustand'
import type { HilalPhase } from '../mechanics/types'
import type { Outcome } from '../mechanics/combat'
import { resetWorld, world } from '../sim/world'

/**
 * Yalnızca sunum (HUD) state'i.
 * Simülasyonun gerçek verisi `sim/world.ts` içinde yaşar ve buraya
 * GameDirector tarafından throttle'lanarak aktarılır.
 */
export interface HudSnapshot {
  phase: HilalPhase
  outcome: Outcome
  hilalEnergy: number // 0–100
  playerHealth: number // 0–100
  attackers: number // oyuncuya temas eden düşman sayısı
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
  restart: () => void
}

const INITIAL_HUD: HudSnapshot = {
  phase: 'idle',
  outcome: 'playing',
  hilalEnergy: 0,
  playerHealth: 100,
  attackers: 0,
  enemyClusterDensity: 0,
  enemyDiscipline: 1,
  vulnerability: 0,
  enemiesAlive: 0,
  strikeReady: false,
  totalKills: 0,
}

export const useGameStore = create<GameState>((set) => ({
  ...INITIAL_HUD,

  syncHud: (snapshot) => set(snapshot),

  // Simülasyona bayrak bırakır; GameDirector bir sonraki karede tüketir.
  requestStrike: () => {
    world.strikeRequested = true
  },

  restart: () => {
    resetWorld()
    // HUD'u hemen sıfırla: yönetmenin ilk sync'ini beklerken sonuç ekranı
    // bir kare daha görünmesin.
    set(INITIAL_HUD)
  },
}))
