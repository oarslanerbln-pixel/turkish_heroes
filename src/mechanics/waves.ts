// Dalga tanımları — eskalasyon burada yönetilir.
//
// Düşman sayısı arttıkça artıyor, ama asıl zorluk kaynağı disiplinin toparlanma
// hızı: sonraki dalgalarda düşman baskıyı bıraktığın an daha çabuk yeniden
// düzene giriyor. Yani kiting'i daha uzun ve kesintisiz sürdürmen gerekiyor.
// chaseSpeed dalgalar arasında SABİT kalıyor — o değer zaten headless taramayla
// (bkz. enemySim.ts) hassas ayarlandı, dalga başına değiştirmek dengeyi
// bozardı. Can dalgalar arası yenilenmez: bu bir yıpranma savaşı.

import type { Enemy } from './types'
import { createEnemies } from './enemySim'

export interface WaveConfig {
  enemyCount: number
  /** Disiplinin toparlanma hızına çarpan. >1 = düşman baskı bırakılınca daha çabuk düzene döner. */
  disciplineRecoveryMult: number
}

export const WAVES: readonly WaveConfig[] = [
  { enemyCount: 16, disciplineRecoveryMult: 1.0 },
  { enemyCount: 26, disciplineRecoveryMult: 1.4 },
  { enemyCount: 38, disciplineRecoveryMult: 1.8 },
]

export const TOTAL_WAVES = WAVES.length

/** instancedMesh'in ayırması gereken en büyük kapasite — en kalabalık dalga. */
export const MAX_WAVE_ENEMIES = Math.max(...WAVES.map((w) => w.enemyCount))

export function waveConfig(index: number): WaveConfig {
  return WAVES[Math.min(index, WAVES.length - 1)]
}

export function spawnWave(index: number): Enemy[] {
  return createEnemies(waveConfig(index).enemyCount)
}

/** Bir dalganın temizlenmesiyle kazanılan puan. Sonraki dalgalar daha değerli. */
export function waveClearBonus(clearedIndex: number): number {
  return 200 * (clearedIndex + 1)
}
