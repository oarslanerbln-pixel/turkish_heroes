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

  /** Vuruş animasyonunun süresi (saniye). */
  strikeDuration: 0.9,
} as const

/**
 * Hilal yayının geometrisi.
 *
 * Vuruş oyuncunun konumunda merkezlenir ve düşman kümesine döner; daire değil
 * yay olması oyuna üç beceri katmanı ekliyor:
 *  - Menzil: küme dış yarıçapın ötesindeyse ıska. Kaçarken fazla uzaklaşamazsın,
 *    yani hayatta kalma içgüdüsü vuruş ihtiyacıyla çelişir.
 *  - Sıkışıklık: yayın açısından geniş bir küme kenarlardan sızar.
 *  - Zamanlama: pencere dar.
 * Eskiden yarıçap 6'lık bir daireydi ve 48/48 dusmani tek seferde siliyordu;
 * ne nişan ne konum gerekiyordu.
 */
export const CRESCENT = {
  /** Dibindekiler kuşatılmış sayılmaz — üstüne binen düşman yaydan kaçar. */
  innerRadius: 2.5,
  outerRadius: 13,
  /** Yayın yarı açısı (radyan). Toplam açıklık bunun iki katı. */
  halfAngle: Math.PI * 0.22,
} as const

/** Açıyı -PI..PI aralığına indirger. */
function normalizeAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/**
 * Verilen nokta hilal yayının içinde mi?
 * @param origin Yayın merkezi (oyuncunun konumu).
 * @param facing Yayın baktığı yön; atan2(dx, dz) düzeninde.
 */
export function isInCrescent(pos: Vec2, origin: Vec2, facing: number): boolean {
  const dx = pos.x - origin.x
  const dz = pos.z - origin.z
  const dist = Math.hypot(dx, dz)

  if (dist < CRESCENT.innerRadius || dist > CRESCENT.outerRadius) return false

  const angle = Math.atan2(dx, dz)
  return Math.abs(normalizeAngle(angle - facing)) <= CRESCENT.halfAngle
}

/** Yön aranırken denenen açı sayısı (7.5°'lik adımlar). */
const FACING_SAMPLES = 48

/**
 * Yeni bir yönün seçilmesi için mevcut yönden en az bu kadar fazla düşman
 * vurması gerekir. Olmasaydı yay, neredeyse eşit iki aday arasında her karede
 * gidip gelir ve titrerdi.
 */
const FACING_HYSTERESIS = 2

/**
 * Yayın bakacağı yön: en çok düşmanı yakalayan açı.
 *
 * Önce sürünün ağırlık merkezine nişan alınıyordu, ama düşman oyuncuyu sardığında
 * merkez oyuncunun üstüne düşüyor ve yön rastgeleleşiyordu — otomatik nişan tam da
 * en kritik anda bozuluyordu. En iyi açıyı taramak hem bu bozulmayı ortadan
 * kaldırıyor hem de oyuncunun zaten istediği şeyi yapıyor. Beceri menzil,
 * zamanlama ve kümeyi sıkı tutmakta kalıyor.
 *
 * Menzilde hiç düşman yoksa merkeze bakılır: oyuncu yayı nereye kuracağını
 * uzaktayken de görebilsin.
 */
export function calcFacing(
  enemies: readonly Enemy[],
  origin: Vec2,
  currentFacing: number,
  centroid: Vec2 | null,
): number {
  let bestFacing = currentFacing
  let bestCount = countInCrescent(enemies, origin, currentFacing)

  for (let i = 0; i < FACING_SAMPLES; i++) {
    const angle = -Math.PI + (i / FACING_SAMPLES) * Math.PI * 2
    const count = countInCrescent(enemies, origin, angle)
    if (count > bestCount + FACING_HYSTERESIS) {
      bestCount = count
      bestFacing = angle
    }
  }

  if (bestCount > 0) return bestFacing

  // Menzilde kimse yok: kümeye dön. Küme tam üstümüzdeyse yön belirsizdir,
  // son yönü koru — yay ekranda çılgınca dönmesin.
  if (!centroid) return currentFacing
  const dx = centroid.x - origin.x
  const dz = centroid.z - origin.z
  if (Math.hypot(dx, dz) < 0.5) return currentFacing
  return Math.atan2(dx, dz)
}

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
 * Kuşatmayı kapatır: hilal yayının içinde kalan düşmanlar düşer.
 * Enemy nesnelerini yerinde değiştirir ve düşen sayısını döndürür.
 *
 * Sağ kalanların disiplini sıfırlanır: kuşatmanın kapandığını gören birlik
 * irkilir, hücumu keser ve standoff mesafesine geri çekilir. Bu olmadan oyun
 * kilitleniyordu — vuruştan sonra kalan düşmanlar disiplinsiz (yani oyuncudan
 * hızlı) halde üstünde kalıyor, enerji ise sıfırdan doluyordu; oyuncu şarj
 * bitmeden ölüyordu. Şimdi vuruş nefes aldırıyor ve döngü yeniden başlıyor:
 * kalanları tekrar boz, tekrar kuşat.
 */
export function executeStrike(enemies: Enemy[], origin: Vec2, facing: number): number {
  let kills = 0

  for (const e of enemies) {
    if (!e.alive) continue

    if (isInCrescent(e.pos, origin, facing)) {
      e.alive = false
      kills++
    } else {
      e.discipline = 1
    }
  }

  return kills
}

/** Yay şu an tetiklense kaç düşman düşerdi — önizleme ve HUD için. */
export function countInCrescent(
  enemies: readonly Enemy[],
  origin: Vec2,
  facing: number,
): number {
  let n = 0
  for (const e of enemies) {
    if (e.alive && isInCrescent(e.pos, origin, facing)) n++
  }
  return n
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
