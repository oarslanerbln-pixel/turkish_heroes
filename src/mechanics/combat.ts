// Temas ve sonuç mantığı.
//
// Oyunun gerilimi burada kapanıyor: düşmanın düzenini bozmak için onu peşine
// takmak zorundasın, ama peşine taktığın düşman sana yetişirse seni çiğner.
// Kaçmak bedava değil.

import type { Enemy, Vec2 } from './types'

export const COMBAT_CONFIG = {
  playerMaxHealth: 100,
  /** Bu mesafedeki düşman oyuncuya temas etmiş sayılır. */
  contactRadius: 1.5,
  /**
   * Temas eden düşman başına saniyelik hasar.
   * Bilerek düşük: 5×14=70 dps ile ölüm 1.4 saniye sürüyordu ve zorluk eğri
   * değil uçurum oluyordu (dolum hızı 20→17 arası can %95'ten %38'e düşüyordu).
   * Daha yumuşak hasar oyuncuya kopup kaçma fırsatı bırakıyor.
   */
  damagePerEnemy: 8,
  /**
   * Aynı anda en fazla bu kadar düşman vurabilir.
   * Geometrik olarak da doğru: oyuncunun etrafını ancak bu kadarı sarabilir.
   * Sınır olmasaydı 20 kişilik yığın oyuncuyu tek karede silerdi.
   */
  maxAttackers: 6,
} as const

export type Outcome = 'playing' | 'victory' | 'defeat'

/** Oyuncuya temas eden düşman sayısı. */
export function countAttackers(enemies: readonly Enemy[], playerPos: Vec2): number {
  let n = 0
  const rSq = COMBAT_CONFIG.contactRadius ** 2

  for (const e of enemies) {
    if (!e.alive) continue
    const dx = e.pos.x - playerPos.x
    const dz = e.pos.z - playerPos.z
    if (dx * dx + dz * dz <= rSq) n++
  }

  return n
}

export function calcContactDamage(attackers: number, deltaTime: number): number {
  const effective = Math.min(attackers, COMBAT_CONFIG.maxAttackers)
  return effective * COMBAT_CONFIG.damagePerEnemy * deltaTime
}

export function resolveOutcome(health: number, aliveCount: number): Outcome {
  if (health <= 0) return 'defeat'
  if (aliveCount === 0) return 'victory'
  return 'playing'
}
