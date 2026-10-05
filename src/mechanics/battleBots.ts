// Ordu savaşları (Malazgirt, Miryokefalon) için headless oyun döngüsü ve test botları.
//
// Döngü oyunun adımını (sim/step.ts) sabit adımla çağırır: bot oyuncunun
// gördüğünü görür, oyuncunun girdisini verir; kurallar oyundakinin aynısı
// (vuruş sonrası donma dahil). Denge testleri ve tarama betikleri bunu
// kullanır. Oyun bu dosyayı yalnız çekim kipinde, ?bot= ile yükler (bkz.
// ShotDirector).

import {
  BATTLE_CONFIG,
  CENTER,
  countFallen,
  dropBlockade,
  isDay,
  MALAZGIRT,
  MODE_FORMATION,
  REARGUARD,
  type BattleLayout,
  type BattleResult,
  type BattleState,
} from './corps'
import { ENEMY_CONFIG } from './enemySim'
import { HILAL_CONFIG, isInCrescent } from './hilalSystem'
import { passHalfWidth } from './pass'
import type { Enemy, Vec2 } from './types'
import { orderWing, type WingOrder } from './wings'
import type { TelemetryEvent } from '../telemetry/summary'
import { battleEnd, SILENT_FX, stepGame, type StepEffects, type StepInput } from '../sim/step'
import { createWorld, type World } from '../sim/world'

export const BOT_DT = 1 / 60
/** Oyuncunun başlangıcı: ordugahın önü. */
export const PLAYER_START: Vec2 = { x: 0, z: 16 }

export interface BotView {
  battle: BattleState
  enemies: readonly Enemy[]
  player: Vec2
  energy: number
  facing: number
  inCrescent: number
  health: number
}

export interface BotAction {
  /** İstenen hareket; hızı retreatSpeed'e sınırlanır. */
  move: Vec2
  strike: boolean
  /** Kollara emir (sol, sağ); verilmezse emirler değişmez. */
  wings?: readonly WingOrder[]
  /** Geçit: YOLU KES, oyuncunun bulunduğu yere (savaş başına bir kez). */
  blockade?: boolean
}

export type Bot = (view: BotView) => BotAction

export interface BattleRun {
  result: BattleResult
  stars: number
  health: number
  fallen: number
  /** Oyunun puanı: vuruşla düşen, teslim olan, yıldız ve can bonusu. */
  score: number
  time: number
  strikes: number[]
  /** Akşam (gün batımından sonra) yapılan vuruşlardaki en büyük düşüş. */
  bestDuskStrike: number
  reachedCamp: boolean
  emperorExposed: boolean
  rearguardLeft: boolean
  /** Gün batımında birliklerin düzeni — ayar yaparken en çok bakılan değer. */
  duskCohesion: number[]
  /** Gün batımında kolların gücü. */
  duskWingStrength: number[]
  /** Geçit: yığının düştüğü z (düşmediyse null) ve birlik başına en yüksek sıkışma. */
  blockadeZ: number | null
  peakJam: number[]
}

/**
 * @param record Oyundaki olay takibiyle aynı olaylar; savaş karnesi testleri
 *   koşuyu oyuncunun özetine böyle çevirir. t: savaş saati (sn).
 * @param assist Hasar çarpanı (oyunda komutanla ilk savaş 0,5).
 */
