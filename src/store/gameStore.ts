import { create } from 'zustand'

type GamePhase = 'retreat' | 'gather' | 'strike' | 'idle'

interface GameState {
  phase: GamePhase
  hilalEnergy: number       // 0–100
  enemyClusterDensity: number  // 0–1, düşman gruplaşma yoğunluğu
  setPhase: (phase: GamePhase) => void
  addHilalEnergy: (amount: number) => void
  resetEnergy: () => void
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'idle',
  hilalEnergy: 0,
  enemyClusterDensity: 0,
  setPhase: (phase) => set({ phase }),
  addHilalEnergy: (amount) =>
    set((s) => ({ hilalEnergy: Math.min(100, s.hilalEnergy + amount) })),
  resetEnergy: () => set({ hilalEnergy: 0 }),
}))
