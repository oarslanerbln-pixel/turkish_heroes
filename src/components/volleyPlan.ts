// Hilal yaylımı (Metehan): VUR'a basılınca Mete'nin atlı okçuları düşmanın
// ardında yay olur ve yaydakileri okla düşürür. Kural simülasyonda anında
// işler (executeStrike): düşenler o an ölü, puan yazılmış. Burası yalnız
// görüntü: düşenin devrilişi okunun saplandığı ana ertelenir, ok da düşenin
// o anki yerine iner. Zaman sim zamanı: hitstop'ta durur, ağır çekimde yavaşlar.
//
// Önemli yaylımda (savaşın ilk vuruşu, dalgayı bitiren vuruş) kamera okçunun
// omzuna iner ve oku saplandığı yere dek izler (CameraDirector, 'volley').

import { CRESCENT } from '../mechanics/hilalSystem'
import { ENEMY_CAPACITY } from '../mechanics/scenario'
import type { Enemy } from '../mechanics/types'
import type { WorldEvent } from '../sim/events'
import type { Arrow } from './arrowPool'
import { smoothstep } from './cameraShots'

type Strike = Extract<WorldEvent, { type: 'strike' }>

/** Okçular yaya varır ve okları bırakır (sim sn, vuruştan). */
export const VOLLEY_RELEASE = 0.2
/** Okun uçuşu (sim sn): taciz okundan kısa, düşüş vuruştan çok gecikmesin. */
export const VOLLEY_FLIGHT = 0.5
/** Ok saplandıktan sonra okçular döner ve geri çekilir. */
const VOLLEY_TURN_AT = VOLLEY_RELEASE + VOLLEY_FLIGHT + 0.1
const VOLLEY_TURN = 0.35
/** Okçular bu anda sahneden silinmiş olur; yaylımın görüntüsü biter. */
export const VOLLEY_END = 1.6
/** Belirme ve silinme süresi (sim sn). */
const FADE_IN = 0.12
const FADE_OUT = 0.35
/** Geri çekilen okçunun hızı (birim/sn). */
const LEAVE_SPEED = 9
/** Saplanan ok bu kadar çizilir (sim sn). */
const STICK = 0.6
/** Okçu yayı hilalin dış ucunun ardında: düşmanın arkasından vurur. */
export const LINE_RADIUS = CRESCENT.outerRadius + 3
/** Okçular bu kadar geriden dörtnala gelir. */
const APPROACH = 2
/** Yayın yarı açısı: hilalin kendisinden geniş, uçları oyuncuya kıvrılır. */
const SPREAD = CRESCENT.halfAngle + 0.2
/** Okçu başına en az ok: yaydaki düşen az olsa da yaylım yaylım gibi görünsün. */
const PER_ARCHER = 2
/** Iskaların düşenin çevresine saçılması (birim). */
const SCATTER = 1.8
/** Aynı okçunun okları yan yana kalkar (birim). */
const BOW_SPREAD = 0.6
/** Düşen, oku gelene dek yavaşlayarak koşar (1/sn): ok onu nerede bulacaksa oraya iner. */
const FALTER = 2.5
/** Bırakıştaki dağınıklık (sim sn): yaylım tek bir tık değil, kısa bir dalga. */
const RELEASE_JITTER = 0.05
/** Yaylımın son oku bu anda saplanmış olur (sim sn, vuruştan). */
export const VOLLEY_LAST_LAND = VOLLEY_RELEASE + RELEASE_JITTER + VOLLEY_FLIGHT
/**
 * Yaylımda düşenin devriliş ve gömülüşü (sim sn; sürü, EnemySwarm). Normal
 * düşüşten kısa: dalgayı bitiren yaylımda ceset, yeni dalga doğmadan (dalga
 * molası) gömülmüş olsun.
 */
export const VOLLEY_DEATH_TIME = 0.65
export const VOLLEY_ARROWS = 64
export const MAX_ARCHERS = 16