export function runBattle(
  bot: Bot,
  seed: number,
  record?: (e: TelemetryEvent, t: number) => void,
  layout: BattleLayout = MALAZGIRT,
  assist = 1,
): BattleRun {
  const commander = layout.pass ? 'kilicarslan' : 'alp-arslan'
  const w = createWorld(commander, { seed, layout })
  w.assist = assist
  const battle = w.battle!
  const peakJam = battle.corps.map(() => 0)
  let blockZ: number | null = null
  const strikes: number[] = []
  let bestDuskStrike = 0
  let duskCohesion: number[] = []
  let duskWingStrength: number[] = []
  const fx: StepEffects = {
    ...SILENT_FX,
    track(e) {
      if (e.type === 'strike') {
        strikes.push(e.kills)
        if (!isDay(battle)) bestDuskStrike = Math.max(bestDuskStrike, e.kills)
      } else if (e.type === 'dusk') {
        duskCohesion = battle.corps.map((c) => c.cohesion)
        duskWingStrength = battle.wings.map((x) => x.strength)
      }
      record?.(e, battle.time)
    },
  }
  const input: StepInput = { move: { x: 0, z: 0 }, strike: false }
  const view: BotView = {
    battle,
    enemies: w.enemies,
    player: w.player,
    energy: 0,
    facing: w.facing,
    inCrescent: 0,
    health: w.playerHealth,
  }
  record?.({ type: 'battle_start', commander, attempt: 1, assist, seed }, 0)

  while (w.outcome === 'playing') {
    view.energy = w.energy
    view.facing = w.facing
    view.inCrescent = w.inCrescent
    view.health = w.playerHealth
    const action = bot(view)
    action.wings?.forEach((order, wi) => {
      const wing = battle.wings[wi]
      const before = wing.order
      if (orderWing(wing, order) && wing.order !== before) {
        record?.({ type: 'wing_order', wing: wi, order: wing.order }, battle.time)
      }
    })
    if (action.blockade && dropBlockade(battle, w.player.z)) {
      blockZ = battle.blockade!.z
      record?.({ type: 'blockade', z: Math.round(blockZ * 10) / 10 }, battle.time)
    }

    toInput(action, input)
    stepGame(w, input, BOT_DT, fx)
    battle.corps.forEach((c, ci) => (peakJam[ci] = Math.max(peakJam[ci], c.jam)))
    // Oyunda karenin sonunda boşalır (EventFlush).
    w.events.length = 0
  }

  const end = battleEnd(w)
  record?.(end, battle.time)
  return {
    result: w.outcome,
    stars: end.stars,
    health: w.playerHealth,
    fallen: countFallen(w.enemies),
    score: w.score,
    time: battle.time,
    strikes,
    bestDuskStrike,
    reachedCamp: battle.reachedCamp,
    emperorExposed: battle.emperorExposed,
    rearguardLeft: battle.rearguardLeft,
    duskCohesion,
    duskWingStrength,
    blockadeZ: blockZ,
    peakJam,
  }
}

/** Botun kararı oyuncunun girdisine: hız çubuğa çevrilir (retreatSpeed = tam itiş). */
function toInput(action: BotAction, input: StepInput): void {
  input.move.x = action.move.x / HILAL_CONFIG.retreatSpeed
  input.move.z = action.move.z / HILAL_CONFIG.retreatSpeed
  input.strike = action.strike
}

/**
 * Botu oyunun kendi döngüsüne bağlar (çekim kipi, bkz. shot.ts SHOT_BOT): her
 * kare oyuncunun girdisini bot yazar. Yalnız hareket ve vuruş; kol emri ve
 * YOLU KES çekimde verilmez. Ordu savaşı değilse girdiye dokunmaz.
 */
export function botDriver(makeBot: () => Bot): (w: World, input: StepInput) => void {
  let bot: Bot | null = null
  let view: BotView | null = null
  return (w, input) => {
    if (!w.battle) return
    if (!bot || !view || view.battle !== w.battle) {
      bot = makeBot()
      view = { battle: w.battle, enemies: w.enemies, player: w.player, energy: 0, facing: 0, inCrescent: 0, health: 0 }
    }
    view.energy = w.energy
    view.facing = w.facing
    view.inCrescent = w.inCrescent
    view.health = w.playerHealth
    toInput(bot(view), input)
  }
}

// ——— Bot yardımcıları ———

function toward(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const d = Math.hypot(dx, dz)
  // Hedefe yaklaşınca yavaşla: hedef noktada titreme olmasın.
  if (d < 0.3) return { x: 0, z: 0 }
  const s = Math.min(HILAL_CONFIG.retreatSpeed, d * 3)
  return { x: (dx / d) * s, z: (dz / d) * s }
}

/** En yakın tehdit (yoksa null) — bkz. isThreat. */
function nearestThreat(v: BotView): Enemy | null {
  let best: Enemy | null = null
  let bestD = Infinity
  v.enemies.forEach((e, i) => {
    if (!isThreat(v, e, i)) return
    const d = Math.hypot(e.pos.x - v.player.x, e.pos.z - v.player.z)
    if (d < bestD) {
      bestD = d
      best = e
    }
  })
  return best
}

/** Kaçış yönü bu kadar ileriye bakılarak denetlenir (sn). */
const FLEE_LOOKAHEAD = 2
/** Tehditten tam ters yönden sapma adayları (derece), öncelik sırasıyla. */
const FLEE_DEVIATIONS = [0, 20, -20, 40, -40, 60, -60, 80, -80, 100, -100]

/**
 * Hamleden kaç: tehditlerin tam tersine koş — kovalamada kaçanın tek avantajı
 * düz çizgi. Yol arena sınırına, geçit duvarına ya da başka bir askerin
 * dibine çıkıyorsa en az sapan açık yönü seç.
 */
