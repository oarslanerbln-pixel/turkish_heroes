// II. Kılıçarslan — Miryokefalon 1176: Tzivritze geçidi.
//
// Bizans ordusu dar bir geçitte uzun bir kol halinde yürüdü; Selçuklular iki
// yamacı tuttu. Ağırlıklar yolu tıkadı, kol sıkıştı; galip sultan barış önerdi.
// Oyunun yeni ekseni NEREDE: Metehan'da nasıl kaçtığın, Malazgirt'te ne zaman
// vurduğun, burada kolu nerede durdurduğun belirler.
//
// Geçit z ekseni boyunca uzanır: ordu güneyden (−z) girer, kuzeyden (+z)
// çıkarsa Konya yolu açılır. Genişlik güneyde geniş, boğazda (neckZ) en dar,
// çıkışa doğru yeniden açılır. Sıkışma darda hızlı birikir: kolu boğazın
// hemen ötesinde durduran, arkasındaki orduyu boğazın içine yığar.
//
// Saf veri ve fonksiyonlar; arazi, birlikler, oyuncu ve botlar aynı sınırı kullanır.

import type { Vec2 } from './types'

/** Bilerek `as const` değil: ?tune paneli değiştirebilsin. */
export const PASS = {
  /** Geçidin güney ağzı (ordunun geldiği yer). */
  entryZ: -26,
  /** En dar nokta. */
  neckZ: 6,
  /** Ön hat buraya varırsa ordu geçidi aşmış sayılır (yenilgi). */
  exitZ: 22,
  /** Güneyde, boğazda ve çıkışta yarı genişlik. */
  wideHalf: 11,
  neckHalf: 4,
  exitHalf: 9,
  /**
   * Boğazın iki yanındaki huninin boyu. Kısa huni "nerede"yi seçim yapar:
   * genişte durdurulan kol yayılır, boğazda durdurulan üst üste biner.
   */
  southFunnel: 10,
  northFunnel: 8,
}

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** Geçidin z'deki yarı genişliği: boğazda neckHalf, iki yöne açılır. */
export function passHalfWidth(z: number): number {
  const { neckZ, wideHalf, neckHalf, exitHalf, southFunnel, northFunnel } = PASS
  const south = z < neckZ
  const span = south ? southFunnel : northFunnel
  const side = south ? wideHalf : exitHalf
  return neckHalf + (side - neckHalf) * smoothstep01(Math.abs(z - neckZ) / span)
}

/** 0 (geniş) – 1 (boğaz): o noktada sıkışmanın ne kadar hızlı biriktiği. */
export function narrowness(z: number): number {
  const w = passHalfWidth(z)
  return Math.min(1, Math.max(0, (PASS.wideHalf - w) / (PASS.wideHalf - PASS.neckHalf)))
}

/** Noktayı geçidin tabanına (duvarlardan `margin` içeride) çeker; yerinde değiştirir. */
export function confineToPass(p: Vec2, margin = 0.6): void {
  const half = Math.max(0.5, passHalfWidth(p.z) - margin)
  if (p.x > half) p.x = half
  else if (p.x < -half) p.x = -half
}
