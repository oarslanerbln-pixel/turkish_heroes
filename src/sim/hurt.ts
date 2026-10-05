import type { StepEffects } from './step'
import type { World } from './world'

/**
 * Temas hasarı süreklidir (saniyede düşman başına birkaç puan); her karede
 * tepki vermek ses ve titreşimi vızıltıya çevirir. Hasar birikir, eşiği geçince
 * tek bir "yara" olur: ses, titreşim, kenar flaşı ve hafif sarsıntı.
 */
export const HURT_CONFIG = {
  /** Bir yara için biriken hasar (can puanı). */
  step: 3,
  /** İki yara arası en az (sn, simülasyon saati). */
  cooldown: 0.45,
  /** Sarsıntı süresi (sn). */
  shake: 0.18,
  /** Bu kadar hasar tam şiddet sayılır. */
  fullAmount: 10,
} as const

/** @returns true: bu adımda yara tepkisi verildi. */
export function stepHurt(
  w: World,
  damage: number,
  dt: number,
  fx: Pick<StepEffects, 'play' | 'haptic'>,
): boolean {
  w.hurtCooldown = Math.max(0, w.hurtCooldown - dt)
  w.hurtTimer = Math.max(0, w.hurtTimer - dt)
  w.hurtPending += damage
  if (w.hurtPending < HURT_CONFIG.step || w.hurtCooldown > 0) return false

  const amount = w.hurtPending
  w.hurtPending = 0
  w.hurtCooldown = HURT_CONFIG.cooldown
  w.hurtTimer = HURT_CONFIG.shake
  w.events.push({ type: 'hurt', amount })
  const intensity = Math.min(1, amount / HURT_CONFIG.fullAmount)
  fx.play('hurt', intensity)
  // Vuruşun 40 ms'sinden kısa: yara, oyuncunun kendi darbesinden hafif hissedilsin.
  fx.haptic(Math.round(18 + 14 * intensity))
  return true
}