function flee(v: BotView): Vec2 {
  let cx = 0
  let cz = 0
  let n = 0
  v.enemies.forEach((e, i) => {
    if (!isThreat(v, e, i)) return
    cx += e.pos.x
    cz += e.pos.z
    n++
  })
  const away = Math.atan2(v.player.x - cx / n, v.player.z - cz / n)
  const reach = HILAL_CONFIG.retreatSpeed * FLEE_LOOKAHEAD
  let best = away
  let bestClear = -Infinity
  for (const dev of FLEE_DEVIATIONS) {
    const a = away + (dev * Math.PI) / 180
    const fx = v.player.x + Math.sin(a) * reach
    const fz = v.player.z + Math.cos(a) * reach
    let clear = ENEMY_CONFIG.arenaRadius - 1.5 - Math.hypot(fx, fz)
    // Geçitte duvara kaçan kenarda sıkışır (oyuncu duvardan 0,6 içeride tutulur).
    if (v.battle.layout.pass) clear = Math.min(clear, passHalfWidth(fz) - 1.5 - Math.abs(fx))
    v.enemies.forEach((e, i) => {
      if (e.alive && v.battle.mode[i] === MODE_FORMATION && !isThreat(v, e, i)) {
        clear = Math.min(clear, Math.hypot(e.pos.x - fx, e.pos.z - fz) - 4)
      }
    })
    if (clear >= 0) {
      best = a
      break
    }
    if (clear > bestClear) {
      bestClear = clear
      best = a
    }
  }
  return { x: Math.sin(best) * HILAL_CONFIG.retreatSpeed, z: Math.cos(best) * HILAL_CONFIG.retreatSpeed }
}

/** Hamlede ya da uyarıda olan, ya da hamle dönüşü hâlâ dibimizde olan asker. */
function isThreat(v: BotView, e: Enemy, i: number): boolean {
  if (!e.alive) return false
  if (v.battle.mode[i] !== MODE_FORMATION) return true
  return Math.hypot(e.pos.x - v.player.x, e.pos.z - v.player.z) < 3.5
}

/** Birliğe göre bir durak: birlik merkezinden `dist` uzakta, `side` yönünde. */
function post(b: BattleState, ci: number, side: Vec2, dist: number): Vec2 {
  const a = b.corps[ci].anchor
  return { x: a.x + side.x * dist, z: a.z + side.z * dist }
}

/** Yoldaki birliklerle hamle tetiğinin ötesinde bırakılan pay. */
const PATH_CLEARANCE = 4.5
/**
 * Hedefe git, ama başka birliklerin dibinden geçme: hedefe çekim + çevredeki
 * askerlerden itilme (klasik yönlendirme davranışı). İtilme menzili hamle
 * tetiğinin biraz ötesinde: yoldaki birlik kışkırtılmasın. Hedef birlik
 * (`target`) itmez — oraya zaten gidiliyor.
 */
function navigate(v: BotView, dest: Vec2, target: number): Vec2 {
  const pull = toward(v.player, dest)
  const range = BATTLE_CONFIG.chargeTrigger + PATH_CLEARANCE - 4
  let px = 0
  let pz = 0
  for (const e of v.enemies) {
    if (!e.alive || e.corps === target) continue
    const dx = v.player.x - e.pos.x
    const dz = v.player.z - e.pos.z
    const d = Math.hypot(dx, dz)
    if (d >= range || d < 0.001) continue
    const w = ((range - d) / range) * 12
    px += (dx / d) * w
    pz += (dz / d) * w
  }
  const x = pull.x + px
  const z = pull.z + pz
  const len = Math.hypot(x, z)
  if (len < 0.001) return { x: 0, z: 0 }
  const speed = Math.max(Math.hypot(pull.x, pull.z), Math.min(len, HILAL_CONFIG.retreatSpeed))
  return { x: (x / len) * speed, z: (z / len) * speed }
}

/** Hâlâ düzeni en yüksek ön birlik — ordugaha en hızlı o yürüyor. */
function frontCorpsToWork(b: BattleState, current: number): number {
  // Histerezis: seçili birlik yeterince yıpranmadan başkasına geçme; birlikler
  // arasında gidip gelmek tacizden çok yol demek.
  const cur = current >= 0 ? b.corps[current] : null
  if (cur && cur.alive > 0 && cur.cohesion > BATTLE_CONFIG.dayFloor + 0.03) return current
  let best = -1
  let bestC = -1
  for (const ci of [0, 1, 2]) {
    const c = b.corps[ci]
    if (c.alive === 0) continue
    if (c.cohesion > bestC) {
      bestC = c.cohesion
      best = ci
    }
  }
  return best
}

