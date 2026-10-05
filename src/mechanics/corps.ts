// Alp Arslan — Malazgirt 1071: birlik düzeninde savaşan Bizans ordusu.
//
// Metehan'da düşman tek bir sürüdür; peşine takılınca kümelenir. Burada ordu
// dört birlikten oluşan disiplinli bir hattır ve kovalamakla dağılmaz. Her
// birliğin tek bir düzen (cohesion) değeri var ve askerlerin disiplini ondan
// gelir. Zincir yine aynı: disiplin → kuşatılabilirlik → hilal enerjisi.
// Yeni olan, disiplini bozmanın yolu:
//   - Gündüz: taciz menzilinde durmak düzeni yavaşça düşürür (taban 0,6).
//     Çok yaklaşmak birliği hamleye kışkırtır — hızlı ama tehlikeli yıpratma.
//   - Akşam: ordu geri döner. Dönüş, düzeni düşük birlikte uzun sürer ve
//     ortasında disiplin sıfıra iner; asıl kuşatma anı budur.
//   - Artçı akşam düzeni düşükse savaş alanını terk eder; merkez de
//     yıpranmışsa imparator korumasız kalır.
//   - Yem: hamle eden bölüğü pusudaki kola çeken oyuncu bölüğü kestirir,
//     kanadın komutanını esir aldırır. Komutansız kanat akşam sancağın
//     dönüşünü bozgun sanıp çekilir (bkz. stepAmbush).
//
// Saf veri ve saf fonksiyonlar: React'e ve world'e bağımlı değil, bot
// testleri (corps.test.ts) aynı kodu koşturur.

import { steerToward, ENEMY_CONFIG } from './enemySim'
import { calcSiegeState, type FallFilter, type SiegeState } from './hilalSystem'
import { confineToPass, narrowness, PASS, passHalfWidth } from './pass'
import { mulberry32 } from './random'
import type { Enemy, Vec2 } from './types'
import {
  canSpring,
  createWings,
  moveWing,
  stepStrength,
  WING_CONFIG,
  wingHarass,
  wingPin,
  type WingState,
} from './wings'

/**
 * Denge sabitleri. Bilerek `as const` değil: canlı ayar paneli (?tune)
 * oyun sırasında değiştirebilsin. Değerler tasarım belgesinin başlangıç
 * noktası; bot taramasıyla ayarlanır (bkz. corps.test.ts).
 */
export const BATTLE_CONFIG = {
  /** Gün batımı (sn). Bu ana kadar ordu ilerler; sonra döner. */
  dayLength: 100,
  /** Gece çöker, savaş biter (sn). */
  nightAt: 160,
  /**
   * Gece zaferi için düşürülmesi gereken ordu payı. Ordugahı korumak tek
   * başına zafer değil: kenarda bekleyen oyuncu geri çekilmiş sayılır.
   * Taciz eden oyuncu bota göre en az 17 düşürüyor, hiç dokunmayan 0.
   */
  nightGoal: 0.25,

  /** Ordunun merkezinin başlangıç z'si. */
  armyStartZ: -14,
  /** Selçuklu ordugahı: ordunun ön hattı bu z'ye gündüz varırsa yenilgi. */
  campZ: 14,
  /** İlerleme hızı (birim/sn) — düzenle ölçeklenir: × (0,5 + 0,5 × düzen). */
  advanceSpeed: 0.3,

  /** Taciz menzili: bu mesafe ve altı tam etki. */
  harassNear: 6,
  /** Taciz menzilinin dış sınırı; ötesinde etki yok. */
  harassFar: 11,
  /** Dış sınırdaki etki. */
  harassFarEffect: 0.3,
  /** Tam etkide düzenin saniyelik düşüşü. */
  harassDecay: 0.02,
  /** Taciz edilmeyen birliğin düzeninin saniyelik toparlanması. */
  cohesionRecovery: 0.005,
  /** Gündüz düzen bunun altına inmez: asıl çöküş akşama kalır. */
  dayFloor: 0.6,
  /**
   * Ok altındaki birlik yavaşlar: ilerleyiş × (1 − harassSlow × taciz).
   * Düzen düşüşü yavaş bir birikim; bu ise oyuncunun tacizinin anında
   * görülen karşılığı.
   */
  harassSlow: 0.6,

  /** Oyuncu bir birliğin askerine bu kadar yaklaşırsa hamle sayacı işler. */
  chargeTrigger: 6,
  /** Hamle için yakında kalma süresi (sn). */
  chargeDwell: 1.5,
  /** Hamle öncesi uyarı (sn): askerler kızarır, oyuncu kaçabilir. */
  chargeTelegraph: 0.6,
  /** Hamle hızı — oyuncudan (6) hızlı ama kısa. */
  chargeSpeed: 7,
  chargeDuration: 2.5,
  /** Her hamle birliğin düzeninden bu kadar götürür. */
  chargeCohesionCost: 0.05,
  /** Hamleye çıkan asker sayısı (en yakınlar). */
  chargeSize: 4,
  /** Hamleden sonra aynı birliğin yeniden kışkırtılabilmesi için bekleme (sn). */
  chargeCooldown: 1.5,

  /** Hamle eden asker pusudaki kola bu kadar yaklaşırsa pusu tutar. */
  ambushRadius: 5,
  /** Pusu tutunca kolun bu yakınındaki hamle edenler kesilir (esir). */
  ambushCapture: 9,
  /** Pusunun kola maliyeti (güç). */
  ambushCost: 0.2,
  /** Bölüğü kesilen birliğin düzeninden düşen (gündüz tabanıyla sınırlı). */
  ambushShock: 0.1,
  /** Komutansız kanadın akşam çarkı bu kat uzun sürer (dağınık dönüş). */
  leaderlessTurn: 2,

  /** Ağır süvari teması: asker başına saniyelik hasar (Metehan'da 8). */
  contactDamage: 12,

  /** Dönüş süresi: taban + düzensizlik × çarpan (sn). */
  turnBase: 4,
  turnPerDisorder: 6,
  /** Dönüşün ortasında düzen yuvaları bu orana kadar sıkışır. */
  turnMinSpread: 0.45,

  /** Artçı, akşam düzeni bunun altındaysa savaş alanını terk eder. */
  rearguardThreshold: 0.8,
  /** Kollar akşam merkezi tutarken merkezin düzeni bunun altındaysa imparator korumasız. */
  emperorThreshold: 0.75,
  /**
   * Kolların merkezi tutma şiddeti (iki kolun toplamı): taze bir kol tek
   * başına yeter, gündüz tükenen iki kol yetmez.
   */
  emperorPin: 0.6,
  /** Gündüz vuruşundan sonra ordu irkilir: her birliğin düzeni bu kadar toparlanır. */
  strikeRecovery: 0.2,

  /** Askerin düzen yuvasına dönme hızı. */
  formationSpeed: 3,
  /** Çekilen artçının hızı. */
  fleeSpeed: 3.5,
  /** Düzen yuvaları arası mesafe. */
  slotSpacing: 2.2,
}

