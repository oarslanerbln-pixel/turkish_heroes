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
   * corps vurulan birlik; byPlayer oku oyuncu mu attı, yoksa bir kol mu.
   */
  | {
      type: 'arrowReleased'
      slot: number
      origin: Vec2
      target: Vec2
      t0: number
      corps: number
      byPlayer: boolean
    }
  /**
   * Ok kamerasının izlediği ok saplandı. Yalnız o: her taciz okunda kıvılcım
   * olsaydı ok yağmuru gürültüye dönerdi.
   */
  | { type: 'arrowLanded'; x: number; z: number }
  /** Hilal yaylımının oku bir düşene saplandı (Metehan; bkz. volleyPlan). */
  | { type: 'volleyHit'; x: number; z: number }
  /** Bir birlik hamleye kalktı; pos hamle edenlerin ortası. */
  | { type: 'charge'; corps: number; pos: Vec2 }
  /** Islıklı ok atıldı; target okun ineceği nokta (bkz. whistle.ts). */
  | { type: 'whistleFired'; origin: Vec2; target: Vec2 }
  /** Islıklı okun yağmuru indi; hit düzeni sarsılan düşman sayısı. */
  | { type: 'whistleLanded'; x: number; z: number; hit: number }
  /** Kırılan dalganın artığı kaçıyor. */
  | { type: 'rout'; count: number }
  /** Oyuncu yara aldı; amount bu tepkiye biriken hasar (bkz. hurt.ts). */
  | { type: 'hurt'; amount: number }
  | { type: 'sunset' }
  | { type: 'waveSpawn'; wave: number }
  /** Baideng: Han arbaletleri nişan aldı; halka BAIDENG.volleyTelegraph sn sonra iner. */
  | { type: 'volleyAimed'; x: number; z: number }
  /** Yaylım indi; hit oyuncu halkadaydı, felled halkada düşen Han atlısı sayısı. */
  | { type: 'volleyLanded'; x: number; z: number; hit: boolean; felled: number }
  /** Baideng: gövde kırıldı, dört renkli Hun çemberi Gaozu'nun çevresinde kuruluyor. */
  | { type: 'encircle'; center: Vec2 }
  /** Baideng: çember kapandı, muhafız kalmadı — Gaozu barış istedi. */
  | { type: 'peace' }

export interface StrikeVictim {
  id: number
  x: number
  z: number
}