/** Akşam: en düzensiz, dönüşü süren birlik (yoksa en düzensiz birlik). */
function duskTarget(b: BattleState): number {
  let best = -1
  let bestScore = Infinity
  b.corps.forEach((c, ci) => {
    if (c.alive === 0 || c.status === 'fleeing') return
    const d = c.cohesion * (c.status === 'turning' ? 1 - Math.sin(Math.PI * c.turn) : 1)
    if (d < bestScore) {
      bestScore = d
      best = ci
    }
  })
  return best
}

/** Pasif: ordugahta bekler. */
export const passiveBot = (): Bot => () => ({ move: { x: 0, z: 0 }, strike: false })

/**
 * Güvenli tacizci: ön birlikleri sırayla 9-10 birimden taciz eder, hamleden
 * kaçar, hilal dolunca en az 4 askeri içine alan vuruşu yapar.
 */
export function safeHarasser(minStrike = 6): () => Bot {
  return () => {
    let target = -1
    return (v) => {
      const threat = nearestThreat(v)
      if (threat) return { move: flee(v), strike: false }
      const b = v.battle
      target = isDay(b) ? frontCorpsToWork(b, target) : duskTarget(b)
      if (target < 0) return { move: { x: 0, z: 0 }, strike: v.inCrescent > 0 }
      // Birliğin önünde (ordugah tarafında) dur; çekilirken arkasından izle.
      const side = b.corps[target].status === 'advancing' ? { x: 0, z: 1 } : { x: 0, z: -1 }
      const dest = post(b, target, side, 10.5)
      return { move: navigate(v, dest, target), strike: v.inCrescent >= minStrike }
    }
  }
}

/** Açgözlü: güvenli tacizci gibi, ama hilal dolar dolmaz kimi yakalarsa vurur. */
export const greedyBot = safeHarasser(1)

/**
 * Kışkırtıcı: önce artçıyı, sonra merkezi hamleye kışkırtıp hızla yıpratır,
 * hilali akşama saklar. İmparator korumasız kalınca ona nişan alır.
 */
export const provokerBot = (): Bot => (v) => {
  const b = v.battle
  const threat = nearestThreat(v)
  if (threat) return { move: flee(v), strike: false }

  if (isDay(b)) {
    // Dibinde oyala (hamle menzili), uyarı gelince kaç. Önce merkez — önü açık
    // alan, kaçış kolay. Artçıya arkadan varılır; ordu arena sınırından
    // yeterince uzaklaşınca. İkisi de yıprandıysa kalan orduyu güvenli
    // mesafeden yavaşlat: ordugaha varırlarsa yıldızın anlamı kalmaz.
    const rear = b.corps[REARGUARD]
    const center = b.corps[CENTER]
    const rows = BATTLE_CONFIG.slotSpacing / 2
    if (rear.cohesion > 0.72 && rear.anchor.z > -22) {
      return { move: navigate(v, post(b, REARGUARD, { x: 0, z: -1 }, rows + 4.5), REARGUARD), strike: false }
    }
    if (center.cohesion > 0.62) {
      return { move: navigate(v, post(b, CENTER, { x: 0, z: 1 }, rows + 4.5), CENTER), strike: false }
    }
    if (rear.cohesion > 0.72) {
      // Artçı henüz ulaşılamıyor: merkezi güvenli mesafeden taciz ederek bekle.
      return { move: navigate(v, post(b, CENTER, { x: 0, z: 1 }, 10.5), CENTER), strike: false }
    }
    const ci = frontCorpsToWork(b, -1)
    return { move: navigate(v, post(b, ci, { x: 0, z: 1 }, 10.5), ci), strike: false }
  }

  // Akşam: imparator korumasızsa ona, değilse en düzensiz birliğe.
  const emperor = v.enemies.find((e) => e.emperor && e.alive)
  if (b.emperorExposed && emperor) {
    const inArc = isInCrescent(emperor.pos, v.player, v.facing)
    const center = b.corps[CENTER].anchor
    // İmparatorun merkezden uzak tarafından yaklaş: yay onu ve safları birlikte alsın.
    let sx = emperor.pos.x - center.x
    let sz = emperor.pos.z - center.z
    const sl = Math.hypot(sx, sz) || 1
    sx /= sl
    sz /= sl
    const dest = { x: emperor.pos.x + sx * 7, z: emperor.pos.z + sz * 7 }
    return { move: navigate(v, dest, CENTER), strike: inArc }
  }
  const ci = duskTarget(b)
  if (ci < 0) return { move: { x: 0, z: 0 }, strike: v.inCrescent > 0 }
  // İmparator henüz korunuyorsa hilali harcama; yalnızca büyük fırsatı kullan.
  const dest = post(b, ci, { x: 0, z: -1 }, 9)
  return { move: navigate(v, dest, ci), strike: v.inCrescent >= 8 }
}

