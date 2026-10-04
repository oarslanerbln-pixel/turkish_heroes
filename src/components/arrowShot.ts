// Ok kamerası: önemli bir atışta kamera oka atılır, uçarken etrafında döner,
// ok saplanınca vuruş yerinde ağır çekimde bekler, sonra taktik kadraja döner.
//
// Önemli atış senaryonun işi (world.arrowCue: savaşın ilk tacizi, imparatorun
// açığa çıkışı). Ok taciz okudur; havuzdaki yuvasından izlenir (arrowPool).
// Çekim boyunca dünya ağır çekimde: kamera oyuncudan ayrılırken oyun
// oyuncunun elinden kaçmasın. Zaman gerçek saniye; ok sim zamanıyla uçar.

import { Vector3 } from 'three'
import type { WorldEvent } from '../sim/events'
import { ARROW_FLIGHT, arrowPose, type Arrow } from './arrowPool'
import { smoothstep, type Pose } from './cameraShots'
import { terrainHeight } from './world/terrainShape'

/** Taktikten oka iniş (gerçek sn); ok bu sırada uçmayı sürdürür. */
export const ARROW_RISE = 0.6
/** Ok saplandıktan sonra kameranın vuruş yerinde bekleyişi (gerçek sn). */
export const ARROW_HOLD = 0.7
/** Taktik kadraja dönüş (gerçek sn). */
export const ARROW_FALL = 1.1
/** Ok bir sebeple kaybolursa çekim en geç bu anda dönüşe geçer (gerçek sn). */
export const ARROW_MAX = 4
/**
 * Çekim sürerken ağır çekimin her kare tazelenen kalan süresi (gerçek sn).
 * Dönüş başlayınca tazelenmez: zaman kamera geri gelirken hızlanır.
 */
export const ARROW_SLOWMO = 0.2

/**
 * Kameranın oka uzaklığı ve okun üstündeki yüksekliği: kalkışta yakın ve
 * alçak, saplanırken geri ve yukarı. Vuruş yeri saflığın içinde; alçakta
 * kalan kamera atlıların gövdesine gömülüyordu.
 */
const RADIUS_FROM = 3.2
const RADIUS_TO = 6.5
const HEIGHT_FROM = 0.9
const HEIGHT_TO = 4.5
/**
 * Kameranın okun çevresindeki açısı (0 = tam arkası). Arkadan başlar, yana
 * döner; öne geçmez, önü düşman saflığı.
 */
const ORBIT_FROM = (10 * Math.PI) / 180
const ORBIT_TO = (90 * Math.PI) / 180
/** Uçarken bakış okun bu kadar önünde: okun nereye gittiği görünsün. */
const LOOK_AHEAD = 1.4
/** Kamera zeminin en az bu kadar üstünde (geçitte duvar, tepeler). */
const GROUND_CLEARANCE = 0.5

export interface ArrowShot {
  /** İzlenen okun havuz yuvası; -1 = çekim yok. */
  slot: number
  /** Okun bırakılış anı: yuva yeniden kullanılırsa ok kaybolmuş sayılır. */
  t0: number
  /** Okun saplandığı çekim anı (gerçek sn); null = havada. */
  landedAt: number | null
  /** Kameranın döndüğü yan (±1). */
  side: number
}

export function createArrowShot(): ArrowShot {
  return { slot: -1, t0: 0, landedAt: null, side: 1 }
}

type Release = Extract<WorldEvent, { type: 'arrowReleased' }>

/** Bu karede oyuncunun bıraktığı, isteğe uyan ilk ok (corps null: herhangi biri). */
export function findRelease(events: readonly WorldEvent[], corps: number | null): Release | undefined {
  for (const e of events) {
    if (e.type === 'arrowReleased' && e.byPlayer && (corps === null || e.corps === corps)) return e
  }
  return undefined
}

