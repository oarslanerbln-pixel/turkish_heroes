// Simülasyonun canlı state'i.
//
// Bilinçli olarak Zustand dışında tutuluyor: 48 düşmanın pozisyonu her karede
// store'a yazılsaydı React saniyede 60 kez re-render ederdi. Buradaki veri
// useFrame içinde yerinde mutate edilir; store'a yalnızca HUD'un gördüğü
// özet değerler throttle'lanarak aktarılır (bkz. GameDirector).

import { COMBAT_CONFIG, type Outcome } from '../mechanics/combat'
import { createBattle, type BattleState } from '../mechanics/corps'
import { battleLayout, type CommanderId } from '../mechanics/scenario'
import type { Debrief } from '../debrief/debrief'
import type { LoreCard } from '../lore/lore'
import type { Enemy, HilalPhase, StrikeRefusal, Vec2 } from '../mechanics/types'
import { spawnWave } from '../mechanics/waves'
import { parseSeed } from '../mechanics/random'
import { PLAYTEST } from '../playtest'
import { loadBestScore } from './score'

/** Kameraya tek seferlik işaret (bkz. components/cameraShots.ts). */
export type CameraCue = 'intro' | 'dusk'

export interface World {
  /** Oynanan komutan; senaryo kuralları buna göre seçilir (sim/scenarios.ts). */
  commander: CommanderId
  /** Alp Arslan savaşının durumu; dalgalı senaryoda null. */
  battle: BattleState | null
  /** Ordunun dizilişini veren tohum; savaş özetine yazılır. Dalgalı senaryo rastgelelik kullanmaz: null. */
  seed: number | null
  player: Vec2
  /** Gerçekleşen yer değiştirmeden türetilir, klavye niyetinden değil. */
  playerVel: Vec2
  playerHealth: number
  /** Oyuncuya temas eden düşman sayısı — HUD ve hasar için. */
  attackers: number
  enemies: Enemy[]
  /**
   * Savaşın simülasyon saati (sn): hitstop ve molada durur, ağır çekimde
   * yavaşlar. Malazgirt'te battle.time ile aynı ölçek.
   */
  time: number
  /** 0 tabanlı geçerli dalga indeksi. */
  waveIndex: number
  score: number
  /** localStorage'dan yüklenir, yeni rekor kırıldığında güncellenir. */
  bestScore: number
  energy: number
  /** 0–1. Kümenin sıkışıklığı. */
  density: number
  /** 0–1. Kuşatmaya açıklık: density × (1 − disiplin). Enerjiyi bu doldurur. */
  vulnerability: number
  phase: HilalPhase
  outcome: Outcome
  /** Oyuncu düşmanı peşinden sürüklüyor mu (sahte çekilme / kiting). */
  isRetreating: boolean
  /** Yayın gitmek istediği yön: en çok düşmanı yakalayan açı. Ayrık, sıçrayabilir. */
  facingTarget: number
  /** Yayın o anki yönü (atan2(dx, dz)); hedefe sınırlı hızla döner. */
  facing: number
  /** Yay şimdi tetiklense kaç düşman düşerdi — önizleme. */
  inCrescent: number
  /** Vuruş animasyonu için kalan süre; > 0 ise vuruş sürüyor. */
  strikeTimer: number
  /** Vuruşun tetiklendiği andaki yay merkezi (oyuncunun konumu). */
  strikeOrigin: Vec2
  /** Vuruşun tetiklendiği andaki yay yönü — efekt bununla çizilir. */
  strikeFacing: number
  /** HUD veya klavye tarafından set edilir, GameDirector tüketir. */
  strikeRequested: boolean
  /** Son vuruş isteği neden reddedildi — oyuncuya gösterilir. */
  refusal: StrikeRefusal
  /** Ret mesajının ekranda kalacağı süre. */
  refusalTimer: number
  totalKills: number
  /**
   * Oyuncu başlangıç ekranını geçti mi? Geçene kadar simülasyon donuk kalır —
   * sayfa açılır açılmaz düşman yürümesin. resetWorld bunu korur: "YENİDEN"
   * doğrudan oyuna döner, başlangıç ekranını tekrar göstermez.
   */
  started: boolean
  /**
   * Oyuncu durdurdu ya da uygulamadan çıktı. Simülasyon tamamen donar; savaş
   * yalnızca oyuncu DEVAM deyince sürer — telefona dönüldüğü anda düşman saldırmasın.
   */
  paused: boolean
  /**
   * Savaşın nesli: her resetWorld'de bir artar. Kamera ve görseller kendi
   * durumlarını (süren çekim, havadaki ok, kıvılcım) bununla sıfırlar; yoksa
   * YENİDEN'den sonra eski savaşınkiler yeni savaş alanında sürerdi.
   */
  generation: number
  /**
   * Vuruş anındaki donma (hitstop) için kalan süre, saniye. > 0 iken simülasyon
   * ilerlemez: kuşatmanın kapandığı an bir nefes boyu asılı kalır.
   */
  hitstop: number
  /**
   * Ağır çekimin kalan süresi (gerçek zaman, sn). > 0 iken simülasyon
   * SLOWMO_SCALE hızında ilerler: ilk hamle ve akşam dönüşü gibi anlar okunsun.
   */
  slowmo: number
  /**
   * Simülasyonun o anki hız çarpanı (0–1]. Ağır çekime sert değil rampayla
   * girer ve çıkar (stepTime); simDelta bununla ölçekler.
   */
  timeScale: number
  /**
   * Animasyon saati (sn): sim zamanıyla ilerler, menüde ve sonuçta da. Dörtnal
   * ve çimen bununla salınır; ağır çekimde gövdelerle birlikte yavaşlar,
   * vuruş donmasında durur. (world.time yalnızca savaş sürerken işler.)
   */
  animTime: number
  /** Son vuruşta düşenlerin konumları — kıvılcım efekti tüketip boşaltır. */
  fxKills: Vec2[]
  /**
   * Dalga temizlendikten sonra yenisi doğana kadar kalan süre. Mola olmadan
   * yeni dalga aynı karede doğuyor, son düşenlerin devrilişi yarıda kalıyordu.
   */
  waveBreak: number
  /** Tek satırlık duyuru ("Güneş batıyor") ve ekranda kalacağı süre. */
  announcement: string
  announceTimer: number
  /** Sırada bekleyen duyurular: aynı karede gelenler üst üste yazılmasın. */
  announceQueue: string[]
  /** Kazanılan yıldız (0–3); yalnızca yıldızlı senaryolarda, sonuçta set edilir. */
  stars: number
  /**
   * Sinematik çekim isteği: savaş açılışı ya da gün batımı. Kamera tüketip
   * boşaltır (fxKills gibi); simülasyonu etkilemez.
   */
  cameraCue: CameraCue | null
  /** Savaş bitince yazılan karne (bkz. debrief/debrief.ts); savaş sürerken null. */
  debrief: Debrief | null
  /** Bu zaferle kilidi açılan komutan — sonuç ekranı onu doğrudan önerir. */
  unlocked: CommanderId | null
  /** Bu savaşta kazanılan yeni tarih notu (bkz. lore/lore.ts); yoksa null. */
  lore: LoreCard | null
}

