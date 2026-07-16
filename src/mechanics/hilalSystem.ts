// Hilal (Kuşatma) Taktiği — temel tip ve sabitler
// Faz 2'de Opus ile geliştirilecek oyun mantığı buraya taşınacak

export const HILAL_CONFIG = {
  energyFillRate: 8,       // saniyede dolacak enerji (yoğunluk 1.0'da)
  strikeThreshold: 100,    // vuruş için gereken minimum enerji
  retreatSpeed: 6,         // çekilme fazında karakter hızı
  gatherRadius: 12,        // düşmanların gruplaşma yarıçapı (birim)
} as const

export type HilalPhase = 'idle' | 'retreat' | 'gather' | 'strike'

export function calcEnergyGain(
  clusterDensity: number,  // 0–1
  deltaTime: number,
): number {
  return clusterDensity * HILAL_CONFIG.energyFillRate * deltaTime
}