/** Oku izlemeye başlar; ok saplanınca kamera ona bakarken kaybolmasın diye saplı kalır. */
export function beginArrow(s: ArrowShot, release: Release, arrow: Arrow): void {
  s.slot = release.slot
  s.t0 = release.t0
  s.landedAt = null
  // Kamera taktik duruşun bulunduğu yana (+z, ekranın altı) dönsün: iniş
  // kısa olur. Yan vektörün z'si fx·side; fx ile aynı işaret onu ≥ 0 tutar.
  s.side = release.target.x >= release.origin.x ? 1 : -1
  arrow.stick = Infinity
}

/** Çekim bitti ya da kesildi: ok saplı kalmasın. */
export function endArrow(s: ArrowShot, arrows: Arrow[]): void {
  if (s.slot < 0) return
  const a = arrows[s.slot]
  if (a.t0 === s.t0) a.stick = 0
  s.slot = -1
}

/** İzlenen ok hâlâ bu yuvada mı. */
export function arrowTracked(s: ArrowShot, arrow: Arrow): boolean {
  return s.slot >= 0 && arrow.t0 === s.t0
}

/** Okun saplandığı anı kaydeder; ok kaybolduysa ya da süre dolduysa o an sayılır. */
export function trackArrow(s: ArrowShot, arrow: Arrow, t: number): void {
  if (s.landedAt !== null) return
  if (!arrowTracked(s, arrow) || arrow.age >= ARROW_FLIGHT || t >= ARROW_MAX) s.landedAt = t
}

/** Sinematik duruşun ağırlığı: inişte yükselir, havada ve bekleyişte 1, dönüşte söner. */
export function arrowWeight(s: ArrowShot, t: number): number {
  const fall = s.landedAt === null ? 0 : smoothstep((t - s.landedAt - ARROW_HOLD) / ARROW_FALL)
  return smoothstep(t / ARROW_RISE) * (1 - fall)
}

/** Dönüş başlamadı: ağır çekim sürsün. */
export function arrowHolding(s: ArrowShot, t: number): boolean {
  return s.landedAt === null || t < s.landedAt + ARROW_HOLD
}

export function arrowDone(s: ArrowShot, t: number): boolean {
  return s.landedAt !== null && t >= s.landedAt + ARROW_HOLD + ARROW_FALL
}

const pos = new Vector3()
const vel = new Vector3()

/**
 * Okun çevresindeki kamera duruşu. Uçuş ilerledikçe kamera arkadan yana
 * döner; ok saplanınca (yay sonu) duruş sabitlenir ve vuruş yerine bakar.
 */
export function arrowChasePose(arrow: Arrow, side: number, pass: boolean, out: Pose): Pose {
  arrowPose(arrow, pos, vel)
  const p = smoothstep(arrow.age / ARROW_FLIGHT)
  const len = Math.hypot(arrow.tx - arrow.sx, arrow.tz - arrow.sz) || 1
  const fx = (arrow.tx - arrow.sx) / len
  const fz = (arrow.tz - arrow.sz) / len
  const angle = ORBIT_FROM + (ORBIT_TO - ORBIT_FROM) * p
  const radius = RADIUS_FROM + (RADIUS_TO - RADIUS_FROM) * p
  const back = Math.cos(angle) * radius
  const across = Math.sin(angle) * radius * side
  // Yan vektörü (−fz, fx): uçuş yönünün solu.
  out.pos.set(
    pos.x - fx * back - fz * across,
    pos.y + HEIGHT_FROM + (HEIGHT_TO - HEIGHT_FROM) * p,
    pos.z - fz * back + fx * across,
  )
  out.pos.y = Math.max(out.pos.y, terrainHeight(out.pos.x, out.pos.z, pass) + GROUND_CLEARANCE)
  const ahead = LOOK_AHEAD * (1 - p)
  vel.normalize()
  out.look.set(pos.x + vel.x * ahead, pos.y + vel.y * ahead, pos.z + vel.z * ahead)
  return out
}