/** Oyun testinde ?seed= sabitse her savaş o tohumla başlar (karşılaştırma, hata ayıklama). */
const FIXED_SEED = PLAYTEST && typeof window !== 'undefined' ? parseSeed(window.location.search) : null

// Başlangıç değerleri tek yerde: resetWorld'ün bir alanı atlaması mümkün olmasın.
function initialWorld(commander: CommanderId): World {
  // Her savaş biraz farklı dizilişle başlasın; kurallar aynı.
  const layout = battleLayout(commander)
  const seed = layout ? (FIXED_SEED ?? Math.floor(Math.random() * 2 ** 31)) : null
  const battle = layout && seed !== null ? createBattle(seed, layout) : null

  return {
    commander,
    battle: battle?.battle ?? null,
    seed,
    // Ordu savaşlarında oyuncu ordunun önünde başlar (ordugah / geçidin kuzeyi);
    // ordu ufukta, -z'de.
    player: layout ? { ...layout.playerStart } : { x: 0, z: 8 },
    playerVel: { x: 0, z: 0 },
    playerHealth: COMBAT_CONFIG.playerMaxHealth,
    attackers: 0,
    enemies: battle?.enemies ?? spawnWave(0),
    time: 0,
    waveIndex: 0,
    score: 0,
    bestScore: loadBestScore(commander),
    energy: 0,
    density: 0,
    vulnerability: 0,
    phase: 'idle',
    outcome: 'playing',
    isRetreating: false,
    // Düşman -z'de doğuyor; yay baştan onlara baksın.
    facingTarget: Math.PI,
    facing: Math.PI,
    inCrescent: 0,
    strikeTimer: 0,
    strikeOrigin: { x: 0, z: 0 },
    strikeFacing: Math.PI,
    strikeRequested: false,
    refusal: 'none',
    refusalTimer: 0,
    totalKills: 0,
    started: false,
    paused: false,
    generation: 0,
    hitstop: 0,
    slowmo: 0,
    timeScale: 1,
    animTime: 0,
    fxKills: [],
    waveBreak: 0,
    announcement: '',
    announceTimer: 0,
    announceQueue: [],
    stars: 0,
    cameraCue: null,
    debrief: null,
    unlocked: null,
    lore: null,
  }
}