export interface CorpsDef {
  name: string
  size: number
  /** Saf genişliği; asker sayısı buna bölünerek sıralar oluşur. */
  cols: number
  /** Ordunun merkezine göre konum. */
  x: number
  z: number
}

/** Sol kanat, merkez, sağ kanat, artçı. Toplam 40 asker + imparator. */
export const CORPS: readonly CorpsDef[] = [
  { name: 'Sol kanat', size: 10, cols: 5, x: -11, z: 0 },
  { name: 'Merkez', size: 12, cols: 6, x: 0, z: 0 },
  { name: 'Sağ kanat', size: 10, cols: 5, x: 11, z: 0 },
  { name: 'Artçı', size: 8, cols: 4, x: 0, z: -7 },
]

export const CENTER = 1
export const REARGUARD = 3
/** Ordugaha varışı belirleyen ön birlikler — artçı arkada kalır. */
const FRONT_CORPS = [0, 1, 2] as const

/**
 * Miryokefalon kolunun ayarları (bkz. pass.ts). Bilerek `as const` değil:
 * ?tune paneli değiştirebilsin. Bot taramasıyla ayarlandı (column.test.ts).
 */
export const COLUMN_CONFIG = {
  /** Birlik merkezleri arası yürüyüş mesafesi. */
  gap: 6,
  /** Sıkışan birlik öndekine bu oranda yaklaşır: saflar iç içe girer. */
  squeeze: 0.45,
  /** Durdurulan birliğin sıkışma hızı (sn başına; boğazda tam, genişte %30'u). */
  jamRate: 0.12,
  /** Yol açılınca sıkışmanın çözülmesi (sn başına). */
  jamRecover: 0.08,
  /** Genişte sıkışmanın varabileceği en yüksek değer: yer varsa ordu yayılır. */
  wideJamCap: 0.35,
  /** Sıkışan birliğin düzeni kalıcı olarak da erir (tam sıkışmada sn başına). */
  jamDecay: 0.006,
  /** Düzen tabanı (geçitte gün batımı yok, taban hep geçerli). */
  floor: 0.5,
  /** Vuruştan sonra ordunun irkilip toparlanması. */
  strikeRecovery: 0.05,
  /** Kaya yığınının taciz yokken temizlenme süresi (sn). */
  clearTime: 40,
  /** Tam tacizde temizleme bu oranda yavaşlar. */
  clearHarassSlow: 0.7,
  /** Yığın kolun başını bu kadar önünde durdurur. */
  headroom: 2,
  /**
   * Merkez bu kadar sıkışıp düzeni bunun altına inince Manuel korumasız.
   * 0,8 sıkışma ancak boğazın yakınında mümkün (genişte tavan düşük): Manuel'i
   * açığa çıkarmanın yolu merkezi boğaza yığmak.
   */
  exposeJam: 0.8,
  exposeCohesion: 0.7,
  /** Yamaçtan inen kolun ilk darbesi bu kadar sıkışmış birliği sarsar. */
  shockJam: 0.5,
  /** Gece çöker, savaş biter (sn). */
  nightAt: 150,
  /**
   * Geçitte taciz kolu daha az yavaşlatır (açık alanda BATTLE_CONFIG.harassSlow):
   * yolu kesilmeyen kol oklar altında da geçidi aşmalı, kesmek tek yol olsun.
   */
  harassSlow: 0.3,
}

/**
 * Savaş alanı düzeni: ordunun dizilişi, hedef çizgisi, günün akışı, arazi.
 * Kurallar (taciz, hamle, kollar, vuruş bütçesi) ortak; düzen neyin nerede
 * ve ne zaman olduğunu söyler.
 */
export interface BattleLayout {
  id: 'malazgirt' | 'miryokefalon'
  corps: readonly CorpsDef[]
  armyStartZ: number
  /** Ön hat buraya varırsa yenilgi: ordugah ya da geçidin çıkışı. */
  objectiveZ: number
  /** Gün batımı (sn): ordu döner. Infinity: dönüş yok. */
  dayLength: number
  /** Gece çöker, savaş biter (sn). */
  nightAt: number
  /** Gece zaferi için düşürülmesi gereken ordu payı (0: gecenin gelmesi yeter). */
  nightGoal: number
  /** Ok altındaki birliğin yavaşlaması: ilerleyiş × (1 − harassSlow × taciz). */
  harassSlow: number
  /** Gündüz düzen tabanı. */
  dayFloor: number
  /** Gündüz vuruşundan sonra her birliğin toparlanması. */
  strikeRecovery: number
  /** Ön hat: ön birliklerin ortalaması (açık alan) ya da en öndeki (kol). */
  front: 'mean' | 'lead'
  /** Kolların hedef sırası (sol, sağ). */
  wingTargets: readonly [readonly number[], readonly number[]]
  /** Sağ kolun pusu yeri; sol kol aynası. */
  wingHome: Vec2
  playerStart: Vec2
  /** Dar geçit: kol halinde yürüyüş, sıkışma, YOLU KES (bkz. pass.ts). */
  pass: boolean
}

export const MALAZGIRT: BattleLayout = {
  id: 'malazgirt',
  corps: CORPS,
  // ?tune BATTLE_CONFIG'i canlı değiştirir; düzen değerleri oradan okur.
  get armyStartZ() {
    return BATTLE_CONFIG.armyStartZ
  },
  get objectiveZ() {
    return BATTLE_CONFIG.campZ
  },
  get dayLength() {
    return BATTLE_CONFIG.dayLength
  },
  get nightAt() {
    return BATTLE_CONFIG.nightAt
  },
  get nightGoal() {
    return BATTLE_CONFIG.nightGoal
  },
  get harassSlow() {
    return BATTLE_CONFIG.harassSlow
  },
  get dayFloor() {
    return BATTLE_CONFIG.dayFloor
  },
  get strikeRecovery() {
    return BATTLE_CONFIG.strikeRecovery
  },
  front: 'mean',
  wingTargets: [
    [0, CENTER, 2, REARGUARD],
    [2, CENTER, 0, REARGUARD],
  ],
  wingHome: { x: WING_CONFIG.homeX, z: WING_CONFIG.homeZ },
  playerStart: { x: 0, z: 16 },
  pass: false,
}

/**
 * Miryokefalon kolu, önden arkaya: öncü, merkez (Manuel), ağırlıklar, artçı.
 * Merkez ve artçı indeksleri Malazgirt'le aynı (CENTER, REARGUARD).
 */
