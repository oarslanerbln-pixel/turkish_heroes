import { create } from 'zustand'
import type { HilalPhase, StrikeRefusal } from '../mechanics/types'
import type { Outcome } from '../mechanics/combat'
import { parseCommander, type CommanderId } from '../mechanics/scenario'
import { resetWorld, world } from '../sim/world'
import { loadBestScore } from '../sim/score'
import { isUnlocked } from '../sim/progress'
import { isMuted, setMuted, unlockAudio } from '../audio/sfx'

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
  inCrescent: number // yay şimdi tetiklense kaç düşman düşerdi
  refusal: StrikeRefusal // son vuruş isteği neden reddedildi
  strikeReady: boolean
  totalKills: number
  waveIndex: number // 0 tabanlı
  score: number
  bestScore: number
  announcement: string // tek satırlık duyuru; boşsa gösterilmez
  stars: number // 0–3, yıldızlı senaryonun sonucunda
  battleTime: number // savaşın başından beri (sn) — gün çizgisi
  campDistance: number // ordunun ön hattının ordugaha uzaklığı
  corpsCohesion: number[] // birlik başına düzen; -1 = birlik yok
  defeatCause: 'health' | 'camp'
  emperorCaptured: boolean
}

interface GameState extends HudSnapshot {
  /** Başlangıç ekranı geçildi mi — world.started'ın sunum kopyası. */
  started: boolean
  commander: CommanderId
  muted: boolean
  syncHud: (snapshot: HudSnapshot) => void
  /** Başlangıç ekranında komutan seçimi; savaşı henüz başlatmaz. */
  selectCommander: (id: CommanderId) => void
  start: () => void
  requestStrike: () => void
  restart: () => void
  /** Sonuç ekranından komutan seçimine dön. */
  backToMenu: () => void
  toggleMute: () => void
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
  inCrescent: 0,
  refusal: 'none',
  strikeReady: false,
  totalKills: 0,
  waveIndex: 0,
  score: 0,
  // İlk render, yönetmenin ilk sync'inden önce olabilir; world zaten
  // localStorage'dan taze okumuş durumda, onu kullan.
  bestScore: world.bestScore,
  announcement: '',
  stars: 0,
  battleTime: 0,
  campDistance: 0,
  corpsCohesion: [],
  defeatCause: 'health',
  emperorCaptured: false,
}

// ?commander=alp-arslan: oyun testinde doğrudan o komutan seçili açılır
// ve kilidi atlar.
const urlCommander = typeof window !== 'undefined' ? parseCommander(window.location.search) : null
if (urlCommander) resetWorld(urlCommander)

/** Komutan seçilebilir mi: kilidi açık ya da URL ile istenmiş. */
export function isCommanderAvailable(id: CommanderId): boolean {
  return id === urlCommander || isUnlocked(id)
}

export const useGameStore = create<GameState>((set, get) => ({
  ...INITIAL_HUD,
  bestScore: world.bestScore,
  started: false,
  commander: world.commander,
  muted: isMuted(),

  syncHud: (snapshot) => set(snapshot),

  selectCommander: (id) => {
    if (id === world.commander || !isCommanderAvailable(id)) return
    // Sahne arkada seçilen savaşı göstersin: ordu, ordugah, oyuncunun yeri.
    resetWorld(id)
    set({ commander: id, bestScore: loadBestScore(id) })
  },

  // Kullanıcı hareketinin içinde çağrılır: sesin kilidi burada açılır.
  start: () => {
    unlockAudio()
    world.started = true
    set({ started: true })
  },

  toggleMute: () => {
    const muted = !get().muted
    setMuted(muted)
    set({ muted })
  },

  // Simülasyona bayrak bırakır; GameDirector bir sonraki karede tüketir.
  requestStrike: () => {
    world.strikeRequested = true
  },

  restart: () => {
    resetWorld()
    // HUD'u hemen sıfırla: yönetmenin ilk sync'ini beklerken sonuç ekranı
    // bir kare daha görünmesin. bestScore INITIAL_HUD'daki durgun değer değil,
    // resetWorld'ün localStorage'dan taze okuduğu world.bestScore'dan alınır —
    // yoksa bu oturumda kırılan rekor bir sonraki turda 0'a dönerdi.
    set({ ...INITIAL_HUD, bestScore: world.bestScore })
  },

  backToMenu: () => {
    world.started = false
    resetWorld()
    set({ ...INITIAL_HUD, bestScore: world.bestScore, started: false })
  },
}))
