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
}

export type HilalPhase = 'idle' | 'retreat' | 'gather' | 'strike'