export const COLUMN_CORPS: readonly CorpsDef[] = [
  { name: 'Öncü', size: 8, cols: 4, x: 0, z: 0 },
  { name: 'Merkez', size: 10, cols: 5, x: 0, z: -6.5 },
  { name: 'Ağırlıklar', size: 8, cols: 4, x: 0, z: -13 },
  { name: 'Artçı', size: 8, cols: 4, x: 0, z: -19.5 },
]

export const MIRYOKEFALON: BattleLayout = {
  id: 'miryokefalon',
  corps: COLUMN_CORPS,
  armyStartZ: -7,
  get objectiveZ() {
    return PASS.exitZ
  },
  dayLength: Infinity,
  get nightAt() {
    return COLUMN_CONFIG.nightAt
  },
  // Geçitte gecenin hedefi kolu durdurmak: geçidi aşamayan kol yenilmiştir.
  nightGoal: 0,
  get harassSlow() {
    return COLUMN_CONFIG.harassSlow
  },
  get dayFloor() {
    return COLUMN_CONFIG.floor
  },
  get strikeRecovery() {
    return COLUMN_CONFIG.strikeRecovery
  },
  front: 'lead',
  // Sol kol öncüyü, sağ kol merkezi öncelikle hedefler.
  wingTargets: [
    [0, CENTER, 2, REARGUARD],
    [CENTER, 0, 2, REARGUARD],
  ],
  // Pusu yamaçta, boğazın yanında.
  wingHome: { x: 12, z: 2 },
  playerStart: { x: 0, z: 16 },
  pass: true,
}

/** Düzenin sahadaki toplam askeri: birlikler + imparator. */
export function armySize(layout: BattleLayout): number {
  return layout.corps.reduce((n, c) => n + c.size, 0) + 1
}

/** Malazgirt'in sahadaki toplam askeri: birlikler + imparator. */
export const BATTLE_SIZE = armySize(MALAZGIRT)

/** İmparatorun merkez birliğine göre yuvası: safların hemen arkası. */
const EMPEROR_SLOT: Vec2 = { x: 0, z: -2.6 }

export type CorpsStatus = 'advancing' | 'turning' | 'withdrawing' | 'fleeing'

export interface CorpsState {
  /** Düzenin merkezi; askerler buna göre yuvalarına gider. */
  anchor: Vec2
  /** 0–1. Birliğin düzeni; askerlerin disiplini buradan gelir. */
  cohesion: number
  /** 0–1. Bu karedeki taciz şiddeti — görsel geri bildirim için. */
  harass: number
  /** Oyuncuya en yakın askerin mesafesi (kimse yoksa Infinity). */
  nearest: number
  /** Oyuncunun hamle menzilinde geçirdiği süre (sn). */
  provoke: number
  /** Yeni hamleye kalan bekleme (sn). */
  cooldown: number
  status: CorpsStatus
  /** Dönüşün ilerleyişi, 0–1. */
  turn: number
  /** Bu birliğin dönüşünün toplam süresi (sn). */
  turnDuration: number
  /** Hayattaki asker sayısı (bu karenin başındaki). */
  alive: number
  /** 0–1. Bu karede kolların tacizi; oyuncunun tacizine eklenir. */
  wingHarass: number
  /** 0–1. Hücumdaki kolların birliği tutması: ilerleyiş durur, dönüş uzar. */
  pinned: number
  /**
   * 0–1. Geçitte sıkışma: öndeki birlik ya da kaya yığını yolu kesince birlik
   * üst üste biner. Disiplin (1 − sıkışma) ile çarpılır; açık alanda hep 0.
   */
  jam: number
  /** Birliğin ilerleyebileceği en uzak z (öndeki birlik ya da yığın). */
  limit: number
  /** Kanadın komutanı pusuda esir düştü: akşam çarkı uzar, kol onu bırakır. */
  leaderless: boolean
}

/** Askerin anlık görevi. */
export const MODE_FORMATION = 0
export const MODE_TELEGRAPH = 1
export const MODE_CHARGE = 2

/** Savaşın o anki olayları — yönetmen duyuru ve ses için tüketip boşaltır. */
export type BattleEvent =
  | 'harass'
  | 'charge'
  | 'sunset'
  | 'rearguardLeaves'
  | 'emperorExposed'
  | 'emperorCaptured'
  /** Kol akşam dönen birliğe hücumun ilk darbesini vurdu. */
  | 'wingShockLeft'
  | 'wingShockRight'
  /** Kol dönmemiş, düzenli hatta çarptı: ilk darbesi boşa gitti. */
  | 'wingMetLeft'
  | 'wingMetRight'
  /** Merkez dönüşünü bitirdi, imparator açılmadan: muhafız toparlandı. */
  | 'guardRallied'
  /** Yem: pusudaki kol hamle eden bölüğü kesti (ayrıntı `ambushes`'ta). */
  | 'ambushLeft'
  | 'ambushRight'
  /** Pusuda bir kanat komutanı esir düştü (birlik başına bir kez). */
  | 'commanderCaptured'
  /** Komutansız birlik sancağın dönüşünü bozgun sandı, çekiliyor. */
  | 'corpsBreaks'
  /** Kol yoruldu, pusuya dönüyor. */
  | 'wingTiredLeft'
  | 'wingTiredRight'
  /** Geçit: yol kaya yığınıyla kesildi / öncü yığını temizledi. */
  | 'blockade'
  | 'blockadeCleared'
  /** Geçit: bir birlik ilk kez ağır sıkıştı (bir kez). */
  | 'jam'

export interface BattleState {
  layout: BattleLayout
  /** Savaşın başından beri geçen süre (sn). */
  time: number
  corps: CorpsState[]
  /** Selçuklu kolları: sol, sağ (bkz. wings.ts). */
  wings: WingState[]
  /** Asker başına görev (MODE_*), enemies ile aynı indeks. */
  mode: Uint8Array
  /** Görevin kalan süresi (uyarı / hamle). */
  modeTimer: Float32Array
  /** Asker başına düzen yuvası (birlik merkezine göre, ileri bakarken). */
  slots: Vec2[]
  rearguardLeft: boolean
  emperorExposed: boolean
  emperorCaptured: boolean
  /** Ordunun ön hattı gündüz ordugaha vardı. */
  reachedCamp: boolean
  /** Ön hattın z'si — HUD'da ordugaha kalan mesafe için. */
  frontZ: number
  events: BattleEvent[]
  /**
   * Hamle başlatan birlik ve hamle edenlerin ortası; her 'charge' olayına bir
   * kayıt. events ile birlikte okunup boşaltılır.
   */
  charges: { corps: number; pos: Vec2 }[]
  /** Tutan pusular: kesilen birlik, kol (−1/+1), yer ve esir sayısı. events ile birlikte okunup boşaltılır. */
  ambushes: { corps: number; side: -1 | 1; pos: Vec2; taken: number; commander: boolean }[]
  /** Bir kez gösterilen olaylar (ilk taciz, ilk hamle) tekrar yayılmasın. */
  seen: Set<BattleEvent>
  /** Geçit: kaya yığını (z'si ve kalan sağlamlığı 0–1); yoksa null. */
  blockade: { z: number; strength: number } | null
  /** YOLU KES savaş başına bir kez. */
  blockadeUsed: boolean
}

