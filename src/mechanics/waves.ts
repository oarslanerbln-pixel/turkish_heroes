// Dalga tanımları — eskalasyon burada yönetilir.
//
// Düşman sayısı arttıkça artıyor, ama asıl zorluk kaynağı disiplinin toparlanma
// hızı: sonraki dalgalarda düşman baskıyı bıraktığın an daha çabuk yeniden
// düzene giriyor. Yani kiting'i daha uzun ve kesintisiz sürdürmen gerekiyor.
// chaseSpeed dalgalar arasında SABİT kalıyor — o değer zaten headless taramayla
// (bkz. enemySim.ts) hassas ayarlandı, dalga başına değiştirmek dengeyi
// bozardı. Can dalgalar arası yenilenmez: bu bir yıpranma savaşı.

import type { Enemy, Vec2 } from './types'
import { createEnemies, ENEMY_CONFIG } from './enemySim'
import { COMBAT_CONFIG } from './combat'

export interface WaveConfig {
  enemyCount: number
  /** Disiplinin toparlanma hızına çarpan. >1 = düşman baskı bırakılınca daha çabuk düzene döner. */
  disciplineRecoveryMult: number
}

export const WAVES: readonly WaveConfig[] = [
  { enemyCount: 16, disciplineRecoveryMult: 1.0 },
  { enemyCount: 26, disciplineRecoveryMult: 1.4 },
  { enemyCount: 38, disciplineRecoveryMult: 1.8 },
]

export const TOTAL_WAVES = WAVES.length

/** Metehan'ın en kalabalık dalgası; örnekleme kapasitesi scenario.ts'te (ENEMY_CAPACITY). */
export const MAX_WAVE_ENEMIES = Math.max(...WAVES.map((w) => w.enemyCount))

export function waveConfig(index: number): WaveConfig {
  return WAVES[Math.min(index, WAVES.length - 1)]
}

/** Yeni dalganın hiçbir askeri oyuncuya bundan yakın doğmaz: düzen mesafesi. */
export const SPAWN_CLEARANCE = ENEMY_CONFIG.standoffDistance

/** Denenen dönüşler (derece), öncelik sırasıyla: oyuncunun yakasından uzağa. */
const SPAWN_TURNS = [0, 20, -20, 40, -40, 60, -60, 80, -80, 100, -100, 120, -120, 150, -150, 180]

/**
 * @param player Oyuncunun konumu. Verilirse dalga oyuncunun yakasında, arena
 *   sınırı boyunca doğar; hiçbir asker SPAWN_CLEARANCE'tan yakın olmayacak
 *   kadar yana kaydırılır. Verilmezse varsayılan diziliş (-z; ilk dalga, oyuncu
 *   +z'de başlıyor).
 *
 * Neden oyuncunun yakası: dalga eskiden hep -z'de doğuyordu ve sonucu, o an
 * oyuncunun kaçış çemberinin neresinde olduğu belirliyordu (bot taraması:
 * aynı oyuncu için 2. dalgayı temizleme olasılığı yalnızca doğuş anına göre
 * %30–%100). Yön tarandı: karşı yakada doğan dalga merkezden kestirip oyuncuyu
 * ~5 sn'de yakalıyor (uzman bot %0 zafer); oyuncunun yakasında doğan dalga
 * arkada kalıyor, oyuncunun önünde arenanın tamamı kaçış yolu (uzman %100).
 * Sahte ricatın doğal geometrisi de bu: düşman arkadan gelir.
 */
export function spawnWave(index: number, player?: Vec2): Enemy[] {
  const enemies = createEnemies(waveConfig(index).enemyCount)
  if (!player || Math.hypot(player.x, player.z) < 1) return enemies
  const base = enemies.map((e) => ({ x: e.pos.x, z: e.pos.z }))
  // Varsayılan dizilişin merkez yönü -z: atan2(x, z) düzeninde π.
  const toward = Math.atan2(player.x, player.z) - Math.PI
  let best = 0
  let bestClear = -Infinity
  for (const deg of SPAWN_TURNS) {
    const clear = placeWave(enemies, base, toward + (deg * Math.PI) / 180, player)
    if (clear >= SPAWN_CLEARANCE) return enemies
    if (clear > bestClear) {
      bestClear = clear
      best = deg
    }
  }
  placeWave(enemies, base, toward + (best * Math.PI) / 180, player)
  return enemies
}

/** Dizilişi `phi` kadar döndürür; oyuncuya en yakın askerin mesafesini döndürür. */
function placeWave(enemies: Enemy[], base: readonly Vec2[], phi: number, player: Vec2): number {
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  let nearest = Infinity
  enemies.forEach((e, i) => {
    const { x, z } = base[i]
    e.pos.x = x * cos + z * sin
    e.pos.z = z * cos - x * sin
    nearest = Math.min(nearest, Math.hypot(e.pos.x - player.x, e.pos.z - player.z))
  })
  return nearest
}

/**
 * Bozgun eşiği: vuruştan sonra dalganın en fazla bu payı ayakta kaldıysa kalanlar
 * kaçar. Olmasaydı son bir-iki düşman disiplinsiz (oyuncudan hızlı) halde
 * oyuncunun dibine yapışıyor, yayın iç yarıçapında kaldığı için vurulamıyor ve
 * oyuncuyu yavaşça öldürüyordu (bot taraması: yenilgilerin ~%20'si, bir koşuda
 * tek düşmanla 465 sn). Tarihte de böyle: kuşatılıp kırılan ordunun artığı dağılır.
 */
