import { create } from 'zustand'
import type { HilalPhase, StrikeRefusal } from '../mechanics/types'
import type { Outcome } from '../mechanics/combat'
import type { Debrief } from '../debrief/debrief'
import type { LoreCard } from '../lore/lore'
import { COMMANDERS, parseCommander, type CommanderId } from '../mechanics/scenario'
import { announce, isPlaying, resetWorld, world } from '../sim/world'
import { nextOrder, orderWing, type WingOrder } from '../mechanics/wings'
import { dropBlockade as dropBlockadeAt } from '../mechanics/corps'
import { loadBestScore } from '../sim/score'
import { isUnlocked } from '../sim/progress'
import { isMuted, play, setMuted, unlockAudio } from '../audio/sfx'
import { setBattleMusic, startAmbience } from '../audio/ambience'
import { endUnfinished, track } from '../telemetry/track'
import { PLAYTEST } from '../playtest'

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
  lore: LoreCard | null // bu savaşta kazanılan yeni tarih notu
  canBlock: boolean // geçit: YOLU KES henüz kullanılmadı
  blockade: number // geçit: kaya yığınının kalan sağlamlığı 0–1 (yoksa 0)
}

interface GameState extends HudSnapshot {
  /** Başlangıç ekranı geçildi mi — world.started'ın sunum kopyası. */
  started: boolean
  /** Mola — world.paused'ın sunum kopyası. */
  paused: boolean
  commander: CommanderId
  muted: boolean
  /** Bilgi Hazinesi açıksa hangi komutanın sekmesinde; kapalıysa null. */
  archive: CommanderId | null
  syncHud: (snapshot: HudSnapshot) => void
  /**
   * Başlangıç ekranında komutan seçimi; savaşı henüz başlatmaz. Kilitli
   * komutan da seçilebilir: savaş alanı arkada görünür, brifing okunur ama
   * savaşa girilemez — açılacak olanı görmek açma isteğini besler.
   */
  selectCommander: (id: CommanderId) => void
  /** Menüde sıradaki / önceki komutan (klavye: ↑ ↓). */
  stepCommander: (dir: 1 | -1) => void
  /** Seçili komutanla savaşa gir; komutan kilitliyse hiçbir şey yapmaz. */
  start: () => void
  /** Komutanı seç ve hemen savaşa gir (Hazine'deki kilitli notun çağrısı). */
  enterBattle: (id: CommanderId) => void
  openArchive: (id: CommanderId) => void
  closeArchive: () => void
  requestStrike: () => void
  /** Kolun emrini sıradakine çevirir: pusu → taciz → hücum → pusu. */
  cycleWing: (wing: number) => void
  /** Geçit: YOLU KES — oyuncunun bulunduğu yere kaya yığını (bir kez). */
  dropBlockade: () => void
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
  lore: null,
  canBlock: false,
  blockade: 0,
}

// ?commander=alp-arslan: oyun testi derlemesinde doğrudan o komutan seçili
// açılır ve kilidi atlar.
const urlCommander =
  PLAYTEST && typeof window !== 'undefined' ? parseCommander(window.location.search) : null
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
  archive: null,

  syncHud: (snapshot) => set(snapshot),

  selectCommander: (id) => {
    if (id === world.commander || world.started) return
    // Sahne arkada seçilen savaşı göstersin: ordu, ordugah, oyuncunun yeri.
    resetWorld(id)
    set({ commander: id, bestScore: loadBestScore(id) })
  },

  stepCommander: (dir) => {
    const i = COMMANDERS.findIndex((c) => c.id === get().commander)
    const next = COMMANDERS[(i + dir + COMMANDERS.length) % COMMANDERS.length]
    get().selectCommander(next.id)
  },

  // Kullanıcı hareketinin içinde çağrılır: sesin kilidi burada açılır.
  start: () => {
    if (world.started || !isCommanderAvailable(world.commander)) return
    unlockAudio()
    startAmbience()
    world.started = true
    // Açılış çekimi yalnızca menüden girerken: YENİDEN'de oyuncu hemen oynamak ister.
    world.cameraCue = 'intro'
    set({ started: true, archive: null })
  },

  enterBattle: (id) => {
    if (!isCommanderAvailable(id)) return
    get().selectCommander(id)
    get().start()
  },

  openArchive: (id) => set({ archive: id }),

  closeArchive: () => set({ archive: null }),

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

  // Yığın hemen düşer; ses ve duyuru senaryonun olay işleyişinden gelir.
  dropBlockade: () => {
    const b = world.battle
    if (!b?.layout.pass || !isPlaying()) return
    if (!dropBlockadeAt(b, world.player.z)) {
      play('refuse')
      announce('Yol zaten kesildi — kaya yığını bir kez')
      return
    }
    track({ type: 'blockade', z: Math.round(b.blockade!.z * 10) / 10 })
    set({ canBlock: false, blockade: 1 })
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
    set({ ...INITIAL_HUD, bestScore: world.bestScore, started: false, paused: false, archive: null })
  },
}))