/**
 * Orduyu dizer. Tohum yalnızca küçük sapmalar verir (asker başına ±0,4,
 * ordu merkezinde ±1,5): her savaş aynı kurala, biraz farklı başlangıca sahip.
 */
export function createBattle(
  seed = 1071,
  layout: BattleLayout = MALAZGIRT,
): { battle: BattleState; enemies: Enemy[] } {
  const rand = mulberry32(seed)
  const jitter = (amount: number) => (rand() * 2 - 1) * amount
  // Geçitte kol ortada kalır; açık alanda ordunun yeri biraz oynar.
  const armyX = jitter(layout.pass ? 0.3 : 1.5)
  const armyZ = layout.armyStartZ

  const enemies: Enemy[] = []
  const slots: Vec2[] = []
  const corps: CorpsState[] = layout.corps.map((def, ci) => {
    const anchor = { x: armyX + def.x, z: armyZ + def.z }
    const rows = Math.ceil(def.size / def.cols)
    for (let i = 0; i < def.size; i++) {
      const col = i % def.cols
      const row = Math.floor(i / def.cols)
      // İlk sıra önde (+z): ordu ordugaha doğru ilerliyor.
      const slot = {
        x: (col - (def.cols - 1) / 2) * BATTLE_CONFIG.slotSpacing,
        z: ((rows - 1) / 2 - row) * BATTLE_CONFIG.slotSpacing,
      }
      slots.push(slot)
      enemies.push(soldier(enemies.length, anchor, slot, ci, jitter))
    }
    return {
      anchor,
      cohesion: 1,
      harass: 0,
      nearest: Infinity,
      provoke: 0,
      cooldown: 0,
      status: 'advancing',
      turn: 0,
      turnDuration: 0,
      alive: def.size,
      wingHarass: 0,
      pinned: 0,
      jam: 0,
      limit: Infinity,
      leaderless: false,
    }
  })

  // İmparator merkezin arkasında; muhafızları dağılana kadar korunuyor.
  slots.push({ ...EMPEROR_SLOT })
  const emperor = soldier(enemies.length, corps[CENTER].anchor, EMPEROR_SLOT, CENTER, jitter)
  emperor.emperor = true
  emperor.guarded = true
  enemies.push(emperor)
  corps[CENTER].alive++

  const battle: BattleState = {
    layout,
    time: 0,
    corps,
    wings: createWings(layout.wingHome),
    mode: new Uint8Array(enemies.length),
    modeTimer: new Float32Array(enemies.length),
    slots,
    rearguardLeft: false,
    emperorExposed: false,
    emperorCaptured: false,
    reachedCamp: false,
    frontZ: armyZ,
    events: [],
    charges: [],
    ambushes: [],
    seen: new Set(),
    blockade: null,
    blockadeUsed: false,
  }
  return { battle, enemies }
}

function soldier(
  id: number,
  anchor: Vec2,
  slot: Vec2,
  corps: number,
  jitter: (a: number) => number,
): Enemy {
  return {
    id,
    pos: { x: anchor.x + slot.x + jitter(0.4), z: anchor.z + slot.z + jitter(0.4) },
    vel: { x: 0, z: 0 },
    alive: true,
    discipline: 1,
    corps,
  }
}

/** Taciz etkisi: yakın menzilde 1, dış sınırda harassFarEffect, ötesinde 0. */
export function harassEffect(dist: number): number {
  const { harassNear, harassFar, harassFarEffect } = BATTLE_CONFIG
  if (dist <= harassNear) return 1
  if (dist > harassFar) return 0
  return 1 - ((1 - harassFarEffect) * (dist - harassNear)) / (harassFar - harassNear)
}

export function isDay(b: BattleState): boolean {
  return b.time < b.layout.dayLength
}

/**
 * Dönüşün disipline etkisi: başında ve sonunda 1, ortasında 0. Birlik
 * çark ederken saflar birbirine girer; kuşatma penceresi burası.
 */
export function turnFactor(c: CorpsState): number {
  return c.status === 'turning' ? 1 - Math.sin(Math.PI * c.turn) : 1
}

/**
 * Birliğin askerlerine geçen disiplin: düzen × dönüş × (1 − sıkışma). Akşam
 * dönüşü de geçitteki sıkışma da aynı yoldan kuşatma penceresi açar.
 */
export function corpsDiscipline(c: CorpsState): number {
  return c.cohesion * turnFactor(c) * (1 - c.jam)
}

/** Düzenin baktığı yön: ileri 0, dönüşte 0→π, çekilirken π. */
function formationAngle(c: CorpsState): number {
  if (c.status === 'turning') return Math.PI * c.turn
  if (c.status === 'withdrawing' || c.status === 'fleeing') return Math.PI
  return 0
}

/** İlerleme/çekilme hızı düzenle ölçeklenir: yıpranan birlik ağırlaşır. */
function marchSpeed(c: CorpsState): number {
  return BATTLE_CONFIG.advanceSpeed * (0.5 + 0.5 * c.cohesion)
}

/** Yeniden kullanılan geçici hedef — her askere yeni nesne ayrılmasın. */
const target: Vec2 = { x: 0, z: 0 }

/**
 * Savaşı bir kare ilerletir: gün saati, taciz, hamle, dönüş, artçı,
 * imparator ve askerlerin hareketi. Olaylar `b.events`'e eklenir.
 */
export function stepBattle(b: BattleState, enemies: Enemy[], player: Vec2, dt: number): void {
  if (dt <= 0) return
  const wasDay = isDay(b)
  b.time += dt

  if (wasDay && !isDay(b)) sunset(b)

  measureCorps(b, enemies, player)
  if (b.layout.pass) stepColumn(b, dt)
  stepWings(b, dt)

  const centerTurning = b.corps[CENTER].status === 'turning'
  for (let ci = 0; ci < b.corps.length; ci++) {
    const c = b.corps[ci]
    if (c.alive === 0) continue
    stepCohesion(b, c, dt)
    stepProvocation(b, c, ci, enemies, player, dt)
    stepAnchor(c, b.layout.harassSlow, dt)
  }

  if (!b.emperorExposed && emperorOpen(b)) {
    b.emperorExposed = true
    b.events.push('emperorExposed')
  }
  // Pencere kapandı: geç kalan bunu görsün (karnede de okunur).
  if (centerTurning && b.corps[CENTER].status !== 'turning' && !b.emperorExposed) {
    b.events.push('guardRallied')
  }

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]
    if (!e.alive) continue
    stepSoldier(b, e, i, enemies, player, dt)
  }
  if (!b.layout.pass) stepAmbush(b, enemies)

  if (isDay(b)) {
    b.frontZ = frontLine(b)
    if (b.frontZ >= b.layout.objectiveZ) b.reachedCamp = true
  }
}

