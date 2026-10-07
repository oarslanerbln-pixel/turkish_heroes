import { create } from 'zustand'
import type { HilalPhase, StrikeRefusal } from '../mechanics/types'
import type { Outcome } from '../mechanics/combat'
import type { Debrief } from '../debrief/debrief'
import type { LoreCard } from '../lore/lore'
import { COMMANDERS, parseCommander, type CommanderId } from '../mechanics/scenario'
import { announce, enterMode, isPlaying, resetWorld, world, type CameraCue } from '../sim/world'
import type { FlowMode } from '../sim/flow'
import { nextOrder, orderWing, type WingOrder } from '../mechanics/wings'
import { dropBlockade as dropBlockadeAt, type DefeatCause } from '../mechanics/corps'
import { loadBestScore } from '../sim/score'
import { isUnlocked, reachedBaideng } from '../sim/progress'
import { BAIDENG_WAVE, retryWave } from '../mechanics/waves'
import {
  haptic,
  hapticsEnabled,
  holdAudio,
  isMuted,
  play,
  setHaptics,
  setHapticsEnabled,
  setMuted,
  unlockAudio,
} from '../audio/sfx'
import { startAmbience } from '../audio/ambience'
import { endUnfinished, track } from '../telemetry/track'
import { PLAYTEST } from '../playtest'
import { SHOT } from '../shot'

/** Giriş ekranı: açık, menüye solarak açılıyor, kapalı. */
export type TitleState = 'open' | 'leaving' | 'closed'

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
  /** Islıklı ok atılabilir mi; null: bu savaşta ıslıklı ok yok. */
  whistleReady: boolean | null
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
  defeatCause: DefeatCause
  emperorCaptured: boolean
  debrief: Debrief | null // savaş bitince karne; sürerken null
  unlocked: CommanderId | null // bu zaferle kilidi açılan komutan
  lore: LoreCard | null // bu savaşta kazanılan yeni tarih notu
  canBlock: boolean // geçit: YOLU KES henüz kullanılmadı
  blockade: number // geçit: kaya yığınının kalan sağlamlığı 0–1 (yoksa 0)
}

/** Arayüzü bekleten sinematik çekim (bkz. GameState.cinematic). */
export type Cinematic = 'opening' | 'volley'

interface GameState extends HudSnapshot {
  /** Akış — world.mode'un sunum kopyası; kare döngüsü, girdi ve HUD bundan türer. */
  mode: FlowMode
  commander: CommanderId
  muted: boolean
  /** Oyuncunun titreşim ayarı; "hareketi azalt" ayrıca kapatır. */
  haptics: boolean
  /** Her yarada bir artar: HUD'un kenar flaşı bununla yeniden oynar. */
  hurtPulse: number
  /**
   * "Hareketi azalt": sarsıntı, titreşim, sinematik çekimler ve arayüzün
   * kayan/büyüyen animasyonları kapalı. Şimdilik işletim sisteminin tercihi.
   */
  reducedMotion: boolean
  /**
   * Sinematik çekim sürüyor: sinema şeritleri iner, savaş arayüzü bekler.
   * 'opening' savaş açılışı, 'volley' hilal yaylımı. Yazarı CameraDirector;
   * atlanınca ya da çekim bitince kalkar.
   */
  cinematic: Cinematic | null
  /** Bilgi Hazinesi açıksa hangi komutanın sekmesinde; kapalıysa null. */
  archive: CommanderId | null
  /**
   * Giriş ekranı sayfa her açıldığında bir kez gelir; sonuçtan menüye dönüşte
   * gelmez. Çekim kipi onu atlar: kadrajlar menüden ölçülür.
   */
  title: TitleState
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
  /** Giriş ekranından menüye: menü altta açılır, ekran üstünde solar. */
  leaveTitle: () => void
  /** Solma bitti: giriş ekranı kalkar. */
  closeTitle: () => void
  requestStrike: () => void
  /** Islıklı ok: işaretlenen yer noktası (yalnız Metehan'da işler). */
  requestWhistle: (at: { x: number; z: number }) => void
  /** Kolun emrini sıradakine çevirir: pusu → taciz → hücum → pusu. */
  cycleWing: (wing: number) => void
  /** Geçit: YOLU KES — oyuncunun bulunduğu yere kaya yığını (bir kez). */
  dropBlockade: () => void
  /** @param auto Uygulamadan çıkıldığı için (oyuncu kendisi durdurmadı). */
  pause: (auto: boolean) => void
  resume: () => void
  /** Aynı savaş yeniden; Metehan'da Baideng'e varıldıysa oradan (bkz. retryWave). */
  restart: () => void
  /** Metehan: savaş bu dalgadan, tam canla (0 ya da ulaşılmış Baideng). */
  restartAt: (wave: number) => void
  /** Sonuç ekranından komutan seçimine dön. */
  backToMenu: () => void
  /** Sonuç ekranından doğrudan başka bir komutanın savaşına (kilit açılınca). */
  playCommander: (id: CommanderId) => void
  toggleMute: () => void
  toggleHaptics: () => void
}

