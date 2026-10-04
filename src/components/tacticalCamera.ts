// Taktik kadraj (STIL.md §9): okunabilirlik için. Kamera dönmez, yalnız kayar;
// WASD dünya eksenlerine göre çalıştığı için dönen kamera kontrolü bozardı.

import { Vector3 } from 'three'
import type { Vec2 } from '../mechanics/types'

/**
 * Eğim (derece). 45°'de Malazgirt ve Miryokefalon'un R3 karesinde düşman
 * cephesi üst kenarda HUD'un altına düşüyordu (K2, art.spec kadraj). 38° ufka
 * biraz daha açılır; mesafe okumak için yeterince yukarıda kalır. 36° cepheyi
 * daha da açar ama gün batımında hilal yelpazesi kahramanın arkasına biner
 * (R5 |ΔL| 0,12).
 */
const PITCH = (38 * Math.PI) / 180
/** Bakış noktasına uzaklık; eski [0, 20, 20] duruşunun boyu. */
const DISTANCE = 28.3

/** Kameranın bakış noktasına göre duruşu: yukarıdan ve geriden. */
export const TACTICAL_OFFSET = new Vector3(0, Math.sin(PITCH) * DISTANCE, Math.cos(PITCH) * DISTANCE)

/**
 * Bakış noktası oyuncunun bu kadar önünde (−z, ekranın üstü). Üst kenarı HUD
 * tutuyor; oyuncu biraz aşağıda durunca karşısındaki ordu panellerden çıkar.
 */
export const LEAD = 3

/**
 * Bakış noktası yayın baktığı yöne de bu kadar kayar: hilalin menzilini
 * kestirmek için önündeki düşman biraz daha görünür. Yay 180° dönünce oyuncu
 * ekranda bunun iki katı kayar; eski 5 birim ekranın %25'ini savuruyordu (K1).
 */
export const FACING_BIAS = 1.5

/** Takip yumuşaklığı. Yüksek = kamera daha sıkı yapışır. */
const LERP_SPEED = 3.5

/**
 * Bakış noktası bir karede bu kadar sıçrarsa yumuşatma yapılmaz, ışınlanır.
 * Yeniden başlatmada oyuncu arenanın öbür ucuna döner; kamera oraya süzülerek
 * gitseydi oyun saniyelerce izlenir halde beklerdi.
 */
const SNAP_DISTANCE = 25

/** Oyuncunun ve yayın konumundan istenen bakış noktası. */
export function tacticalTarget(player: Vec2, facing: number, out: Vector3): Vector3 {
  // facing = atan2(dx, dz) düzeninde; birim vektörü (sin, cos).
  return out.set(
    player.x + Math.sin(facing) * FACING_BIAS,
    0,
    player.z + Math.cos(facing) * FACING_BIAS - LEAD,
  )
}

/**
 * Yumuşatılan bakış noktasını hedefe yaklaştırır. `snap` ya da büyük sıçrama
 * yumuşatmadan oturtur.
 */
export function followLook(look: Vector3, target: Vector3, dt: number, snap: boolean): void {
  if (snap || look.distanceTo(target) > SNAP_DISTANCE) look.copy(target)
  // Kare hızından bağımsız yumuşatma: 20 fps'te de 144'te de aynı his.
  else look.lerp(target, 1 - Math.exp(-LERP_SPEED * dt))
}