/**
 * İmparator korumasız mı? Malazgirt: sancak dönüşü. Gün batımında imparatorun
 * sancağı döner, merkez çark eder; çark sürerken kollar merkezi tutuyorsa ve
 * merkez yıprandıysa hilalin boynuzları kapandı. Pencere merkezin görünür
 * dönüşü kadar: yıpranmış merkez geç döner (turnDuration), tutulan merkez daha
 * da geç (turnSlow). Çark bitince muhafız toparlanır. Artçının kaçışı tek
 * başına açmaz; kolları merkeze yöneltir (wingTarget). Miryokefalon:
 * muhafızlar geçitte sıkıştıysa ve merkezin düzeni kırıldıysa — Manuel açıkta.
 */
function emperorOpen(b: BattleState): boolean {
  const center = b.corps[CENTER]
  if (b.layout.pass) {
    return center.jam >= COLUMN_CONFIG.exposeJam && center.cohesion < COLUMN_CONFIG.exposeCohesion
  }
  const cfg = BATTLE_CONFIG
  return (
    center.status === 'turning' &&
    center.pinned >= cfg.emperorPin &&
    center.cohesion < cfg.emperorThreshold
  )
}

/**
 * Kolun yürüyüşü (yalnızca geçitte): her birlik öndekinin ya da kaya yığınının
 * gerisinde durur. Sıkışma yalnızca SERT duruştan birikir: yığına dayanan baş,
 * kolların yamaçtan inip tuttuğu birlik ya da duran bir birliğin arkasında
 * kalan. Tacizle yavaşlayan baş kolu birlikte yavaşlatır, sıkıştırmaz — ilk
 * taramada öyleydi ve yığının yeri hiçbir şeyi değiştirmiyordu. Sıkışma darda
 * hızlı, genişte yavaş ve sınırlı birikir. Yığına dayanan birlik yığını
 * temizler; taciz temizlemeyi yavaşlatır.
 */
function stepColumn(b: BattleState, dt: number): void {
  const cfg = COLUMN_CONFIG
  let ahead = b.blockade ? b.blockade.z - cfg.headroom : Infinity
  // Öndeki engel sert bir duruş mu (yığın ya da duran birlik)?
  let aheadStopped = b.blockade !== null
  let lead = true
  for (const c of b.corps) {
    if (c.alive === 0 || c.status === 'fleeing') continue
    // Öndeki birliğin gerisinde: sıkıştıkça ona daha çok yaklaşır.
    c.limit = lead ? ahead : ahead - cfg.gap * (1 - cfg.squeeze * c.jam)
    const atLimit = c.status === 'advancing' && c.anchor.z >= c.limit - 0.05
    // c.pinned bir önceki karenin (stepWings bu fonksiyondan sonra çalışır).
    const stopped = c.status === 'advancing' && ((atLimit && aheadStopped) || c.pinned >= 0.5)
    const narrow = narrowness(c.anchor.z)
    if (stopped) {
      const cap = cfg.wideJamCap + (1 - cfg.wideJamCap) * narrow
      c.jam = Math.min(cap, c.jam + cfg.jamRate * (0.3 + 0.7 * narrow) * dt)
      if (c.jam >= 0.5 && !b.seen.has('jam')) {
        b.seen.add('jam')
        b.events.push('jam')
      }
    } else {
      c.jam = Math.max(0, c.jam - cfg.jamRecover * dt)
    }
    if (lead && atLimit && b.blockade) {
      b.blockade.strength -= (dt / cfg.clearTime) * (1 - cfg.clearHarassSlow * c.harass)
      if (b.blockade.strength <= 0) {
        b.blockade = null
        b.events.push('blockadeCleared')
      }
    }
    ahead = c.anchor.z
    aheadStopped = stopped
    lead = false
  }
}

/**
 * YOLU KES: oyuncunun bulunduğu yere kaya yığını, savaş başına bir kez.
 * Kolun başı yığında durur, arkası sıkışır. Yığının gerisinde kalan birlikler
 * etkilenir; önüne çoktan geçmiş olan yürümeyi sürdürür.
 * @returns yığın düştü mü
 */
export function dropBlockade(b: BattleState, z: number): boolean {
  if (!b.layout.pass || b.blockadeUsed) return false
  b.blockade = { z: Math.min(PASS.exitZ - 1, Math.max(PASS.entryZ + 4, z)), strength: 1 }
  b.blockadeUsed = true
  b.events.push('blockade')
  return true
}

/**
 * Gün batımı: imparatorun sancağı döner, her birlik çark etmeye başlar.
 * Uzaktakiler dönüşü bozgun sanabilir: yıpranmış artçı çekilir. Komutanı esir
 * düşmüş kanat dönüşü beceremez: çarkı uzar, düzeni uzun süre çözük kalır.
 */
function sunset(b: BattleState): void {
  const cfg = BATTLE_CONFIG
  b.events.push('sunset')
  b.corps.forEach((c, ci) => {
    if (ci === REARGUARD && c.cohesion < cfg.rearguardThreshold) {
      c.status = 'fleeing'
      b.rearguardLeft = true
      b.events.push('rearguardLeaves')
      return
    }
    if (c.leaderless && c.alive > 0) b.events.push('corpsBreaks')
    c.status = 'turning'
    c.turn = 0
    c.turnDuration =
      (cfg.turnBase + cfg.turnPerDisorder * (1 - c.cohesion)) * (c.leaderless ? cfg.leaderlessTurn : 1)
  })
}

/**
 * Yem bölük (Bryennios I.14: ordugahın önünde görünüp kaçan Türk bölükleri
 * Basilakes'i peşine çekti; yolu kesildi, esir düştü). Oyuncunun peşine
 * takılan hamle bölüğü pusuda dinlenen kola yaklaşırsa kol çıkar: kolun
 * yakınındaki hamle edenler kesilir. Bir kanadın bölüğüyse komutanı da esir
 * düşer (kanat başına bir kez); merkezde imparator, artçıda yedek kalır. Her
 * kolun pususu savaşta bir kez tutar. Gerçekte bu çatışma savaştan bir gün önceydi; oyun onu
 * savaş gününe taşır (oyun kuralı).
 */