export interface VolleyShot {
  arrow: Arrow
  /** Okun kalkışı (sim sn, vuruştan). Ok yaşı bundan önce eksidir. */
  release: number
  /** Hedefin world.enemies dizini; -1 = ıska, toprağa saplanır. */
  enemy: number
  landed: boolean
}

export interface Volley {
  active: boolean
  /** Vuruştan beri geçen sim süresi. */
  t: number
  originX: number
  originZ: number
  facing: number
  archers: number
  /** Okçuların yaydaki açısı (atan2(dx, dz) düzeninde). */
  angles: Float32Array
  shots: VolleyShot[]
  shotCount: number
  /** Kameranın izlediği atış: yayın ortasına en yakın düşenin oku. */
  hero: number
  /** Düşenin atışı (world.enemies dizinine göre), yoksa -1. */
  shotOf: Int16Array
  /** Eşlemenin ait olduğu dizi: dalga değişince geçersiz. */
  enemies: readonly Enemy[] | null
  /** Düşenin vuruş anındaki yeri ve hızı. */
  fromX: Float32Array
  fromZ: Float32Array
  velX: Float32Array
  velZ: Float32Array
  /** Kamera çekimi isteği; yönetmen tüketir. */
  cue: boolean
  /** Bu savaşta yapılan yaylım (önemli yaylım seçimi için). */
  count: number
  serial: number
}

export function createVolley(capacity: number): Volley {
  return {
    active: false,
    t: 0,
    originX: 0,
    originZ: 0,
    facing: 0,
    archers: 0,
    angles: new Float32Array(MAX_ARCHERS),
    shots: Array.from({ length: VOLLEY_ARROWS }, () => ({
      arrow: { age: 0, sx: 0, sy: 0, sz: 0, tx: 0, tz: 0, t0: 0, stick: STICK },
      release: 0,
      enemy: -1,
      landed: true,
    })),
    shotCount: 0,
    hero: -1,
    shotOf: new Int16Array(capacity).fill(-1),
    enemies: null,
    fromX: new Float32Array(capacity),
    fromZ: new Float32Array(capacity),
    velX: new Float32Array(capacity),
    velZ: new Float32Array(capacity),
    cue: false,
    count: 0,
    serial: 0,
  }
}

/** Paylaşılan yaylım: çizer (HilalVolley), sürü (düşenin devrilişi) ve kamera okur. */
export const volley = createVolley(ENEMY_CAPACITY)

/** Yeni savaş: süren yaylım ve sayaç sıfırlanır. */
export function resetVolley(v: Volley): void {
  v.active = false
  v.cue = false
  v.count = 0
  v.enemies = null
  v.shotCount = 0
  v.hero = -1
}

function normalizeAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/** Düşenin vuruştan `t` sn sonra aldığı yol / hızı: yavaşlayarak durur. */
function drift(t: number): number {
  return (1 - Math.exp(-FALTER * t)) / FALTER
}

/**
 * Vuruşun yaylımını kurar. Okçular yay üzerinde eşit aralıklı; her düşene
 * açıca en yakın okçudan bir ok, kalan oklar düşenlerin çevresine ıska.
 * Düşen yoksa yaylım kurulmaz.
 */
