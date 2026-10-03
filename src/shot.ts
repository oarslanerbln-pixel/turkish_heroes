// Referans çekimler (MIMARI.md §10.8). Oyun testinde ?shot= sahneyi elle
// sürülen kipe alır: menüde tek kare çizilir, savaş başlayınca simülasyon sabit
// 1/60 adımla istenen ana gider ve orada donar (bkz. ShotDirector). Ordunun
// dizilişini ?seed= sabitler (sim/world.ts), kademeyi ?quality=.
//
// Görsel rastgelelik (toz, kıvılcım, ok saçılımı, sarsıntı) Math.random'dan
// geliyor. Çekim kipinde Math.random tohumlu bir akışla değişir: aynı çekim iki
// koşuda aynı çıksın. Modül yüklenirken değişir, React ilk kez çizmeden önce.

import { mulberry32, parseSeed } from './mechanics/random'
import { PLAYTEST } from './playtest'

/** Savaş saatinin bir anı (sn) ya da 'end': savaş bitene kadar. */
export type ShotMoment = number | 'end'

export function parseShot(search: string): ShotMoment | null {
  const value = new URLSearchParams(search).get('shot')
  if (value === 'end') return 'end'
  return value && /^\d{1,3}(\.\d{1,2})?$/.test(value) ? Number(value) : null
}

export const SHOT = PLAYTEST && typeof window !== 'undefined' ? parseShot(window.location.search) : null

/**
 * Sanat açıları (§10.8 R8, R9): oyun kamerası değil, model ve renk kararlarının
 * yargılandığı sabit pozlar. Oyuncuya göre; kamera konumu ve bakış noktası.
 */
export const SHOT_POSES = {
  // Yer seviyesi: oyuncunun sağ arkasından, göz hizasından düşman cephesine.
  ground: { offset: [3, 1.6, 6], look: [-2, 1.6, -14] },
  // Geniş plan: savaş alanının tamamı, değer düzeni uzaktan okunsun.
  wide: { offset: [-26, 34, 40], look: [0, 0, -16] },
} as const satisfies Record<string, { offset: readonly number[]; look: readonly number[] }>

export type ShotPose = keyof typeof SHOT_POSES

export function parsePose(search: string): ShotPose | null {
  const value = new URLSearchParams(search).get('pose')
  return value === 'ground' || value === 'wide' ? value : null
}

export const SHOT_POSE = SHOT !== null ? parsePose(window.location.search) : null

if (SHOT !== null) Math.random = mulberry32(parseSeed(window.location.search) ?? 1071)
