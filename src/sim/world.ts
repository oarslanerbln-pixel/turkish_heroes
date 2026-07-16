// Simülasyonun canlı state'i.
//
// Bilinçli olarak Zustand dışında tutuluyor: 48 düşmanın pozisyonu her karede
// store'a yazılsaydı React saniyede 60 kez re-render ederdi. Buradaki veri
// useFrame içinde yerinde mutate edilir; store'a yalnızca HUD'un gördüğü
// özet değerler throttle'lanarak aktarılır (bkz. GameDirector).

import { createEnemies } from '../mechanics/enemySim'
import { COMBAT_CONFIG, type Outcome } from '../mechanics/combat'
import type { Enemy, HilalPhase, StrikeRefusal, Vec2 } from '../mechanics/types'

export interface World {
  player: Vec2
  /** Gerçekleşen yer değiştirmeden türetilir, klavye niyetinden değil. */
  playerVel: Vec2
  playerHealth: number
  /** Oyuncuya temas eden düşman sayısı — HUD ve hasar için. */
  attackers: number
  enemies: Enemy[]
  energy: number
  /** 0–1. Kümenin sıkışıklığı. */
  density: number
  /** 0–1. Kuşatmaya açıklık: density × (1 − disiplin). Enerjiyi bu doldurur. */
  vulnerability: number
  phase: HilalPhase
  outcome: Outcome
  /** Oyuncu düşmanı peşinden sürüklüyor mu (sahte çekilme / kiting). */
  isRetreating: boolean
  /** Yayın gitmek istediği yön: en çok düşmanı yakalayan açı. Ayrık, sıçrayabilir. */
  facingTarget: number
  /** Yayın o anki yönü (atan2(dx, dz)); hedefe sınırlı hızla döner. */
  facing: number
  /** Yay şimdi tetiklense kaç düşman düşerdi — önizleme. */
  inCrescent: number
  /** Vuruş animasyonu için kalan süre; > 0 ise vuruş sürüyor. */
  strikeTimer: number
  /** Vuruşun tetiklendiği andaki yay merkezi (oyuncunun konumu). */
  strikeOrigin: Vec2
  /** Vuruşun tetiklendiği andaki yay yönü — efekt bununla çizilir. */
  strikeFacing: number
  /** HUD veya klavye tarafından set edilir, GameDirector tüketir. */
  strikeRequested: boolean
  /** Son vuruş isteği neden reddedildi — oyuncuya gösterilir. */
  refusal: StrikeRefusal
  /** Ret mesajının ekranda kalacağı süre. */
  refusalTimer: number
  totalKills: number
}

// Başlangıç değerleri tek yerde: resetWorld'ün bir alanı atlaması mümkün olmasın.
function initialWorld(): World {
  return {
    player: { x: 0, z: 8 },
    playerVel: { x: 0, z: 0 },
    playerHealth: COMBAT_CONFIG.playerMaxHealth,
    attackers: 0,
    enemies: createEnemies(),
    energy: 0,
    density: 0,
    vulnerability: 0,
    phase: 'idle',
    outcome: 'playing',
    isRetreating: false,
    // Düşman -z'de doğuyor; yay baştan onlara baksın.
    facingTarget: Math.PI,
    facing: Math.PI,
    inCrescent: 0,
    strikeTimer: 0,
    strikeOrigin: { x: 0, z: 0 },
    strikeFacing: Math.PI,
    strikeRequested: false,
    refusal: 'none',
    refusalTimer: 0,
    totalKills: 0,
  }
}

/**
 * Modül düzeyinde tek örnek. Referans sabit kalmalı — her yer bunu import ediyor.
 */
export const world: World = initialWorld()

export function resetWorld(): void {
  Object.assign(world, initialWorld())
}

/** Simülasyon yalnızca oyun sürerken ilerler (yenilgi/zafer ekranında donar). */
export function isPlaying(): boolean {
  return world.outcome === 'playing'
}