export function planVolley(
  v: Volley,
  strike: Strike,
  enemies: readonly Enemy[],
  archers: number,
  random: () => number = Math.random,
): boolean {
  if (strike.victims.length === 0) return false
  const n = Math.max(2, Math.min(MAX_ARCHERS, archers))
  v.active = true
  v.t = 0
  v.originX = strike.origin.x
  v.originZ = strike.origin.z
  v.facing = strike.facing
  v.archers = n
  for (let k = 0; k < n; k++) v.angles[k] = strike.facing + SPREAD * ((2 * k) / (n - 1) - 1)
  v.shotOf.fill(-1)
  v.enemies = enemies
  v.shotCount = 0
  v.hero = -1

  let heroOff = Infinity
  for (const victim of strike.victims) {
    if (v.shotCount >= VOLLEY_ARROWS) break
    const i = enemies.findIndex((e) => e.id === victim.id)
    if (i < 0 || i >= v.shotOf.length) continue
    const e = enemies[i]
    v.fromX[i] = victim.x
    v.fromZ[i] = victim.z
    v.velX[i] = e.vel.x
    v.velZ[i] = e.vel.z
    const off = normalizeAngle(Math.atan2(victim.x - v.originX, victim.z - v.originZ) - v.facing)
    const k = Math.round(((Math.max(-SPREAD, Math.min(SPREAD, off)) / SPREAD + 1) * (n - 1)) / 2)
    const s = v.shotCount++
    v.shotOf[i] = s
    // Kameranın oku tam zamanında kalkar; ötekiler kısa bir dalga hâlinde.
    const isHero = Math.abs(off) < heroOff
    if (isHero) {
      heroOff = Math.abs(off)
      v.hero = s
    }
    const release = VOLLEY_RELEASE + random() * RELEASE_JITTER
    const land = drift(release + VOLLEY_FLIGHT)
    aim(v, s, k, release, i, victim.x + v.velX[i] * land, victim.z + v.velZ[i] * land, random)
  }
  if (v.hero < 0) {
    v.active = false
    return false
  }
  v.count++
  // Kameranın oku: gecikmesiz, okçunun tam ortasından.
  const hero = v.shots[v.hero]
  hero.release = VOLLEY_RELEASE
  hero.arrow.age = -VOLLEY_RELEASE
  const hi = hero.enemy
  const heroLand = drift(VOLLEY_RELEASE + VOLLEY_FLIGHT)
  hero.arrow.tx = v.fromX[hi] + v.velX[hi] * heroLand
  hero.arrow.tz = v.fromZ[hi] + v.velZ[hi] * heroLand

  const victims = v.shotCount
  const total = Math.min(VOLLEY_ARROWS, Math.max(victims, n * PER_ARCHER))
  while (v.shotCount < total) {
    const s = v.shotCount++
    const target = v.shots[Math.floor(random() * victims)].arrow
    const a = random() * Math.PI * 2
    const r = Math.sqrt(random()) * SCATTER
    aim(v, s, s % n, VOLLEY_RELEASE + random() * RELEASE_JITTER, -1, target.tx + Math.cos(a) * r, target.tz + Math.sin(a) * r, random)
  }
  return true
}

function aim(
  v: Volley,
  s: number,
  archer: number,
  release: number,
  enemy: number,
  tx: number,
  tz: number,
  random: () => number,
): void {
  const shot = v.shots[s]
  const angle = v.angles[archer]
  const side = (random() - 0.5) * BOW_SPREAD
  shot.release = release
  shot.enemy = enemy
  shot.landed = false
  const a = shot.arrow
  a.age = -release
  a.sx = v.originX + Math.sin(angle) * LINE_RADIUS + Math.cos(angle) * side
  a.sy = 0
  a.sz = v.originZ + Math.cos(angle) * LINE_RADIUS - Math.sin(angle) * side
  a.tx = tx
  a.tz = tz
  a.t0 = ++v.serial
  a.stick = STICK
}

/** Yaylımı ilerletir; saplanan her ok için `onLand` (bu karede). */
export function stepVolley(v: Volley, dt: number, onLand: (shot: VolleyShot) => void): void {
  if (!v.active) return
  v.t += dt
  for (let s = 0; s < v.shotCount; s++) {
    const shot = v.shots[s]
    shot.arrow.age += dt
    if (!shot.landed && shot.arrow.age >= VOLLEY_FLIGHT) {
      shot.landed = true
      onLand(shot)
    }
  }
  if (v.t >= VOLLEY_END) v.active = false
}

