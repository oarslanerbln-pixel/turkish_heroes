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
  /**
   * Yere saplandıktan sonra çizilmeye devam ettiği süre (sim sn). Yalnız ok
   * kamerasının izlediği ok saplı kalır: kamera ona bakarken kaybolmasın.
   */
  stick: number
}

export const arrows: Arrow[] = Array.from({ length: ARROW_POOL }, () => ({
  age: ARROW_FLIGHT,
  sx: 0,
  sy: 0,
  sz: 0,
  tx: 0,
  tz: 0,
  t0: 0,
  stick: 0,
}))

/** Ok havada ya da saplı, yani çiziliyor mu. */
export function arrowVisible(a: Arrow): boolean {
  return a.age < ARROW_FLIGHT + a.stick
}

/**
 * Okun havadaki konumu ve hız vektörü (uçuş yönü; birim değil). `flight`
 * uçuş süresi; yaşı eksi ok (henüz yayda) kalkış yerinde durur.
 */
export function arrowPose(a: Arrow, pos: Vector3, vel: Vector3, flight = ARROW_FLIGHT): void {
  const t = Math.min(1, Math.max(0, a.age / flight))
  // Atış zemininden hedef zeminine (0) iner.
  pos.set(
    a.sx + (a.tx - a.sx) * t,
    a.sy * (1 - t) + 1.6 + 4 * ARC * t * (1 - t) - 1.2 * t,
    a.sz + (a.tz - a.sz) * t,
  )
  // Yay teğeti: ok uçuş yönüne baksın, tepede yatay, sonda aşağı.
  vel.set((a.tx - a.sx) / flight, (-a.sy + 4 * ARC * (1 - 2 * t) - 1.2) / flight, (a.tz - a.sz) / flight)
}