export const ROUT_SHARE = 0.15

/** Bu dalgada bozguna yol açan en büyük artık (16 → 2, 26 → 3, 38 → 5). */
export function routLimit(index: number): number {
  return Math.floor(waveConfig(index).enemyCount * ROUT_SHARE)
}

/**
 * Vuruştan sonra: artık eşiğin altındaysa bozguna uğrar.
 * @returns bozguna uğrayan sayısı (yoksa 0).
 */
export function routSurvivors(enemies: Enemy[], index: number): number {
  let n = 0
  for (const e of enemies) if (e.alive && !e.routed) n++
  if (n === 0 || n > routLimit(index)) return 0
  for (const e of enemies) if (e.alive) e.routed = true
  return n
}

/**
 * Zorluk merdiveni: temas hasarının çarpanı, basamak basamak. Oyuncu ilk
 * basamaktan (yarı hasar) başlar; her zafer bir basamak zorlaştırır, her
 * yenilgi bir basamak kolaylaştırır (psikofizikteki 1-yukarı-1-aşağı
 * merdiveni: her oyuncu kendi ~%50 zafer oranına yakınsar).
 *
 * Neden: sabit tam hasarda bot taraması (3 dalga, can devrediliyor) uzman
 * dışında herkesi duvara çarpıyordu — iyi oyuncu %14, orta %2 zafer, acemi
 * %77 ilk dalgada ölüyor. Metehan oyunun kapısı ve Malazgirt'in kilidi.
 * Merdivenle (oyuncu başına 12 deneme): uzman %97 ve tam hasara yerleşiyor,
 * iyi %55, orta %22 ve hepsi en az bir kez kazanıyor (ilk zafer ortalama
 * 3,8. denemede). "İlk zafere kadar yarı, sonra tam" bir uçurum olurdu
 * (iyi oyuncu %70 → %14): kazandıktan sonra kaybetmeye başlamak.
 */
export const DAMAGE_LADDER = [0.5, 0.6, 0.7, 0.85, 1] as const

export const LADDER_TOP = DAMAGE_LADDER.length - 1

/** Savaş sonucuna göre bir sonraki basamak. */
export function nextLadderStep(step: number, victory: boolean): number {
  return Math.min(LADDER_TOP, Math.max(0, step + (victory ? 1 : -1)))
}

export function ladderScale(step: number): number {
  return DAMAGE_LADDER[Math.min(LADDER_TOP, Math.max(0, Math.round(step)))]
}

/** Bir dalganın temizlenmesiyle kazanılan puan. Sonraki dalgalar daha değerli. */
export function waveClearBonus(clearedIndex: number): number {
  return 200 * (clearedIndex + 1)
}

/** Yıldız için gereken tam hasar karşılığı kalan can. */
export const WAVES_STAR_HEALTH = { 2: 0, 3: 35 } as const

/**
 * Metehan zaferinin yıldızları (1–3). Yalnızca zaferde çağrılır.
 *
 * Bot taraması (4 beceri × 5 basamak × 40 tohum, zaferler): vuruş sayısı hep 6,
 * en büyük vuruş 29–31, düşürülen 71–79/80, süre 71–91 sn — beceriyi ayırmıyor.
 * Ayıran tek şey alınan yara. Ama merdiven onu ölçekliyor: aynı uzman koşusu
 * yarı hasarda 63, tam hasarda 27 canla bitiyor. `taken / scale` (tam hasar
 * karşılığı yara) ise basamaktan bağımsız: tohum 1 beş basamakta da 70.
 *
 * Kazananlarda tam hasar karşılığı kalan can (100 − taken/scale), p10/p50/p90:
 * uzman 8/26/42, iyi −94/−32/6, orta −96/−52/−2 (eksi: tam hasarda ölürdü).
 *
 * Eşikler bu dağılımdan: 2 yıldız "tam hasarda da ayakta kalırdın" (uzman
 * %95, iyi %22), 3 yıldız 35 (uzman %36, iyi %7, orta hiç) — Malazgirt'in
 * imparatoru gibi uzmanın da her seferinde alamadığı an.
 *
 * @param health Zaferde kalan can (0–100).
 * @param scale Oynanan basamağın hasar çarpanı (ladderScale), 0.5–1.
 */
export function wavesStars(health: number, scale: number): number {
  const max = COMBAT_CONFIG.playerMaxHealth
  const fullDamageHealth = max - (max - health) / scale
  if (fullDamageHealth >= WAVES_STAR_HEALTH[3]) return 3
  if (fullDamageHealth >= WAVES_STAR_HEALTH[2]) return 2
  return 1
}

/** wavesStars'ın tersi: `stars` yıldız için bu basamakta zaferde kalması gereken can. */
export function wavesStarHealth(stars: 2 | 3, scale: number): number {
  const max = COMBAT_CONFIG.playerMaxHealth
  return Math.ceil(max - (max - WAVES_STAR_HEALTH[stars]) * scale)
}