/**
 * Modül düzeyinde tek örnek. Referans sabit kalmalı — her yer bunu import ediyor.
 */
export const world: World = initialWorld('metehan')

/** @param commander Verilmezse aynı komutanla yeniden başlar. */
export function resetWorld(commander: CommanderId = world.commander): void {
  // bestScore korunur: initialWorld() zaten localStorage'dan taze okuyor,
  // dolayısıyla bir önceki oturumda kırılan rekor otomatik yansır.
  const started = world.started
  Object.assign(world, initialWorld(commander), { started, generation: world.generation + 1 })
}

/**
 * Yeni savaş bekçisi: döndürdüğü işlev, son çağrıdan beri resetWorld
 * çalıştıysa bir kez true verir. Her görsel kendininkini tutar
 * (`useMemo(newBattleWatch, [])`) ve karesinin başında sorar.
 */
export function newBattleWatch(): () => boolean {
  let seen = world.generation
  return () => {
    if (seen === world.generation) return false
    seen = world.generation
    return true
  }
}

/** Duyuru ekranda kalma süresi (sn). */
export const ANNOUNCE_SECONDS = 2.2

/** Tek satırlık duyuru; ekranda başka biri varsa sıraya girer. */
export function announce(text: string): void {
  if (world.announceTimer > 0) {
    world.announceQueue.push(text)
    return
  }
  world.announcement = text
  world.announceTimer = ANNOUNCE_SECONDS
}

/** Duyuru süresini gerçek zamanla eritir, bitince sıradakine geçer. */
export function stepAnnouncements(realDelta: number): void {
  if (world.announceTimer > 0) world.announceTimer = Math.max(0, world.announceTimer - realDelta)
  if (world.announceTimer === 0 && world.announceQueue.length > 0) {
    world.announcement = world.announceQueue.shift()!
    world.announceTimer = ANNOUNCE_SECONDS
  }
}

/**
 * Simülasyon yalnızca oyun sürerken ilerler: başlangıç ekranında,
 * molada ve yenilgi/zafer ekranında donar.
 */
export function isPlaying(): boolean {
  return world.started && world.outcome === 'playing' && !world.paused
}

/**
 * Simülasyonun bu karede ilerleyeceği süre. Sekme arka plandayken şişen delta
 * sınırlanır (karakter ışınlanmasın); hitstop ve mola sürerken sıfırdır.
 * Oyuncu, düşmanlar ve yönetmen aynı kuralı kullansın diye tek yerde.
 */
export function simDelta(delta: number): number {
  // Molada sahne 'demand' modunda; yine de boyut değişince çizilen bir kare
  // simülasyonu ilerletmesin.
  if (world.hitstop > 0 || world.paused) return 0
  return Math.min(delta, 0.1) * world.timeScale
}

/** Ağır çekimde simülasyonun hızı. */
export const SLOWMO_SCALE = 0.3

/**
 * Hız rampası (1/sn): ağır çekime hızlı girilir (%95'i ~0,19 sn), yavaş
 * çıkılır (~0,6 sn). Sert geçişte gövdeler bir karede üçte bire düşüyordu.
 */
const RAMP_IN = 16
const RAMP_OUT = 5

/**
 * Zamanı gerçek zamanla ilerletir: vuruş donması, ağır çekim süresi ve hız
 * rampası. Yönetmen karenin sonunda bir kez çağırır; molada çağrılmaz.
 * Donma ve ağır çekim gerçek zamanla erir: yavaşlayan dünyada uzamasınlar.
 */
export function stepTime(realDelta: number): void {
  if (world.hitstop > 0) {
    world.hitstop = Math.max(0, world.hitstop - realDelta)
    return
  }
  if (world.slowmo > 0) world.slowmo = Math.max(0, world.slowmo - realDelta)
  const target = world.slowmo > 0 ? SLOWMO_SCALE : 1
  const rate = target < world.timeScale ? RAMP_IN : RAMP_OUT
  world.timeScale += (target - world.timeScale) * (1 - Math.exp(-rate * realDelta))
  if (Math.abs(target - world.timeScale) < 1e-3) world.timeScale = target
}
