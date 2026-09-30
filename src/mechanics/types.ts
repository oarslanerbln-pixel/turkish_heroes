// Simülasyon katmanının paylaşılan tipleri.
// Bu katman React'ten bağımsızdır — saf veri ve saf fonksiyonlar.

// Oyun düzlemsel (XZ) oynanıyor; Y ekseni simülasyona dahil değil.
export interface Vec2 {
  x: number
  z: number
}

export interface Enemy {
  id: number
  pos: Vec2
  vel: Vec2
  alive: boolean
  /** 0–1. Formasyon disiplini: 1 = düzen korunuyor, 0 = düzen tamamen bozuk. */
  discipline: number
  /** Bağlı olduğu birliğin indeksi — yalnızca birlik düzeninde savaşan senaryolarda. */
  corps?: number
  /** İmparator: tek başına savaşın sonucunu belirleyen asker. */
  emperor?: boolean
  /**
   * Korunuyor: hilal yayında olsa bile düşmez ve yayın nişanını çekmez.
   * İmparator, muhafızları dağılana kadar böyle.
   */
  guarded?: boolean
  /** Savaş alanını terk etti — düşmedi; ölüm animasyonu oynatılmaz. */
  fled?: boolean
}

export type HilalPhase = 'idle' | 'retreat' | 'gather' | 'strike'

/**
 * Vuruş isteği neden yerine getirilmedi?
 * Oyuncu tuşa bastığında ekranda hiçbir şey olmaması kabul edilemez: tuşun
 * bozuk olduğunu düşünür. Reddin sebebi her zaman söylenir.
 */
export type StrikeRefusal =
  | 'none'
  | 'notReady'
  | 'noTargets'
  /** Yayda asker var ama hepsi düzenini koruyor — önce yıpratılmalı. */
  | 'steady'
