// Selçuklu kolları: hilalin iki boynuzu.
//
// Malazgirt'te Alp Arslan ordusunu hilal biçiminde dizdi: merkez sahte ricatla
// Bizans ordusunu bozkıra çekti, kollar geride bekledi ve akşam dönen ordunun
// yanlarına kapandı. Oyuncu merkezin işini kendisi yapıyor (taciz, kışkırtma);
// iki kol ise emirle hareket ediyor:
//   - PUSU: ordugahın yanında bekler, dinlenir.
//   - TACİZ: karşısındaki birliği ok menzilinden yıpratır, ilerleyişini yavaşlatır.
//   - HÜCUM: birliğin yanına yüklenir — durdurur, sıkıştırır, dönüşünü uzatır.
// Kol yorulur: taciz yavaş, düzenli birliğe hücum hızlı tüketir; gücü biten kol
// pusuya döner. Asıl karar bu: kolları gündüz harcamak mı, akşama saklamak mı.
// Akşam dönen birliğe taze bir kolun hücumu düzenini bir anda sarsar (arkadan
// vurulan ordu) — pusunun karşılığı.
//
// Kolun birliklerle ilişkisi (hedef seçimi, etkinin birliğe işlenmesi)
// corps.ts'te; burada yalnızca kolun kendi durumu var.

import { ENEMY_CONFIG } from './enemySim'
import type { Vec2 } from './types'

/** Bilerek `as const` değil: canlı ayar paneli (?tune) değiştirebilsin. */
export const WING_CONFIG = {
  /** Kol başına süvari — yalnızca görsel. */
  riders: 8,
  /** Kolun hızı (birim/sn); oyuncu 6. */
  speed: 5,
  /** Pusu yeri: ordugahın yanı (x kolun tarafıyla çarpılır). */
  homeX: 19,
  homeZ: 15,
  /** Taciz yeri: hedef birliğin merkezinden yana uzaklık (ok menzili). */
  harassOffset: 10,
  /** Hücum yeri: birliğin dış yanı. */
  chargeOffset: 6.5,
  /** Yerine bu kadar yakın kol tam etkili; arriveFar'da etkisiz. */
  arriveNear: 1.5,
  arriveFar: 6,
  /** Tacizin şiddeti, oyuncunun tam tacizine göre (güçle ölçeklenir). */
  harass: 0.5,
  /** Hücumdaki birlik dönüşünü bu oranda yavaş tamamlar (tam güçte). */
  turnSlow: 0.5,
  /** Hücumdaki birliğin düzen yuvaları bu oranda sıkışır. */
  squeeze: 0.25,
  /** Akşam dönen birliğe hücumun ilk darbesi: düzenden düşen (tam güçte). */
  shock: 0.3,
  /** Tacizde saniyelik yorulma. */
  harassFatigue: 0.012,
  /** Hücumda saniyelik yorulma × (0,25 + hedefin disiplini). */
  chargeFatigue: 0.05,
  /** Pusu yerinde saniyelik dinlenme. */
  recovery: 0.02,
  /** Gücü bunun altına inen kol pusuya döner. */
  minStrength: 0.15,
  /** Pusudan çıkmak için gereken güç. */
  readyStrength: 0.3,
}

export type WingOrder = 'ambush' | 'harass' | 'charge'

/** Düğmeye her basışta sıradaki emir. */
const ORDER_CYCLE: readonly WingOrder[] = ['ambush', 'harass', 'charge']

export function nextOrder(order: WingOrder): WingOrder {
  return ORDER_CYCLE[(ORDER_CYCLE.indexOf(order) + 1) % ORDER_CYCLE.length]
}

export interface WingState {
  /** −1 sol kol, +1 sağ kol (ekranda da solda / sağda). */
  side: -1 | 1
  order: WingOrder
  pos: Vec2
  /** 0–1. Atların gücü; kolun etkisi bununla ölçeklenir. */
  strength: number
  /** Hedef birlik (CORPS indeksi); pusuda ya da hedef kalmadıysa −1. */
  target: number
  /** 0–1. Emrin yerine varma ölçüsü: etki yaklaştıkça açılır. */
  presence: number
  /** Bu hücumun ilk darbesi vuruldu mu — emir değişince sıfırlanır. */
  shocked: boolean
}