/** Ok havada ya da saplı, yani çiziliyor mu. */
export function volleyArrowVisible(v: Volley, shot: VolleyShot): boolean {
  return v.active && shot.arrow.age >= 0 && shot.arrow.age < VOLLEY_FLIGHT + shot.arrow.stick
}

export interface ArcherPose {
  x: number
  z: number
  /** Atlının baktığı yön (rotation.y; geometri +z'ye bakar). */
  heading: number
  /** Dörtnal şiddeti 0–1. */
  gait: number
  /** Bırakışın geri tepmesi 0–1 (gövde geriye yaslanır). */
  recoil: number
}

/**
 * k. okçunun duruşu. Dörtnala gelir, bırakışta durur, oklar saplanınca
 * dışa döner ve geri çekilir. Görünürlük `volleyFade`'de.
 */
export function archerPose(v: Volley, k: number, out: ArcherPose): ArcherPose {
  const angle = v.angles[k]
  const t = v.t
  let r = LINE_RADIUS + APPROACH * (1 - smoothstep(t / VOLLEY_RELEASE))
  let heading = angle + Math.PI
  let gait = t < VOLLEY_RELEASE ? 1 : 0.25
  if (t >= VOLLEY_TURN_AT) {
    const turn = smoothstep((t - VOLLEY_TURN_AT) / VOLLEY_TURN)
    // Yayın iki kanadı iki yana döner: ortadan dışa açılan hilal.
    const side = k < (v.archers - 1) / 2 ? -1 : 1
    heading += side * Math.PI * turn
    r += Math.max(0, t - VOLLEY_TURN_AT - VOLLEY_TURN * 0.5) * LEAVE_SPEED
    gait = 1
  }
  out.x = v.originX + Math.sin(angle) * r
  out.z = v.originZ + Math.cos(angle) * r
  out.heading = heading
  out.gait = gait
  const since = t - VOLLEY_RELEASE
  out.recoil = since >= 0 && since < 0.25 ? Math.sin((since / 0.25) * Math.PI) : 0
  return out
}

/** Okçuların görünürlüğü 0–1: belirir, sonra silinir. */
export function volleyFade(v: Volley): number {
  if (!v.active) return 0
  return Math.min(1, v.t / FADE_IN, (VOLLEY_END - v.t) / FADE_OUT)
}

/** Düşenin okla devrilişi: 'none' = yaylımda değil, normal düşüş. */
export type FallState = 'none' | 'pending' | 'landed'

/**
 * Düşenin yaylımdaki durumu ve çizileceği yer (`out`). Oku havadayken koşar
 * (yavaşlayarak), saplanınca orada devrilir. Eşleme dalga değişene ya da
 * yeni yaylıma dek geçerli: devriliş yaylımın görüntüsünden uzun sürer.
 */
export function fallState(
  v: Volley,
  enemies: readonly Enemy[],
  i: number,
  out: { x: number; z: number },
): FallState {
  if (v.enemies !== enemies || i >= v.shotOf.length) return 'none'
  const s = v.shotOf[i]
  if (s < 0) return 'none'
  const shot = v.shots[s]
  const land = shot.release + VOLLEY_FLIGHT
  const d = drift(Math.min(v.t, land))
  out.x = v.fromX[i] + v.velX[i] * d
  out.z = v.fromZ[i] + v.velZ[i] * d
  return shot.landed ? 'landed' : 'pending'
}

/** Vuruşu yaylım mı taşır: Metehan'da evet; meydan savaşlarında yay kendisi kapanır. */
export function strikeByVolley(w: { battle: unknown }): boolean {
  return w.battle === null
}

/**
 * Kamera yalnız önemli yaylımda iner: savaşın ilk vuruşunda (ordu ilk kez
 * görünür) ve dalgayı bitiren vuruşta. Her vuruşta inseydi ~15 sn'de bir
 * 4 sn'lik çekim oyunu bölerdi.
 */
export function isKeyVolley(count: number, enemies: readonly Enemy[]): boolean {
  return count === 1 || enemies.every((e) => !e.alive || e.routed)
}