// ——— Kol emirleri ———

/** Savaşın durumuna göre iki kolun emri (sol, sağ). */
export type WingPolicy = (b: BattleState) => readonly WingOrder[]

const BOTH_AMBUSH: readonly WingOrder[] = ['ambush', 'ambush']
const BOTH_HARASS: readonly WingOrder[] = ['harass', 'harass']
const BOTH_CHARGE: readonly WingOrder[] = ['charge', 'charge']

/** Tarihteki gibi: kollar gündüz pusuda, gün batımında dönen orduya hücum. */
export const ambushWings: WingPolicy = (b) => (isDay(b) ? BOTH_AMBUSH : BOTH_CHARGE)
/** Kollar gündüz taciz eder, akşam hücum. */
export const harassWings: WingPolicy = (b) => (isDay(b) ? BOTH_HARASS : BOTH_CHARGE)
/** Sabırsız: kollar dinlenir dinlenmez hücuma. */
export const eagerWings: WingPolicy = () => BOTH_CHARGE

/** Bir botu kol emirleriyle birleştirir. */
export function withWings(makeBot: () => Bot, policy: WingPolicy): () => Bot {
  return () => {
    const bot = makeBot()
    return (v) => ({ ...bot(v), wings: policy(v.battle) })
  }
}

// ——— Geçit (Miryokefalon) ———

/** Kolun en öndeki birliği (yoksa −1). */
function leadCorps(b: BattleState): number {
  let best = -1
  b.corps.forEach((c, ci) => {
    if (c.alive === 0 || c.status === 'fleeing') return
    if (best < 0 || c.anchor.z > b.corps[best].anchor.z) best = ci
  })
  return best
}

/**
 * Kesici: yolu `blockZ`'de keser (null: hiç kesmez; kol oraya yetişmişse
 * başının hemen önünde, yani en erken kesilebilen yerde), sonra kolun başının
 * önünde taciz menzilinde durup öncüyü yıpratır, sıkışan kolu yayı dolunca
 * kuşatır. Manuel açığa çıkınca ona döner. Hamleden kaçar.
 */
export function blockerBot(blockZ: number | null, minStrike = 6): () => Bot {
  return () => (v) => {
    const b = v.battle
    if (nearestThreat(v)) return { move: flee(v), strike: false }

    const emperor = v.enemies.find((e) => e.emperor && e.alive)
    if (b.emperorExposed && emperor) {
      // Kuzeyinden yaklaş: yay güneye, Manuel'e baksın.
      const dest = { x: emperor.pos.x, z: emperor.pos.z + 7 }
      return { move: navigate(v, dest, CENTER), strike: isInCrescent(emperor.pos, v.player, v.facing) }
    }

    const lead = leadCorps(b)
    if (lead < 0) return { move: { x: 0, z: 0 }, strike: v.inCrescent > 0 }
    const headZ = b.corps[lead].anchor.z + 1.5

    if (blockZ !== null && !b.blockadeUsed) {
      // Kol oraya yetişmişse başın hemen önünde, hamle menzilinin dışında kes.
      // Bulunduğu yerde kesmek (ör. hamleden kaçtıktan sonra) ölçülen yeri bozar.
      const dest = { x: 0, z: Math.max(blockZ, headZ + BATTLE_CONFIG.chargeTrigger + 0.5) }
      const there = Math.hypot(v.player.x - dest.x, v.player.z - dest.z) < 0.8
      if (there) return { move: { x: 0, z: 0 }, strike: false, blockade: true }
      return { move: navigate(v, dest, lead), strike: false }
    }

    const dest = { x: 0, z: b.corps[lead].anchor.z + 9.5 }
    return { move: navigate(v, dest, lead), strike: v.inCrescent >= minStrike }
  }
}

/** Geçitte kollar: sıkışan birlik varken hücum (darbe onu sarsar), yoksa pusu. */
export const jamWings: WingPolicy = (b) =>
  b.corps.some((c) => c.alive > 0 && c.jam >= 0.5) ? BOTH_CHARGE : BOTH_AMBUSH

/** Ölçüm yardımcısı: bir botun tohum tohum sonuçları (her koşuya taze bot). */
export function sweep(
  makeBot: () => Bot,
  seeds: readonly number[],
  layout: BattleLayout = MALAZGIRT,
): BattleRun[] {
  return seeds.map((s) => runBattle(makeBot(), s, undefined, layout))
}

export { BATTLE_CONFIG }
