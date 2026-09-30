import { create } from 'zustand'
import type { HilalPhase, StrikeRefusal } from '../mechanics/types'
import type { Outcome } from '../mechanics/combat'
import type { Debrief } from '../debrief/debrief'
import { parseCommander, type CommanderId } from '../mechanics/scenario'
import { announce, isPlaying, resetWorld, world } from '../sim/world'
import { nextOrder, orderWing, type WingOrder } from '../mechanics/wings'
import { loadBestScore } from '../sim/score'
import { isUnlocked } from '../sim/progress'
import { isMuted, play, setMuted, unlockAudio } from '../audio/sfx'
import { setBattleMusic, startAmbience } from '../audio/ambience'
import { endUnfinished, track } from '../telemetry/track'

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
  wingOrders: WingOrder[] // Selçuklu kollarının emri (0 sol, 1 sağ); savaş yoksa boş
  wingStrength: number[] // kolların gücü 0–1
  defeatCause: 'health' | 'camp'
  emperorCaptured: boolean
  debrief: Debrief | null // savaş bitince karne; sürerken null
  unlocked: CommanderId | null // bu zaferle kilidi açılan komutan
}

interface GameState extends HudSnapshot {
  /** Başlangıç ekranı geçildi mi — world.started'ın sunum kopyası. */
  started: boolean
  /** Mola — world.paused'ın sunum kopyası. */
  paused: boolean
  commander: CommanderId
  muted: boolean
  syncHud: (snapshot: HudSnapshot) => void
  /** Başlangıç ekranında komutan seçimi; savaşı henüz başlatmaz. */
  selectCommander: (id: CommanderId) => void
  start: () => void
  requestStrike: () => void
  /** Kolun emrini sıradakine çevirir: pusu → taciz → hücum → pusu. */
  cycleWing: (wing: number) => void
  /** @param auto Uygulamadan çıkıldığı için (oyuncu kendisi durdurmadı). */
  pause: (auto: boolean) => void
  resume: () => void
  restart: () => void
  /** Sonuç ekranından komutan seçimine dön. */
  backToMenu: () => void
  /** Sonuç ekranından doğrudan başka bir komutanın savaşına (kilit açılınca). */
  playCommander: (id: CommanderId) => void
  toggleMute: () => void
}

const WING_NAMES = ['Sol kol', 'Sağ kol']

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
  wingOrders: [],
  wingStrength: [],
  defeatCause: 'health',
  emperorCaptured: false,
  debrief: null,
  unlocked: null,
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
  paused: false,
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
    startAmbience()
    world.started = true
    // Açılış çekimi yalnızca menüden girerken: YENİDEN'de oyuncu hemen oynamak ister.
    world.cameraCue = 'intro'
    set({ started: true })
  },

  toggleMute: () => {
    const muted = !get().muted
    setMuted(muted)
    set({ muted })
  },

  // Simülasyona bayrak bırakır; GameDirector bir sonraki karede tüketir.
  // Molada basılan tuş birikip DEVAM'da kendiliğinden vurmasın.
  requestStrike: () => {
    if (!world.paused) world.strikeRequested = true
  },

  // Emir doğrudan simülasyona işlenir (kol bir sonraki adımda yola çıkar);
  // düğme de beklemeden yeni emri göstersin diye HUD hemen güncellenir.
  cycleWing: (wing) => {
    const wings = world.battle?.wings
    const w = wings?.[wing]
    if (!wings || !w || !isPlaying()) return
    const order = nextOrder(w.order)
    if (!orderWing(w, order)) {
      play('refuse')
      announce(`${WING_NAMES[wing]} dinleniyor — atlar yorgun`)
      return
    }
    play('order')
    track({ type: 'wing_order', wing, order })
    set({ wingOrders: wings.map((x) => x.order) })
  },

  // Yalnızca savaş sürerken. Molada sahne donuk ('demand'), yönetmen
  // çalışmadığı için müziği o kapatamaz; burada kısılır, DEVAM'da geri gelir.
  pause: (auto) => {
    if (!world.started || world.outcome !== 'playing' || world.paused) return
    world.paused = true
    setBattleMusic(false, 0)
    track({ type: 'pause', auto })
    set({ paused: true })
  },

  resume: () => {
    if (!world.paused) return
    world.paused = false
    set({ paused: false })
  },

  restart: () => {
    // Moladan yeniden başlatılan savaş sonuçsuz kapanır (bitmişse etkisiz).
    endUnfinished('quit')
    resetWorld()
    // HUD'u hemen sıfırla: yönetmenin ilk sync'ini beklerken sonuç ekranı
    // bir kare daha görünmesin. bestScore INITIAL_HUD'daki durgun değer değil,
    // resetWorld'ün localStorage'dan taze okuduğu world.bestScore'dan alınır —
    // yoksa bu oturumda kırılan rekor bir sonraki turda 0'a dönerdi.
    set({ ...INITIAL_HUD, bestScore: world.bestScore, paused: false })
  },

  playCommander: (id) => {
    if (!isCommanderAvailable(id)) return
    endUnfinished('quit')
    // world.started korunur: savaş hemen başlar. Yeni savaş alanı, açılış çekimiyle.
    resetWorld(id)
    world.cameraCue = 'intro'
    set({ ...INITIAL_HUD, bestScore: world.bestScore, commander: id, paused: false })
  },

  backToMenu: () => {
    endUnfinished('quit')
    world.started = false
    resetWorld()
    set({ ...INITIAL_HUD, bestScore: world.bestScore, started: false, paused: false })
  },
}))
