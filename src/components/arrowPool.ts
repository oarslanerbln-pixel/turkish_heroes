import type { Vector3 } from 'three'

// Taciz oklarının havuzu. Ok yağmuru doldurur ve çizer; ok kamerası gibi
// okuyucular bir oku arrowReleased olayındaki yuvasından izler.

export const ARROW_POOL = 64
/** Okun havada kalma süresi (sim sn) ve yayın tepe yüksekliği. */
export const ARROW_FLIGHT = 0.75
const ARC = 3.2

export interface Arrow {
  age: number
  sx: number
  /** Atışın yapıldığı zemin yüksekliği: geçitte kollar yamaçta. */
  sy: number
  sz: number
  tx: number
  tz: number
  /** Bırakıldığı an (world.animTime); yuva yeniden kullanılınca değişir. */
  t0: number
}

export const arrows: Arrow[] = Array.from({ length: ARROW_POOL }, () => ({
  age: ARROW_FLIGHT,
  sx: 0,
  sy: 0,
  sz: 0,
  tx: 0,
  tz: 0,
  t0: 0,
}))

/** Okun havadaki konumu ve hız vektörü (uçuş yönü; birim değil). */
export function arrowPose(a: Arrow, pos: Vector3, vel: Vector3): void {
  const t = Math.min(1, a.age / ARROW_FLIGHT)
  // Atış zemininden hedef zeminine (0) iner.
  pos.set(
    a.sx + (a.tx - a.sx) * t,
    a.sy * (1 - t) + 1.6 + 4 * ARC * t * (1 - t) - 1.2 * t,
    a.sz + (a.tz - a.sz) * t,
  )
  // Yay teğeti: ok uçuş yönüne baksın, tepede yatay, sonda aşağı.
  vel.set(
    (a.tx - a.sx) / ARROW_FLIGHT,
    (-a.sy + 4 * ARC * (1 - 2 * t) - 1.2) / ARROW_FLIGHT,
    (a.tz - a.sz) / ARROW_FLIGHT,
  )
}