function stepAmbush(b: BattleState, enemies: Enemy[]): void {
  const cfg = BATTLE_CONFIG
  for (const w of b.wings) {
    if (!canSpring(w)) continue
    let ci = -1
    for (let i = 0; i < enemies.length && ci < 0; i++) {
      const e = enemies[i]
      if (e.alive && b.mode[i] === MODE_CHARGE && Math.hypot(e.pos.x - w.pos.x, e.pos.z - w.pos.z) < cfg.ambushRadius) {
        ci = e.corps ?? 0
      }
    }
    if (ci < 0) continue

    const c = b.corps[ci]
    const pos = { x: 0, z: 0 }
    let taken = 0
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]
      if (!e.alive || e.corps !== ci || b.mode[i] === MODE_FORMATION) continue
      if (Math.hypot(e.pos.x - w.pos.x, e.pos.z - w.pos.z) >= cfg.ambushCapture) continue
      e.alive = false
      b.mode[i] = MODE_FORMATION
      pos.x += e.pos.x
      pos.z += e.pos.z
      taken++
    }
    c.alive -= taken
    pos.x /= taken
    pos.z /= taken
    w.sprung = true
    w.strength = Math.max(0, w.strength - cfg.ambushCost)
    c.cohesion = clampCohesion(b, c.cohesion - cfg.ambushShock)
    const commander = ci !== CENTER && ci !== REARGUARD && !c.leaderless
    if (commander) c.leaderless = true
    b.ambushes.push({ corps: ci, side: w.side, pos, taken, commander })
    b.events.push(w.side < 0 ? 'ambushLeft' : 'ambushRight')
    if (commander) b.events.push('commanderCaptured')
  }
}

/** Her birliğin hayattaki asker sayısı ve oyuncuya en yakın askeri. */
function measureCorps(b: BattleState, enemies: readonly Enemy[], player: Vec2): void {
  for (const c of b.corps) {
    c.alive = 0
    c.nearest = Infinity
  }
  for (const e of enemies) {
    if (!e.alive || e.corps === undefined) continue
    const c = b.corps[e.corps]
    c.alive++
    const d = Math.hypot(e.pos.x - player.x, e.pos.z - player.z)
    if (d < c.nearest) c.nearest = d
  }
}

/**
 * Kolun hedefi: kendi tarafındaki sırayla; artçı kaçtıysa merkezin arkası
 * açık, kollar ona kapanır. Komutanı esir düşen kanadı kol bırakır: o yandan
 * yol merkeze açık.
 */
function wingTarget(b: BattleState, w: WingState): number {
  if (w.order === 'ambush') return -1
  if (b.rearguardLeft && b.corps[CENTER].alive > 0) return CENTER
  for (const ci of b.layout.wingTargets[w.side < 0 ? 0 : 1]) {
    const c = b.corps[ci]
    if (c.alive > 0 && c.status !== 'fleeing' && !c.leaderless) return ci
  }
  return -1
}

/**
 * Kolları sürer ve etkilerini hedef birliklere yazar (wingHarass, pinned).
 * Akşam dönen ya da çekilen birliğe varan hücumun ilk darbesi düzeni sarsar.
 */
function stepWings(b: BattleState, dt: number): void {
  for (const c of b.corps) {
    c.wingHarass = 0
    c.pinned = 0
  }
  for (const w of b.wings) {
    w.target = wingTarget(b, w)
    const c = w.target >= 0 ? b.corps[w.target] : null
    moveWing(w, c ? c.anchor : null, dt)
    if (c) {
      if (w.order === 'charge' && !w.shocked && w.presence >= 0.8) {
        if (shockable(b, c)) {
          w.shocked = true
          c.cohesion = clampCohesion(b, c.cohesion - WING_CONFIG.shock * w.strength)
          b.events.push(w.side < 0 ? 'wingShockLeft' : 'wingShockRight')
        } else if (!b.layout.pass && c.status === 'advancing') {
          // Erken salınan kol dönmemiş, yüzü dönük hatta çarpar: darbe boşa
          // gider. Sonradan dönen birliği sarsmak için emir yenilenmeli.
          w.shocked = true
          b.events.push(w.side < 0 ? 'wingMetLeft' : 'wingMetRight')
        }
      }
      c.wingHarass += wingHarass(w)
      // Açık alanda ilerleyen birlik hücumu karşılar ve yürümeyi sürdürür;
      // dönen ya da çekilen birlik karşılayamaz, yerinde kalır. Geçitte
      // yamaçtan inen kol kolu olduğu yerde tutar: arkası sıkışır.
      if (b.layout.pass || c.status !== 'advancing') c.pinned = Math.min(1, c.pinned + wingPin(w))
    }
    const discipline = c ? corpsDiscipline(c) : 0
    if (stepStrength(w, discipline, dt)) {
      b.events.push(w.side < 0 ? 'wingTiredLeft' : 'wingTiredRight')
    }
  }
}

/** Kolun hücumunun ilk darbesi bu birliği sarsar mı: akşam dönen ya da geçitte sıkışan. */
function shockable(b: BattleState, c: CorpsState): boolean {
  if (b.layout.pass) return c.jam >= COLUMN_CONFIG.shockJam
  return !isDay(b) && c.status !== 'advancing'
}

function stepCohesion(b: BattleState, c: CorpsState, dt: number): void {
  const cfg = BATTLE_CONFIG
  // Terk eden birlik artık savaşmıyor; düzeni anlamını yitirdi.
  const byPlayer = c.status === 'fleeing' ? 0 : harassEffect(c.nearest)
  c.harass = c.status === 'fleeing' ? 0 : Math.min(1, byPlayer + c.wingHarass)
  if (c.harass > 0) {
    c.cohesion -= cfg.harassDecay * c.harass * dt
    // İpucu oyuncunun kendi tacizi için: kolların tacizi onu yanlış yere yönlendirir.
    if (byPlayer > 0 && !b.seen.has('harass')) {
      b.seen.add('harass')
      b.events.push('harass')
    }
  } else {
    c.cohesion += cfg.cohesionRecovery * dt
  }
  // Geçitte sıkışan birlik kalıcı olarak da dağılır.
  c.cohesion -= COLUMN_CONFIG.jamDecay * c.jam * dt
  c.cohesion = clampCohesion(b, c.cohesion)
}

/** Gündüz taban düzen geçerli; akşam düzen sıfıra kadar düşebilir. */
function clampCohesion(b: BattleState, v: number): number {
  const floor = isDay(b) ? b.layout.dayFloor : 0
  return Math.min(1, Math.max(floor, v))
}

/**
 * Hamleye kışkırtma: oyuncu bir birliğin dibinde oyalanırsa en yakın askerler
 * uyarıdan sonra hamle eder. Yalnızca ilerleyen birlik hamle eder: dönen,
 * çekilen ya da kaçan ordu savunmadadır — akşam hasat zamanıdır.
 */
