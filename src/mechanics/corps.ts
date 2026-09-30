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
//
// Saf veri ve saf fonksiyonlar: React'e ve world'e bağımlı değil, bot
// testleri (corps.test.ts) aynı kodu koşturur.

import { steerToward, ENEMY_CONFIG } from './enemySim'
import { calcSiegeState, type FallFilter, type SiegeState } from './hilalSystem'
import { mulberry32 } from './random'
import type { Enemy, Vec2 } from './types'

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

  /** Ağır süvari teması: asker başına saniyelik hasar (Metehan'da 8). */
  contactDamage: 12,

  /** Dönüş süresi: taban + düzensizlik × çarpan (sn). */
  turnBase: 4,
  turnPerDisorder: 6,
  /** Dönüşün ortasında düzen yuvaları bu orana kadar sıkışır. */
  turnMinSpread: 0.45,

  /** Artçı, akşam düzeni bunun altındaysa savaş alanını terk eder. */
  rearguardThreshold: 0.8,
  /** Artçı gittiyse ve merkezin düzeni bunun altındaysa imparator korumasız. */
  emperorThreshold: 0.75,
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

/** Sahadaki toplam asker: birlikler + imparator. */
export const BATTLE_SIZE = CORPS.reduce((n, c) => n + c.size, 0) + 1

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

export interface BattleState {
  /** Savaşın başından beri geçen süre (sn). */
  time: number
  corps: CorpsState[]
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
  /** Bir kez gösterilen olaylar (ilk taciz, ilk hamle) tekrar yayılmasın. */
  seen: Set<BattleEvent>
}

/**
 * Orduyu dizer. Tohum yalnızca küçük sapmalar verir (asker başına ±0,4,
 * ordu merkezinde ±1,5): her savaş aynı kurala, biraz farklı başlangıca sahip.
 */
export function createBattle(seed = 1071): { battle: BattleState; enemies: Enemy[] } {
  const rand = mulberry32(seed)
  const jitter = (amount: number) => (rand() * 2 - 1) * amount
  const armyX = jitter(1.5)
  const armyZ = BATTLE_CONFIG.armyStartZ

  const enemies: Enemy[] = []
  const slots: Vec2[] = []
  const corps: CorpsState[] = CORPS.map((def, ci) => {
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
    time: 0,
    corps,
    mode: new Uint8Array(enemies.length),
    modeTimer: new Float32Array(enemies.length),
    slots,
    rearguardLeft: false,
    emperorExposed: false,
    emperorCaptured: false,
    reachedCamp: false,
    frontZ: armyZ,
    events: [],
    seen: new Set(),
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
  return b.time < BATTLE_CONFIG.dayLength
}

/**
 * Dönüşün disipline etkisi: başında ve sonunda 1, ortasında 0. Birlik
 * çark ederken saflar birbirine girer; kuşatma penceresi burası.
 */
export function turnFactor(c: CorpsState): number {
  return c.status === 'turning' ? 1 - Math.sin(Math.PI * c.turn) : 1
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
  const cfg = BATTLE_CONFIG
  const wasDay = isDay(b)
  b.time += dt

  if (wasDay && !isDay(b)) sunset(b)

  measureCorps(b, enemies, player)

  for (let ci = 0; ci < b.corps.length; ci++) {
    const c = b.corps[ci]
    if (c.alive === 0) continue
    stepCohesion(b, c, dt)
    stepProvocation(b, c, ci, enemies, player, dt)
    stepAnchor(c, dt)
  }

  // İmparator: artçı gittiyse ve merkez yıprandıysa akşam korumasız kalır.
  if (
    !b.emperorExposed &&
    !isDay(b) &&
    b.rearguardLeft &&
    b.corps[CENTER].cohesion < cfg.emperorThreshold
  ) {
    b.emperorExposed = true
    b.events.push('emperorExposed')
  }

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]
    if (!e.alive) continue
    stepSoldier(b, e, i, enemies, player, dt)
  }

  if (isDay(b)) {
    b.frontZ = frontLine(b)
    if (b.frontZ >= cfg.campZ) b.reachedCamp = true
  }
}

/** Gün batımı: her birlik dönmeye başlar; artçı yıprandıysa çekilir. */
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
    c.status = 'turning'
    c.turn = 0
    c.turnDuration = cfg.turnBase + cfg.turnPerDisorder * (1 - c.cohesion)
  })
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

