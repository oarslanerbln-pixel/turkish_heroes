// Sinematik çekimler: kamera taktik duruşundan ayrılıp geri döner.
//
// Taktik kamera 45° aşağı bakar; mesafeyi okumak için gereken bu. Ama o açıda
// ufuk kadraja giremez — "Bizans ordusu ufukta" ve gün batımı ancak kamera
// alçalınca görünür. Çekim kısa sürer ve oyuncu bu sırada da oynayabilir.
// Ağırlık 0 = taktik, 1 = tam sinematik duruş.

import type { CameraCue } from '../sim/world'

/** Açılış: ordugahın ardından ufka bakış, sonra taktik duruşa yükseliş (sn). */
export const INTRO_TIME = 2.8

/** Gün batımı: alçalış, bekleyiş, dönüş (sn). */
export const DUSK_RISE = 0.9
export const DUSK_HOLD = 1.8
export const DUSK_FALL = 1.5

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** Çekim başlayalı `t` saniye geçtiğinde sinematik duruşun ağırlığı. */
export function shotWeight(cue: CameraCue, t: number): number {
  if (cue === 'intro') {
    // İlk an kısa bir duraksama: oyuncu kadrajı görsün, sonra yükselsin.
    return 1 - smoothstep((t - 0.4) / (INTRO_TIME - 0.4))
  }
  if (t < DUSK_RISE) return smoothstep(t / DUSK_RISE)
  if (t < DUSK_RISE + DUSK_HOLD) return 1
  return 1 - smoothstep((t - DUSK_RISE - DUSK_HOLD) / DUSK_FALL)
}

/** Çekim bitti mi — kamera taktik duruşa tamamen döndü. */
export function shotDone(cue: CameraCue, t: number): boolean {
  return cue === 'intro' ? t >= INTRO_TIME : t >= DUSK_RISE + DUSK_HOLD + DUSK_FALL
}