export function createWings(): WingState[] {
  return ([-1, 1] as const).map((side) => ({
    side,
    order: 'ambush' as WingOrder,
    pos: { x: side * WING_CONFIG.homeX, z: WING_CONFIG.homeZ },
    strength: 1,
    target: -1,
    presence: 0,
    shocked: false,
  }))
}

/**
 * Emir verir. Dinlenen kol (güç < readyStrength) pusudan çıkmaz.
 * @returns emir kabul edildi mi
 */
export function orderWing(w: WingState, order: WingOrder): boolean {
  if (order === w.order) return true
  if (w.order === 'ambush' && w.strength < WING_CONFIG.readyStrength) return false
  w.order = order
  w.shocked = false
  return true
}

/**
 * Kolu yerine doğru sürer ve varma ölçüsünü günceller.
 * @param anchor Hedef birliğin merkezi; pusuda ya da hedef yoksa null.
 */
export function moveWing(w: WingState, anchor: Vec2 | null, dt: number): void {
  const cfg = WING_CONFIG
  let px = w.side * cfg.homeX
  let pz = cfg.homeZ
  if (w.order !== 'ambush' && anchor) {
    px = anchor.x + w.side * (w.order === 'harass' ? cfg.harassOffset : cfg.chargeOffset)
    pz = anchor.z
    // Hedef arena kenarındaysa yer sınırın içinde kalsın.
    const r = Math.hypot(px, pz)
    const max = ENEMY_CONFIG.arenaRadius - 2
    if (r > max) {
      px *= max / r
      pz *= max / r
    }
  }
  const dx = px - w.pos.x
  const dz = pz - w.pos.z
  const d = Math.hypot(dx, dz)
  const step = Math.min(d, cfg.speed * dt)
  if (d > 1e-6) {
    w.pos.x += (dx / d) * step
    w.pos.z += (dz / d) * step
  }
  const left = d - step
  w.presence =
    w.order === 'ambush' || !anchor
      ? 0
      : Math.min(1, Math.max(0, (cfg.arriveFar - left) / (cfg.arriveFar - cfg.arriveNear)))
}

/** Pusu yerine varmış mı (dinlenme yalnızca orada). */
export function isResting(w: WingState): boolean {
  if (w.order !== 'ambush') return false
  const home = w.side * WING_CONFIG.homeX
  return Math.hypot(w.pos.x - home, w.pos.z - WING_CONFIG.homeZ) < WING_CONFIG.arriveNear
}

/**
 * Yorulma ve dinlenme.
 * @param discipline Hedef birliğin anlık disiplini (hücumun maliyeti).
 * @returns true: kol yoruldu ve pusuya döndü.
 */
export function stepStrength(w: WingState, discipline: number, dt: number): boolean {
  const cfg = WING_CONFIG
  if (w.order === 'ambush') {
    if (isResting(w)) w.strength = Math.min(1, w.strength + cfg.recovery * dt)
    return false
  }
  const drain =
    w.order === 'harass' ? cfg.harassFatigue : cfg.chargeFatigue * (0.25 + discipline)
  w.strength = Math.max(0, w.strength - drain * w.presence * dt)
  if (w.strength > cfg.minStrength) return false
  w.order = 'ambush'
  w.shocked = false
  return true
}

/** Kolun hedef birliğe tacizi (0–1); oyuncunun tacizine eklenir. */
export function wingHarass(w: WingState): number {
  if (w.order === 'harass') return WING_CONFIG.harass * w.presence * w.strength
  if (w.order === 'charge') return w.presence * w.strength
  return 0
}

/** Hücumdaki kolun birliği tutma şiddeti (0–1). */
export function wingPin(w: WingState): number {
  return w.order === 'charge' ? w.presence * w.strength : 0
}
