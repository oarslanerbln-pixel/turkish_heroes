import { HILAL_CONFIG } from '../mechanics/hilalSystem'
import { HURT_CONFIG } from '../sim/hurt'
import type { World } from '../sim/world'

const STRIKE_SHAKE = 0.5
/** Yara sarsıntısı vuruşunkinin altında: oyuncunun kendi darbesi baskın kalsın. */
const HURT_SHAKE = 0.14

/** Bu karenin sarsıntı genliği (dünya birimi); hareketi azaltta 0. */
export function shakeStrength(w: World, reducedMotion: boolean): number {
  if (reducedMotion) return 0
  // En sert vuruş anında, sonra karesiyle sönümlenir.
  const strike = w.strikeTimer / HILAL_CONFIG.strikeDuration
  const hurt = w.hurtTimer / HURT_CONFIG.shake
  return Math.max(strike * strike * STRIKE_SHAKE, hurt * hurt * HURT_SHAKE)
}