function stepProvocation(
  b: BattleState,
  c: CorpsState,
  ci: number,
  enemies: readonly Enemy[],
  player: Vec2,
  dt: number,
): void {
  const cfg = BATTLE_CONFIG
  c.cooldown = Math.max(0, c.cooldown - dt)
  if (c.status === 'advancing' && c.cooldown === 0 && c.nearest < cfg.chargeTrigger) {
    c.provoke += dt
  } else {
    c.provoke = Math.max(0, c.provoke - dt)
  }
  if (c.provoke < cfg.chargeDwell) return

  c.provoke = 0
  c.cooldown = cfg.chargeTelegraph + cfg.chargeDuration + cfg.chargeCooldown
  c.cohesion = clampCohesion(b, c.cohesion - cfg.chargeCohesionCost)
  launchCharge(b, ci, enemies, player)
  b.events.push('charge')
}

/** Oyuncuya en yakın `chargeSize` asker uyarı görevine geçer. İmparator hamle etmez. */
function launchCharge(b: BattleState, ci: number, enemies: readonly Enemy[], player: Vec2): void {
  const candidates: { i: number; d: number }[] = []
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]
    if (!e.alive || e.corps !== ci || e.emperor || b.mode[i] !== MODE_FORMATION) continue
    candidates.push({ i, d: Math.hypot(e.pos.x - player.x, e.pos.z - player.z) })
  }
  candidates.sort((a, c) => a.d - c.d)
  const chosen = candidates.slice(0, BATTLE_CONFIG.chargeSize)
  const pos = { x: 0, z: 0 }
  for (const { i } of chosen) {
    b.mode[i] = MODE_TELEGRAPH
    b.modeTimer[i] = BATTLE_CONFIG.chargeTelegraph
    pos.x += enemies[i].pos.x / chosen.length
    pos.z += enemies[i].pos.z / chosen.length
  }
  b.charges.push({ corps: ci, pos })
}

function stepAnchor(c: CorpsState, harassSlow: number, dt: number): void {
  // Hücumdaki kol birliği yerinde tutar: ne ilerleyebilir ne çekilebilir.
  const free = 1 - c.pinned
  switch (c.status) {
    case 'advancing':
      // Geçitte öndeki birliğin ya da yığının gerisinde durur (limit); açık alanda sınırsız.
      if (c.anchor.z < c.limit) {
        c.anchor.z = Math.min(
          c.limit,
          c.anchor.z + marchSpeed(c) * (1 - harassSlow * c.harass) * free * dt,
        )
      }
      break
    case 'turning':
      // Çark ederken yerinde: dönüş kendi başına yeterince karışık. Yanına
      // yüklenilen birlik çarkını geç tamamlar — kuşatma penceresi uzar.
      c.turn = Math.min(1, c.turn + (dt / c.turnDuration) * (1 - WING_CONFIG.turnSlow * c.pinned))
      if (c.turn >= 1) c.status = 'withdrawing'
      break
    case 'withdrawing':
      c.anchor.z -= marchSpeed(c) * free * dt
      break
    case 'fleeing':
      c.anchor.z -= BATTLE_CONFIG.fleeSpeed * dt
      break
  }
}

function stepSoldier(
  b: BattleState,
  e: Enemy,
  i: number,
  enemies: Enemy[],
  player: Vec2,
  dt: number,
): void {
  const cfg = BATTLE_CONFIG
  const c = b.corps[e.corps ?? 0]
  const factor = turnFactor(c)
  e.discipline = corpsDiscipline(c)
  if (e.emperor) e.guarded = !b.emperorExposed

  if (b.mode[i] === MODE_TELEGRAPH) {
    // Uyarı: yerinde durur, oyuncuya kaçma payı kalır.
    b.modeTimer[i] -= dt
    if (b.modeTimer[i] <= 0) {
      b.mode[i] = MODE_CHARGE
      b.modeTimer[i] = cfg.chargeDuration
    }
    target.x = e.pos.x
    target.z = e.pos.z
    steerToward(e, enemies, target, cfg.formationSpeed, 0, dt)
    confine(b, c, e, false)
    return
  }

  if (b.mode[i] === MODE_CHARGE) {
    b.modeTimer[i] -= dt
    if (b.modeTimer[i] <= 0) b.mode[i] = MODE_FORMATION
    steerToward(e, enemies, player, cfg.chargeSpeed, 0, dt)
    // Hamle eden asker yığının üstünden aşabilir: yığın kolu durdurur, atlıyı değil.
    confine(b, c, e, true)
    return
  }

  // Düzen yuvası: birlik merkezi + döndürülmüş, dönüşte sıkışan ofset.
  const slot = b.slots[i]
  const angle = formationAngle(c)
  // Kolların sıkıştırdığı birliğin safları daralır: kuşatılabilirlik artar.
  const spread =
    (cfg.turnMinSpread + (1 - cfg.turnMinSpread) * factor) * (1 - WING_CONFIG.squeeze * c.pinned)
  // Geçitte saflar duvarlar arasına sığar; sıkışan birlik boyuna da daralır.
  let fitX = 1
  let fitZ = 1
  if (b.layout.pass) {
    const def = b.layout.corps[e.corps ?? 0]
    const half = ((def.cols - 1) / 2) * cfg.slotSpacing
    fitX = Math.min(1, Math.max(0.3, (passHalfWidth(c.anchor.z) - 1) / Math.max(1, half)))
    fitZ = 1 - COLUMN_CONFIG.squeeze * c.jam
  }
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  target.x = c.anchor.x + (slot.x * cos + slot.z * sin) * spread * fitX
  target.z = c.anchor.z + (-slot.x * sin + slot.z * cos) * spread * fitZ

  const fleeing = c.status === 'fleeing'
  steerToward(e, enemies, target, fleeing ? cfg.fleeSpeed : cfg.formationSpeed, 0, dt)
  confine(b, c, e, false)

  // Terk eden asker arena sınırına varınca savaş alanından çıkar.
  // Sayım hemen düşer: birlik sayıları kare içinde tutarlı kalsın.
  if (fleeing && Math.hypot(e.pos.x, e.pos.z) >= ENEMY_CONFIG.arenaRadius - 0.3) {
    e.alive = false
    e.fled = true
    c.alive--
  }
}

/** Geçitte asker duvarların arasında ve (hamle dışında) yığının gerisinde kalır. */
function confine(b: BattleState, c: CorpsState, e: Enemy, charging: boolean): void {
  if (!b.layout.pass) return
  confineToPass(e.pos, 0.5)
  const block = b.blockade
  if (!charging && block && c.anchor.z < block.z && e.pos.z > block.z - 0.6) e.pos.z = block.z - 0.6
}

/**
 * Ön hat. Açık alanda ön birliklerin, hayattaki asker sayısıyla ağırlıklı
 * ortalama z'si; geçitte kolun en öndeki birliği.
 */
function frontLine(b: BattleState): number {
  if (b.layout.front === 'lead') {
    let lead = -Infinity
    for (const c of b.corps) if (c.alive > 0 && c.status !== 'fleeing') lead = Math.max(lead, c.anchor.z)
    return lead === -Infinity ? b.layout.armyStartZ : lead
  }
  let sum = 0
  let n = 0
  for (const ci of FRONT_CORPS) {
    const c = b.corps[ci]
    sum += c.anchor.z * c.alive
    n += c.alive
  }
  return n > 0 ? sum / n : BATTLE_CONFIG.armyStartZ
}