function stepCohesion(b: BattleState, c: CorpsState, dt: number): void {
  const cfg = BATTLE_CONFIG
  // Terk eden birlik artık savaşmıyor; düzeni anlamını yitirdi.
  c.harass = c.status === 'fleeing' ? 0 : harassEffect(c.nearest)
  if (c.harass > 0) {
    c.cohesion -= cfg.harassDecay * c.harass * dt
    if (!b.seen.has('harass')) {
      b.seen.add('harass')
      b.events.push('harass')
    }
  } else {
    c.cohesion += cfg.cohesionRecovery * dt
  }
  c.cohesion = clampCohesion(b, c.cohesion)
}

/** Gündüz taban düzen geçerli; akşam düzen sıfıra kadar düşebilir. */
function clampCohesion(b: BattleState, v: number): number {
  const floor = isDay(b) ? BATTLE_CONFIG.dayFloor : 0
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
  for (const { i } of candidates.slice(0, BATTLE_CONFIG.chargeSize)) {
    b.mode[i] = MODE_TELEGRAPH
    b.modeTimer[i] = BATTLE_CONFIG.chargeTelegraph
  }
}

function stepAnchor(c: CorpsState, dt: number): void {
  switch (c.status) {
    case 'advancing':
      c.anchor.z += marchSpeed(c) * (1 - BATTLE_CONFIG.harassSlow * c.harass) * dt
      break
    case 'turning':
      // Çark ederken yerinde: dönüş kendi başına yeterince karışık.
      c.turn = Math.min(1, c.turn + dt / c.turnDuration)
      if (c.turn >= 1) c.status = 'withdrawing'
      break
    case 'withdrawing':
      c.anchor.z -= marchSpeed(c) * dt
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
  e.discipline = c.cohesion * factor
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
    return
  }

  if (b.mode[i] === MODE_CHARGE) {
    b.modeTimer[i] -= dt
    if (b.modeTimer[i] <= 0) b.mode[i] = MODE_FORMATION
    steerToward(e, enemies, player, cfg.chargeSpeed, 0, dt)
    return
  }

  // Düzen yuvası: birlik merkezi + döndürülmüş, dönüşte sıkışan ofset.
  const slot = b.slots[i]
  const angle = formationAngle(c)
  const spread = cfg.turnMinSpread + (1 - cfg.turnMinSpread) * factor
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  target.x = c.anchor.x + (slot.x * cos + slot.z * sin) * spread
  target.z = c.anchor.z + (-slot.x * sin + slot.z * cos) * spread

  const fleeing = c.status === 'fleeing'
  steerToward(e, enemies, target, fleeing ? cfg.fleeSpeed : cfg.formationSpeed, 0, dt)

  // Terk eden asker arena sınırına varınca savaş alanından çıkar.
  // Sayım hemen düşer: birlik sayıları kare içinde tutarlı kalsın.
  if (fleeing && Math.hypot(e.pos.x, e.pos.z) >= ENEMY_CONFIG.arenaRadius - 0.3) {
    e.alive = false
    e.fled = true
    c.alive--
  }
}

/** Ön birliklerin, hayattaki asker sayısıyla ağırlıklı ortalama z'si. */
function frontLine(b: BattleState): number {
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
  const left = b.corps.map((c) => Math.round(c.alive * (1 - c.cohesion * turnFactor(c))))
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
      c.cohesion = clampCohesion(b, c.cohesion + BATTLE_CONFIG.strikeRecovery)
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

/**
 * Savaşın sonucu. Yenilgi: can biter ya da ordu gündüz ordugaha varır.
 * Zafer: imparator esir alındı, gece çöktü ya da sahada kimse kalmadı.
 */
export function resolveBattle(
  b: BattleState,
  enemies: readonly Enemy[],
  health: number,
): BattleResult {
  if (health <= 0 || b.reachedCamp) return 'defeat'
  if (b.emperorCaptured || b.time >= BATTLE_CONFIG.nightAt) return 'victory'
  if (!enemies.some((e) => e.alive)) return 'victory'
  return 'playing'
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
 * Yıldızlar: 1 = hayatta kal, ordu ordugaha varmasın; 2 = ordunun en az
 * yarısını düşür; 3 = imparatoru esir al. Yalnızca zaferde anlamlı.
 */
export function battleStars(b: BattleState, enemies: readonly Enemy[]): number {
  if (b.emperorCaptured) return 3
  return countFallen(enemies) >= Math.ceil(enemies.length / 2) ? 2 : 1
}
