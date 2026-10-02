import type { Vec2 } from '../mechanics/types'

/**
 * Sunum olayları (world.events): kamera, ses ve görsellerin okuduğu tipli
 * kuyruk. Kuralların kendi kaydı (BattleState.events: telemetri, karne,
 * botlar) ayrı kalır; bunlar "ne oldu" yanında "nerede, kime" de taşır.
 *
 * Karenin sonunda boşalır (bkz. EventFlush): her okuyucu, önceliği ne olursa
 * olsun, o karede itilen her olayı görür. Kareler arasında itilenler (mağaza
 * eylemleri) bir sonraki kareye kalır.
 */
export type WorldEvent =
  /** Hilal kapandı; victims bu vuruşta düşenler, düştükleri yerde. */
  | { type: 'strike'; origin: Vec2; facing: number; victims: StrikeVictim[] }
  /**
   * Taciz oku bırakıldı. slot ok havuzundaki yeri (bkz. arrowPool); havuz
   * döndüğü için okuyan, yuvanın hâlâ bu oku taşıdığını t0 ile doğrular.
   */
  | { type: 'arrowReleased'; slot: number; origin: Vec2; target: Vec2; t0: number }
  /** Bir birlik hamleye kalktı; pos hamle edenlerin ortası. */
  | { type: 'charge'; corps: number; pos: Vec2 }
  /** Kırılan dalganın artığı kaçıyor. */
  | { type: 'rout'; count: number }
  | { type: 'sunset' }
  | { type: 'waveSpawn'; wave: number }

export interface StrikeVictim {
  id: number
  x: number
  z: number
}
