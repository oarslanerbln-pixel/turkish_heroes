// Hilal (Kuşatma) Taktiği — çekirdek oyun mantığı.
//
// Tarihsel mantık: sahte çekilme düşmanı takibe zorlar, takip formasyonu bozar,
// bozulan formasyon kümelenmeye yol açar. Kuşatılabilirlik bu iki koşulun
// çarpımıdır — sıkışık AMA düzeni bozulmuş bir küme. Disiplinini koruyan birlik
// ne kadar sıkışık olursa olsun kuşatılamaz; oyuncuyu sahte çekilmeye zorlayan
// kural budur.

import type { Enemy, HilalPhase, Vec2 } from './types'

export const HILAL_CONFIG = {
  /**
   * Saniyede dolacak enerji (kuşatılabilirlik 1.0'da).
   * Zorluğun ana ayarı: kuşatmayı kapatmakla düşmanın sana yetişmesi arasındaki
   * yarışı bu belirliyor. Headless simülasyonda kusursuz kiting yapan bot
   * 20'de %97 canla (fazla kolay), 15'te %21 canla (insan için imkânsız),
   * 17'de %65 canla kazanıyor — insan hatasına pay bırakan değer bu.
   */
  energyFillRate: 17,
  strikeThreshold: 100, // vuruş için gereken minimum enerji
  retreatSpeed: 6, // çekilme fazında karakter hızı
  gatherRadius: 12, // düşmanların gruplaşma yarıçapı (birim)

  /** Bu kuşatılabilirliğin altında enerji birikmez, sızar. */
  vulnerabilityFloor: 0.2,
  /** 'gather' fazına geçiş için gereken kuşatılabilirlik. */
  gatherThreshold: 0.45,
  /** Kuşatılabilirlik tabanın altındayken enerjinin saniyede sızma miktarı. */
  energyDecayRate: 14,

  /** Vuruşun merkez etrafında öldürdüğü yarıçap. */
  strikeRadius: 6,
  /** Vuruş animasyonunun süresi (saniye). */
  strikeDuration: 0.9,
} as const

/** Kümenin o karedeki tek geçişte hesaplanan durumu. */
export interface SiegeState {
  /** Hayatta kalan yoksa null. */
  centroid: Vec2 | null
  /** 0–1. Kümenin sıkışıklığı. */
  density: number
  /** 0–1. Ortalama formasyon disiplini. */
  discipline: number
  /** 0–1. density × (1 − discipline): kuşatmaya açıklık. */
  vulnerability: number
  aliveCount: number
}

/**
 * Kümenin durumunu tek seferde çıkarır.
 * Merkez, sıkışıklık ve disiplin aynı veriden türediği için tek fonksiyonda
 * toplandı — her karede sürü üzerinde üç ayrı geçiş yapılmasın.
 */
export function calcSiegeState(enemies: readonly Enemy[]): SiegeState {
  let cx = 0
  let cz = 0
  let disciplineSum = 0
  let n = 0

  for (const e of enemies) {
    if (!e.alive) continue
    cx += e.pos.x
    cz += e.pos.z
    disciplineSum += e.discipline
    n++
  }

  if (n === 0) {
    return { centroid: null, density: 0, discipline: 1, vulnerability: 0, aliveCount: 0 }
  }

  const centroid: Vec2 = { x: cx / n, z: cz / n }
  const discipline = disciplineSum / n

  // Tek düşman merkeze sıfır uzaklıktadır; bu "kümelenme" değil.
  if (n < 2) {
    return { centroid, density: 0, discipline, vulnerability: 0, aliveCount: n }
  }

  let totalDist = 0
  for (const e of enemies) {
    if (!e.alive) continue
    totalDist += Math.hypot(e.pos.x - centroid.x, e.pos.z - centroid.z)
  }

  const meanDist = totalDist / n
  const density = clamp01(1 - meanDist / HILAL_CONFIG.gatherRadius)
  const vulnerability = density * (1 - discipline)

  return { centroid, density, discipline, vulnerability, aliveCount: n }
}

export function calcEnergyGain(vulnerability: number, deltaTime: number): number {
  return vulnerability * HILAL_CONFIG.energyFillRate * deltaTime
}

export interface PhaseContext {
  vulnerability: number
  isRetreating: boolean
  strikeTimer: number
}

/** Faz her karede state'ten türetilir — böylece geçiş kuralları tek yerde kalır. */
export function resolvePhase(ctx: PhaseContext): HilalPhase {
  if (ctx.strikeTimer > 0) return 'strike'
  if (ctx.vulnerability >= HILAL_CONFIG.gatherThreshold) return 'gather'
  if (ctx.isRetreating) return 'retreat'
  return 'idle'
}

/**
 * Kuşatılabilirliğe göre enerjiyi ilerletir. Düşman düzenini toparlarsa enerji
 * sızar — oyuncuyu baskıyı sürdürmeye zorlar.
 */
export function stepEnergy(energy: number, vulnerability: number, deltaTime: number): number {
  if (vulnerability < HILAL_CONFIG.vulnerabilityFloor) {
    return Math.max(0, energy - HILAL_CONFIG.energyDecayRate * deltaTime)
  }

  return Math.min(HILAL_CONFIG.strikeThreshold, energy + calcEnergyGain(vulnerability, deltaTime))
}

export function isStrikeReady(energy: number): boolean {
  return energy >= HILAL_CONFIG.strikeThreshold
}

/**
 * Kuşatmayı kapatır: merkez etrafındaki yarıçap içinde kalan düşmanlar düşer.
 * Enemy nesnelerini yerinde değiştirir ve düşen sayısını döndürür.
 */
export function executeStrike(enemies: Enemy[], centroid: Vec2): number {
  let kills = 0

  for (const e of enemies) {
    if (!e.alive) continue
    const dist = Math.hypot(e.pos.x - centroid.x, e.pos.z - centroid.z)
    if (dist <= HILAL_CONFIG.strikeRadius) {
      e.alive = false
      kills++
    }
  }

  return kills
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