/**
 * Hilal enerjisini besleyen kuşatılabilirlik: tüm ordu değil, en savunmasız
 * birlik. Ordu tek küme olsaydı birliklerin arası açıklık yoğunluğu hep düşük
 * gösterirdi; oyuncu hangi birliği yıprattıysa onun kuşatılması ödüllenir.
 * Merkez (hilalin geri dönüş yönü için) tüm ordunun merkezi kalır.
 */
export function battleSiege(b: BattleState, enemies: readonly Enemy[]): SiegeState {
  const whole = calcSiegeState(enemies)
  let best: SiegeState | null = null
  for (let ci = 0; ci < b.corps.length; ci++) {
    if (b.corps[ci].status === 'fleeing') continue
    const s = calcSiegeState(enemies, ci)
    if (s.aliveCount > 0 && (!best || s.vulnerability > best.vulnerability)) best = s
  }
  if (!best) return whole
  return {
    centroid: whole.centroid,
    density: best.density,
    discipline: best.discipline,
    vulnerability: best.vulnerability,
    aliveCount: whole.aliveCount,
  }
}

/**
 * Hilal yayında kalan askerlerden kaçı düşebilir: birliğin düzeni bozulmuş
 * kısmı, alive × (1 − disiplin), en yakın tama yuvarlanmış. Düzenini koruyan asker
 * kalkanını kaldırır ve yaya kapılmaz — gündüz (düzen ≥ 0,6) bir kanadın en çok
 * %40'ı düşer; akşam dönüşün ortasında disiplin sıfıra indiğinde birliğin
 * tamamı. Böylece taciz yalnızca enerjiyi değil vuruşun gücünü de belirler,
 * ve hilali akşama saklamanın karşılığı ölçülebilir olur.
 *
 * Her vuruş ve her önizleme sayımı için yeni bütçe oluşturulur. Korumasız
 * imparator bütçeye tabi değil: onu yayına almak yeter.
 */
export function strikeBudget(b: BattleState): FallFilter {
  // Yuvarlama: hiç yıpratılmamış birlik (düzen 0,99) tek asker bile vermesin.
  const left = b.corps.map((c) => Math.round(c.alive * (1 - corpsDiscipline(c))))
  return (e) => {
    if (e.emperor) return true
    const ci = e.corps ?? 0
    if (left[ci] <= 0) return false
    left[ci]--
    return true
  }
}

/**
 * Vuruştan sonra. Gündüz tüm ordu irkilir: her birliğin düzeni toparlanır.
 * Yalnızca vurulan birlik toparlansaydı takas boş kalırdı — yay bir birliği
 * çoğu zaman bütünüyle alıyor, geriye irkilecek kimse kalmıyor. Böylece gündüz
 * vurmak diğer birliklerdeki taciz emeğini geri alır; hilali akşama saklamak
 * ödüllenir. Akşam dönen ordu irkilmez: hasat zamanı. İmparator düştüyse
 * esir alındı.
 */
export function afterStrike(b: BattleState, enemies: readonly Enemy[]): void {
  measureCorpsAlive(b, enemies)
  if (isDay(b)) {
    for (const c of b.corps) {
      c.cohesion = clampCohesion(b, c.cohesion + b.layout.strikeRecovery)
    }
  }
  const emperor = enemies.find((e) => e.emperor)
  if (emperor && !emperor.alive && !emperor.fled && !b.emperorCaptured) {
    b.emperorCaptured = true
    b.events.push('emperorCaptured')
  }
}

function measureCorpsAlive(b: BattleState, enemies: readonly Enemy[]): void {
  for (const c of b.corps) c.alive = 0
  for (const e of enemies) {
    if (e.alive && e.corps !== undefined) b.corps[e.corps].alive++
  }
}

export type BattleResult = 'playing' | 'victory' | 'defeat'

/** Yenilginin sebebi: can bitti, ordu hedefe vardı ya da gece hedef tutmadan çöktü. */
export type DefeatCause = 'health' | 'camp' | 'night'

/**
 * Savaşın sonucu. Yenilgi: can biter, ordu gündüz ordugaha varır ya da gece
 * gece hedefi tutmadan çöker (oyuncu geri çekilir). Zafer: imparator esir
 * alındı, gece hedefle çöktü ya da sahada kimse kalmadı.
 */
export function resolveBattle(
  b: BattleState,
  enemies: readonly Enemy[],
  health: number,
): BattleResult {
  if (health <= 0 || b.reachedCamp) return 'defeat'
  if (b.emperorCaptured) return 'victory'
  if (!enemies.some((e) => e.alive)) return 'victory'
  if (b.time >= b.layout.nightAt) {
    return countFallen(enemies) >= nightTarget(b.layout, enemies.length) ? 'victory' : 'defeat'
  }
  return 'playing'
}

/** Gece zaferi için düşürülmesi gereken asker sayısı. */
export function nightTarget(layout: BattleLayout, armySize: number): number {
  return Math.ceil(armySize * layout.nightGoal)
}

/** Yenilgi sebebi; resolveBattle'ın sırasıyla (ordugah, can, gece). */
export function defeatCause(b: BattleState | null, health: number): DefeatCause {
  if (b?.reachedCamp) return 'camp'
  if (health <= 0 || !b || b.time < b.layout.nightAt) return 'health'
  return 'night'
}

/** Düşürülen asker sayısı — kaçanlar sayılmaz. */
export function countFallen(enemies: readonly Enemy[]): number {
  let n = 0
  for (const e of enemies) if (!e.alive && !e.fled) n++
  return n
}

/**
 * İmparator esir düşünce sahadaki ordu teslim olur: kalan askerler esir
 * sayılır ve düşürülmüş gibi puan getirir. Böylece savaşı erken bitiren
 * ustalık, orduyu tek tek eritmekten az kazandırmaz. Kaçanlar sayılmaz.
 */
export function countSurrendered(b: BattleState, enemies: readonly Enemy[]): number {
  if (!b.emperorCaptured) return 0
  let n = 0
  for (const e of enemies) if (e.alive) n++
  return n
}

/**
 * Yıldızlar: 1 = geceye dek hayatta kal, gece hedefini tuttur, ordu hedefe
 * varmasın; 2 = ordunun en az yarısını düşür; 3 = imparatoru esir al.
 * Yalnızca zaferde anlamlı.
 */
export function battleStars(b: BattleState, enemies: readonly Enemy[]): number {
  if (b.emperorCaptured) return 3
  return countFallen(enemies) >= Math.ceil(enemies.length / 2) ? 2 : 1
}
