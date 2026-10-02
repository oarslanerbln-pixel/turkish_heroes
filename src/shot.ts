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

if (SHOT !== null) Math.random = mulberry32(parseSeed(window.location.search) ?? 1071)