const WING_NAMES = ['Sol kol', 'Sağ kol']

/**
 * Menü düğmelerinin tıkı. Menüde ilk dokunuş bu olabilir: bağlam burada açılır
 * (kullanıcı hareketinin içindeyiz); açılış sürerken ilk tık sessiz kalabilir.
 */
function uiTick(): void {
  unlockAudio()
  play('ui')
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
  whistleReady: null,
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

const reducedMotionQuery =
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

/** Bu oturumda açılış uçuşu oynamış savaşlar: aynı savaşa dönüşte kısa açılış yeter. */
const openingsSeen = new Set<CommanderId>()

/** Savaşa girişin çekimi: oturumdaki ilk girişte uçuş, sonra kısa açılış. */
function entryCue(id: CommanderId): CameraCue {
  if (openingsSeen.has(id)) return 'intro'
  openingsSeen.add(id)
  return 'opening'
}

/**
 * Açılış uçuşu oynayacak mı. Şeritler savaşın ilk render'ında insin: yoksa
 * arayüz bir kare görünüp kaybolurdu. Sonrasını CameraDirector sürdürür.
 */
function flies(reducedMotion: boolean): Cinematic | null {
  return world.cameraCue === 'opening' && !reducedMotion ? 'opening' : null
}

/** Komutan seçilebilir mi: kilidi açık ya da URL ile istenmiş. */
export function isCommanderAvailable(id: CommanderId): boolean {
  return id === urlCommander || isUnlocked(id)
}

export const useGameStore = create<GameState>((set, get) => ({
  ...INITIAL_HUD,
  bestScore: world.bestScore,
  mode: world.mode,
  commander: world.commander,
  muted: isMuted(),
  haptics: hapticsEnabled(),
  hurtPulse: 0,
  reducedMotion: reducedMotionQuery?.matches ?? false,
  cinematic: null,
  archive: null,
  title: SHOT !== null ? 'closed' : 'open',

  // Mod da her eşitlemede kopyalanır: savaşın bittiği kare sonucu ve karneyi
  // aynı anda getirir, sonuç ekranı boş açılmaz.
  syncHud: (snapshot) => set({ ...snapshot, mode: world.mode }),

  selectCommander: (id) => {
    if (id === world.commander || world.mode !== 'menu') return
    uiTick()
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
    if (world.mode !== 'menu' || !isCommanderAvailable(world.commander)) return
    unlockAudio()
    startAmbience()
    enterMode('playing')
    // Açılış çekimi yalnızca menüden girerken: YENİDEN'de oyuncu hemen oynamak ister.
    world.cameraCue = entryCue(world.commander)
    set({ mode: world.mode, archive: null, cinematic: flies(get().reducedMotion) })
  },

  enterBattle: (id) => {
    if (!isCommanderAvailable(id)) return
    get().selectCommander(id)
    get().start()
  },

  openArchive: (id) => {
    uiTick()
    set({ archive: id })
  },

  closeArchive: () => {
    uiTick()
    set({ archive: null })
  },

  // İlk kullanıcı hareketi çoğunlukla bu: ses bağlamı burada açılır.
  leaveTitle: () => {
    if (get().title !== 'open') return
    uiTick()
    set({ title: 'leaving' })
  },

  closeTitle: () => {
    if (get().title === 'leaving') set({ title: 'closed' })
  },

  toggleMute: () => {
    const muted = !get().muted
    // Menüde ilk dokunuş bu olabilir: bağlam açılsın ki "ses açıldı" duyulsun.
    unlockAudio()
    setMuted(muted)
    set({ muted })
    play('ui')
  },

  toggleHaptics: () => {
    const haptics = !get().haptics
    setHapticsEnabled(haptics)
    set({ haptics })
    // Açıldığını eliyle hissetsin.
    haptic(30)
  },

  // Simülasyona bayrak bırakır; GameDirector bir sonraki karede tüketir.
  // Molada basılan tuş birikip DEVAM'da kendiliğinden vurmasın.
  requestStrike: () => {
    if (world.mode !== 'paused') world.strikeRequested = true
  },

  // Vuruş gibi bayrak: GameDirector bir sonraki karede tüketir, molada birikmez.
  requestWhistle: (at) => {
    if (isPlaying()) world.whistleRequested = { x: at.x, z: at.z }
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
      announce(world, `${WING_NAMES[wing]} dinleniyor — atlar yorgun`)
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
      announce(world, 'Yol zaten kesildi — kaya yığını bir kez')
      return
    }
    track({ type: 'blockade', z: Math.round(b.blockade!.z * 10) / 10 })
    set({ canBlock: false, blockade: 1 })
  },

  // Yalnızca savaş sürerken. Ses, aşağıdaki abonelikle molada askıya alınır.
  pause: (auto) => {
    if (!enterMode('paused')) return
    track({ type: 'pause', auto })
    set({ mode: world.mode })
  },

  resume: () => {
    if (world.mode !== 'paused') return
    enterMode('playing')
    set({ mode: world.mode })
  },

  restart: () => {
    get().restartAt(world.battle ? 0 : retryWave(world.waveIndex))
  },

  restartAt: (wave) => {
    if (world.mode === 'menu') return
    // Baideng'den yalnızca Metehan'da ve oraya varılmışsa (bu savaşta ya da önce).
    const checkpoint = !world.battle && wave === BAIDENG_WAVE && (reachedBaideng() || world.waveIndex >= wave)
    if (wave !== 0 && !checkpoint) return
    // Moladan yeniden başlatılan savaş sonuçsuz kapanır (bitmişse etkisiz).
    endUnfinished('quit')
    resetWorld(world.commander, wave)
    enterMode('playing')
    // HUD'u hemen sıfırla: yönetmenin ilk sync'ini beklerken sonuç ekranı
    // bir kare daha görünmesin. bestScore INITIAL_HUD'daki durgun değer değil,
    // resetWorld'ün localStorage'dan taze okuduğu world.bestScore'dan alınır —
    // yoksa bu oturumda kırılan rekor bir sonraki turda 0'a dönerdi.
    // Dalga da: 1. dalganın başlığı bir kare görünüp Baideng'inkine dönmesin.
    set({ ...INITIAL_HUD, bestScore: world.bestScore, waveIndex: world.waveIndex, mode: world.mode })
  },

  playCommander: (id) => {
    if (world.mode === 'menu' || !isCommanderAvailable(id)) return
    endUnfinished('quit')
    // Savaş hemen başlar: yeni savaş alanı, açılış çekimiyle.
    resetWorld(id)
    enterMode('playing')
    world.cameraCue = entryCue(id)
    set({ ...INITIAL_HUD, bestScore: world.bestScore, commander: id, mode: world.mode, cinematic: flies(get().reducedMotion) })
  },

  backToMenu: () => {
    endUnfinished('quit')
    enterMode('menu')
    resetWorld()
    set({ ...INITIAL_HUD, bestScore: world.bestScore, mode: world.mode, archive: null })
  },
}))

// Mola sesi tek yerden: molaya giren ve çıkan her yol (DEVAM, YENİDEN,
// KOMUTANLAR, komutan değişimi) `mode`'u değiştirir. Abonelik set() içinde
// eşzamanlı çalışır, yani düğmenin kullanıcı hareketi hâlâ sürer; iOS bağlamın
// açılmasına ancak böyle izin verir.
useGameStore.subscribe((s, prev) => {
  const paused = s.mode === 'paused'
  if (paused !== (prev.mode === 'paused')) holdAudio(paused)
  if (s.reducedMotion !== prev.reducedMotion) applyMotion(s.reducedMotion)
})

/**
 * Bayrağın tek okuyucusu store değil: titreşim sfx'te, CSS kökteki
 * `data-reduced-motion`'da. Oyun içi bir ayar gelirse yalnızca store'u yazar.
 */
function applyMotion(reduced: boolean): void {
  setHaptics(!reduced)
  if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-reduced-motion', reduced)
}
applyMotion(useGameStore.getState().reducedMotion)
reducedMotionQuery?.addEventListener('change', (e) => useGameStore.setState({ reducedMotion: e.matches }))
