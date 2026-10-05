// Güneş gölgesinin çerçevesi: gölge haritası sahayı ışığın gözünden sarar.
//
// Eski çerçeve orijine sabit ±35'lik bir kareydi. Işıktan bakınca yatay saha
// basık bir elipstir; kare, güneş alçaldıkça dokuların çoğunu boşa harcıyordu.
// Çerçeve artık sahanın ışık uzayındaki kutusu: aynı harita öğlende biraz,
// gün batımında (uzun gölgeler) iki kat daha keskin. Kameraya bağlı dar
// çerçeve kullanılmıyor: telefon yatay oynanıyor ve taktik kadraj sahanın
// neredeyse tamamını görüyor (MIMARI).

import { Vector3 } from 'three'

/** Gölge alan her şey bu yarıçapta: arena (29), balballar, ordugâh. */
export const SHADOW_RADIUS = 36
/**
 * En uzun gölge düşürücünün boyu (imparator sancağı ~4,6). Işık yukarıdan
 * geldiği için bundan yüksek bir yüzeye gölge düşmez.
 */
export const CASTER_TOP = 5
/** Işık, çerçevenin ortasından bu kadar güneşe doğru durur. */
export const LIGHT_DISTANCE = 40
/** Gölge kamerasının uzak düzlemi: sahanın güneşten en uzak ucu da içeride. */
export const SHADOW_FAR = 80

export interface SunShadowFrame {
  /** Gölge kamerasının baktığı nokta (dünya). */
  center: Vector3
  halfWidth: number
  halfHeight: number
}

const UP = new Vector3(0, 1, 0)
const _x = new Vector3()
const _y = new Vector3()

/** `sunDir` güneşe doğru birim vektör. */
export function fitSunShadow(sunDir: Vector3, out: SunShadowFrame): SunShadowFrame {
  // three'nin gölge kamerasıyla aynı eksenler (Matrix4.lookAt): x = yukarı × güneş.
  _x.crossVectors(UP, sunDir).normalize()
  _y.crossVectors(sunDir, _x)
  // Saha yerden CASTER_TOP'a kadar bir silindir. x ekseni yatay: tam yarıçap.
  // y'de taban güneş alçaldıkça basıklaşır, tepesi yukarı kayar.
  const flat = Math.hypot(_y.x, _y.z) * SHADOW_RADIUS
  const lift = CASTER_TOP * _y.y
  out.center.copy(_y).multiplyScalar(lift / 2)
  out.halfWidth = SHADOW_RADIUS
  out.halfHeight = flat + Math.abs(lift) / 2
  return out
}
