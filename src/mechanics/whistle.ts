// Islıklı ok: Metehan'ın ikinci fiili (TASARIM.md §3, Eğlence 1).
//
// Shiji 110'a göre Mete adamlarını ıslıklı okla eğitti: ok nereye giderse
// herkes oraya atacaktı. Oyunda oyuncu yere bir nokta işaretler; ok ıslık
// çalarak oraya uçar ve bölük o noktaya ok yağdırır. Yağmurun altındaki
// düşman kalkan kaldırıp atını durdurur (pin) ve düzeni biraz sarsılır.
//
// Ok öldürmez. Hilalin işini yapmaz, ona yol açar: tek tuşluk savaşa
// "nereye" kararını ekler. Yalnız sarsan (pin'siz) ilk sürüm oyuncuya zarar
// veriyordu: bozulan düşman hızlanıp üstüne geliyordu (enemySim.ts chaseSpeed
// notu; uzman 3★ 13 → 5). Durdurmayla ok hem kaçış hem toplama aracı oldu.
//
// Yer seçimi önemli. 30 tohum, başlangıç basamağı, zafer sayısı:
//   ok yok:                       uzman 30, orta 8,  acemi 0
//   peşteki atlılara (chasers):   uzman 30, orta 17, acemi 2
//   düzenli hattın ortasına:      uzman 30, orta 8,  acemi 1
// Taranan değerler (orta, chasers): shock 0,7 pin 1,2 → 8; 0,3/1,5 → 11;
// 0,3/2 → 17; 0,3/2,5 → 20; 0,5/2 → 15. 2,5 orta oyuncuya fazla cömert.
//
// Bekleme sayacı yok (TASARIM §8): ok her hilal vuruşuyla yeniden hazır olur.
// Ritim böylece çekirdek döngüye bağlanır: ıslık → bozul → topla → kuşat.

import type { Enemy, Vec2 } from './types'

export const WHISTLE = {
  /** Okun hedefe uçuşu (sn). Yağmur bu kadar sonra iner. */
  flightTime: 0.6,
  /** Yağmurun yarıçapı. */
  radius: 5,
  /** Yağmurun altındaki düşmanın disiplininden düşen pay. */
  shock: 0.3,
  /** Yağmurun altındaki düşman bu kadar saniye kalkan altında yerinde kalır. */
  pin: 2,
  /** Okun en uzak menzili; daha uzağa işaret edilirse bu mesafeye çekilir. */
  maxRange: 24,
} as const

export interface WhistleState {
  /** Ok atılmaya hazır mı. */
  ready: boolean
  /** Havadaki okun inmesine kalan süre (sn); 0 = havada ok yok. */
  flight: number
  /** Havadaki okun ineceği nokta. */
  target: Vec2
}

export function createWhistle(): WhistleState {
  return { ready: true, flight: 0, target: { x: 0, z: 0 } }
}

/**
 * Oku atar. Hazır değilse ya da havada ok varsa hiçbir şey yapmaz.
 * @returns Ok atıldıysa ineceği nokta (menzile çekilmiş), yoksa null.
 */
export function fireWhistle(s: WhistleState, player: Vec2, aim: Vec2): Vec2 | null {
  if (!s.ready || s.flight > 0) return null
  const dx = aim.x - player.x
  const dz = aim.z - player.z
  const d = Math.hypot(dx, dz)
  const k = d > WHISTLE.maxRange ? WHISTLE.maxRange / d : 1
  s.target.x = player.x + dx * k
  s.target.z = player.z + dz * k
  s.ready = false
  s.flight = WHISTLE.flightTime
  return { x: s.target.x, z: s.target.z }
}

/**
 * Havadaki oku ilerletir. İndiği adımda yağmurun altındakilerin düzenini sarsar.
 * @returns İndiyse sarsılan düşman sayısı, inmediyse -1.
 */
export function stepWhistle(s: WhistleState, enemies: Enemy[], dt: number): number {
  if (s.flight <= 0) return -1
  s.flight = Math.max(0, s.flight - dt)
  if (s.flight > 0) return -1
  let hit = 0
  for (const e of enemies) {
    // Baideng'in komuta grubu kendi kuralıyla yürür; bozguna uğrayan zaten kaçıyor.
    if (!e.alive || e.routed || e.emperor || e.guard) continue
    if (Math.hypot(e.pos.x - s.target.x, e.pos.z - s.target.z) > WHISTLE.radius) continue
    e.discipline = Math.max(0, e.discipline - WHISTLE.shock)
    e.pinned = WHISTLE.pin
    hit++
  }
  return hit
}

/** Hilal vuruşundan sonra: bölük yeni bir ıslığa hazır. */
export function rechargeWhistle(s: WhistleState): void {
  s.ready = true
}
