// Dalga tanımları — eskalasyon burada yönetilir.
//
// Düşman sayısı arttıkça artıyor, ama asıl zorluk kaynağı disiplinin toparlanma
// hızı: sonraki dalgalarda düşman baskıyı bıraktığın an daha çabuk yeniden
// düzene giriyor. Yani kiting'i daha uzun ve kesintisiz sürdürmen gerekiyor.
// chaseSpeed dalgalar arasında SABİT kalıyor — o değer zaten headless taramayla
// (bkz. enemySim.ts) hassas ayarlandı, dalga başına değiştirmek dengeyi
// bozardı. Can yalnızca finalden önceki molada kısmen döner: bu bir yıpranma savaşı.

import type { Enemy, Vec2 } from './types'
import { createEnemies, ENEMY_CONFIG } from './enemySim'
import { COMBAT_CONFIG } from './combat'
import { createBaidengArmy, swarmSize } from './baideng'

export interface WaveConfig {
  enemyCount: number
  /** Disiplinin toparlanma hızına çarpan. >1 = düşman baskı bırakılınca daha çabuk düzene döner. */
  disciplineRecoveryMult: number
  /**
   * Kıskaç: bu kadar asker ayrı bir müfreze olarak oyuncunun gittiği yönde
   * doğar ve kaçış yolunu keser (bkz. flankDetachment).
   */
  flank?: number
  /** Baideng: Gaozu, arbaletli muhafızları ve dört renkli çember (bkz. baideng.ts). */
  baideng?: boolean
  /** Dalgadan önceki molada dönen can: yıpranma savaşının tek nefesi. */
  rest?: number
}

/**
 * Doğu Hu, Yüeçi, Loufan ve Baiyang, Baideng: Shiji 110'daki Mete seferleri
 * sırasıyla.
 *
 * 2. dalga eskiden en kolayıydı (uzman bot, tam hasar, dalga başına yara
 * 32 / 8 / 33): oyuncunun yakasında doğan sürü kaçış çemberindeki oyuncunun
 * hazır yayına düşüyordu. Kıskaç müfrezesi çemberin önünü keser. Taranan
 * müfreze boyu (uzmanın 2. dalga yarası): 0 → 8, 4 → 24, 6 → 40.
 *
 * Kıskaç uzmana ~16 yara ekledi ama asıl ayırdığı beceri: yarı hasarda
 * 2. dalga uzmana 12, iyi oyuncuya 43 yara. Yıpranma yine kıl payı geçilir
 * kalsın diye 3. dalga 38 @ 1.8'den 28 @ 1.6'ya indi (34 @ 1.8'de orta
 * oyuncuların 12'sinden 2'si merdivende 8 denemede kazanamıyordu).
 *
 * Baideng öncesinde ordu soluklanır, 70 can döner: final yıpranmanın üstüne
 * gelir ama kendi başına uzmanın en ağır savaşı. Taranan mola canı (40 tohum,
 * uzman, tam hasar): 70 → 36 zafer, 55 → 30.
 *
 * Son ölçüm (30 tohum, tam hasar): uzman 28 zafer, dalga başına yara
 * 32 / 24 / 16 / 68. Yarı hasarda iyi 19 (eski 20), orta 7 (eski 8), acemi 0.
 * Orta oyuncular Baideng'de değil 2. ve 3. dalgada düşüyor; merdiven onları
 * yine taşıyor (bkz. metehan.test kariyer sözü).
 */
export const WAVES: readonly WaveConfig[] = [
  { enemyCount: 16, disciplineRecoveryMult: 1.0 },
  { enemyCount: 26, disciplineRecoveryMult: 1.4, flank: 4 },
  { enemyCount: 28, disciplineRecoveryMult: 1.6 },
  { enemyCount: 33, disciplineRecoveryMult: 1.8, baideng: true, rest: 70 },
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
export function spawnWave(index: number, player?: Vec2, heading?: Vec2): Enemy[] {
  const cfg = waveConfig(index)
  const flank = cfg.flank ?? 0
  const enemies = cfg.baideng ? createBaidengArmy(cfg.enemyCount) : createEnemies(cfg.enemyCount - flank)
  if (player && Math.hypot(player.x, player.z) >= 1) placeNear(enemies, player)
  if (flank > 0) enemies.push(...flankDetachment(enemies, flank, player ?? DEFAULT_PLAYER, heading))
  return enemies
}

/** Oyuncusuz doğuşta (ilk dalga, testler) müfrezenin ölçüldüğü yer: başlangıç konumu. */
const DEFAULT_PLAYER: Vec2 = { x: 0, z: 8 }

function placeNear(enemies: Enemy[], player: Vec2): void {
  const base = enemies.map((e) => ({ x: e.pos.x, z: e.pos.z }))
  // Varsayılan dizilişin merkez yönü -z: atan2(x, z) düzeninde π.
  const toward = Math.atan2(player.x, player.z) - Math.PI
  let best = 0
  let bestClear = -Infinity
  for (const deg of SPAWN_TURNS) {
    const clear = placeWave(enemies, base, toward + (deg * Math.PI) / 180, player)
    if (clear >= SPAWN_CLEARANCE) return
    if (clear > bestClear) {
      bestClear = clear
      best = deg
    }
  }
  placeWave(enemies, base, toward + (best * Math.PI) / 180, player)
}

/** Müfrezenin merkezi oyuncunun bu kadar önünde. */
const FLANK_AHEAD = 15
/** Müfreze ana gövdeden en az bu kadar ayrı doğar: iki ayrı küme olsun. */
const FLANK_APART = 8
const FLANK_SPACING = 1.8
/** Denenen sapmalar (derece): önce tam gidiş yönü, sonra iki yana. */
const FLANK_TURNS = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180]

/**
 * Kıskaç müfrezesi: oyuncunun gittiği yönde, iki sıra halinde. Oyuncu
 * duruyorsa gidiş yönü arena merkezi çevresinde teğet. Arena sınırı ya da ana
 * gövde o yönü kapatıyorsa iki yana sapar; her durumda düzen mesafesinin
 * dışında doğar.
 *
 * Neden önde, karşıda değil: karşı yakada doğan dalga merkezden kestirip
 * oyuncuyu ~5 sn'de yakalıyordu (bkz. spawnWave). Önde doğan küçük müfreze
 * yolu keser ama yanından dolanmaya yer bırakır.
 */
function flankDetachment(main: readonly Enemy[], n: number, player: Vec2, heading?: Vec2): Enemy[] {
  let hx = heading?.x ?? 0
  let hz = heading?.z ?? 0
  if (Math.hypot(hx, hz) < 0.5) {
    const r = Math.hypot(player.x, player.z)
    ;[hx, hz] = r < 1 ? [1, 0] : [-player.z / r, player.x / r]
  }
  const base = Math.atan2(hx, hz)
  const out: Enemy[] = Array.from({ length: n }, (_, i) => ({
    id: main.length + i,
    pos: { x: 0, z: 0 },
    vel: { x: 0, z: 0 },
    alive: true,
    discipline: 1,
  }))
  let fallback = 0
  let fallbackFit = -Infinity
  for (const deg of FLANK_TURNS) {
    const fit = placeFlank(out, main, player, base + (deg * Math.PI) / 180)
    if (fit >= 0) return out
    if (fit > fallbackFit) {
      fallbackFit = fit
      fallback = deg
    }
  }
  placeFlank(out, main, player, base + (fallback * Math.PI) / 180)
  return out
}

/**
 * Müfrezeyi `angle` yönüne dizer. Uygunluk ≥ 0: hem oyuncudan düzen
 * mesafesinde hem ana gövdeden ayrı; eksi değer ne kadar eksik kaldığı.
 */
function placeFlank(out: Enemy[], main: readonly Enemy[], player: Vec2, angle: number): number {
  const fx = Math.sin(angle)
  const fz = Math.cos(angle)
  const cols = Math.ceil(out.length / 2)
  const limit = ENEMY_CONFIG.arenaRadius - 2
  let cx = player.x + fx * FLANK_AHEAD
  let cz = player.z + fz * FLANK_AHEAD
  const r = Math.hypot(cx, cz)
  if (r > limit) {
    cx *= limit / r
    cz *= limit / r
  }
  let nearest = Infinity
  let apart = Infinity
  out.forEach((e, i) => {
    const col = Math.floor(i / 2) - (cols - 1) / 2
    const row = i % 2
    // Sıralar gidiş yönüne dik; ikinci sıra bir adım geride.
    e.pos.x = cx + fz * col * FLANK_SPACING + fx * row * FLANK_SPACING
    e.pos.z = cz - fx * col * FLANK_SPACING + fz * row * FLANK_SPACING
    const d = Math.hypot(e.pos.x, e.pos.z)
    if (d > ENEMY_CONFIG.arenaRadius) {
      e.pos.x *= ENEMY_CONFIG.arenaRadius / d
      e.pos.z *= ENEMY_CONFIG.arenaRadius / d
    }
    nearest = Math.min(nearest, Math.hypot(e.pos.x - player.x, e.pos.z - player.z))
    for (const m of main) apart = Math.min(apart, Math.hypot(e.pos.x - m.pos.x, e.pos.z - m.pos.z))
  })
  return Math.min(nearest - SPAWN_CLEARANCE, apart - FLANK_APART)
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

/**
 * Bu dalgada bozguna yol açan en büyük artık (16 → 2, 26 → 3, 38 → 5).
 * Baideng'de yalnızca gövde sayılır; kırılışını baideng.ts yönetir.
 */
export function routLimit(index: number): number {
  const cfg = waveConfig(index)
  return Math.floor((cfg.baideng ? swarmSize(cfg.enemyCount) : cfg.enemyCount) * ROUT_SHARE)
}

/** Dalga temizlendikten sonra yenisi doğmadan önceki mola (sn); dinlenmeli molada uzun. */
export function waveBreak(nextIndex: number): number {
  return waveConfig(nextIndex).rest ? 3 : 1.5
}

/** Yeni dalga doğarken dönen can (en çok tam cana kadar). */
export function restHealth(health: number, nextIndex: number): number {
  return Math.min(COMBAT_CONFIG.playerMaxHealth, health + (waveConfig(nextIndex).rest ?? 0))
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
 * Bot taraması (üç dalgalı oyun, 4 beceri × 5 basamak × 40 tohum): vuruş hep 6,
 * en büyük vuruş 29–31, düşürülen 71–79/80, süre 71–91 sn — beceriyi ayırmıyor.
 * Ayıran tek şey alınan yara. Ama merdiven onu ölçekliyor: aynı uzman koşusu
 * yarı hasarda 63, tam hasarda 27 canla bitiyor. `taken / scale` (tam hasar
 * karşılığı yara) ise basamaktan bağımsız: tohum 1 beş basamakta da 70.
 *
 * Baideng öncesi mola canı tam hasar karşılığına katılır: tam hasarda molaya
 * daha az canla girilir, mola o yüzden daha çok can döndürür (tavan 100).
 * Böylece ölçü yine basamaktan bağımsız (uzman medyanı beş basamakta 31–34).
 * Tam hasarda molaya ölü varılırdıysa mola sayılmaz: 1 yıldız.
 *
 * Kazananlarda tam hasar karşılığı kalan can, p10/p50/p90 (dört dalga):
 * uzman 3/31/46, iyi −66/−29/23, orta −98/−13/67 (eksi: tam hasarda ölürdü).
 *
 * Eşikler bu dağılımdan: 2 yıldız "tam hasarda da ayakta kalırdın", 3 yıldız
 * 35. Yarı hasarda 30 tohum: uzman 30 zaferin 28'i 2+, 13'ü 3 yıldız; iyi 19
 * zaferin yalnızca 1'i 2 yıldız; orta 7 zaferin 1'i şanslı bir koşuyla 3 —
 * Malazgirt'in imparatoru gibi uzmanın da her seferinde alamadığı an.
 *
 * @param health Zaferde kalan can (0–100).
 * @param scale Oynanan basamağın hasar çarpanı (ladderScale), 0.5–1.
 * @param preRest Molaya girerkenki can; mola yoksa (yenilgi öncesi) verilmez.
 */
export function wavesStars(health: number, scale: number, preRest?: number): number {
  const full = fullDamageHealth(health, scale, preRest) + FLOAT_SLACK
  if (full >= WAVES_STAR_HEALTH[3]) return 3
  if (full >= WAVES_STAR_HEALTH[2]) return 2
  return 1
}

/**
 * wavesStars'ın tersi: `stars` yıldız için bu basamakta zaferde kalması
 * gereken can. Tam hasarda molaya varılamazdıysa yıldız bu savaşta yok: Infinity.
 */
export function wavesStarHealth(stars: 2 | 3, scale: number, preRest?: number): number {
  const target = WAVES_STAR_HEALTH[stars]
  if (preRest === undefined) return Math.ceil(MAX_HEALTH - (MAX_HEALTH - target) * scale - FLOAT_SLACK)
  const { rested, fullPreRest, fullRested } = restPair(preRest, scale)
  if (fullPreRest <= 0) return Infinity
  return Math.ceil(rested - (fullRested - target) * scale - FLOAT_SLACK)
}

const MAX_HEALTH = COMBAT_CONFIG.playerMaxHealth
/** Eşik ve tersi kayan noktada ayrışmasın (34.999… ≠ 35, 48.000…1 → 49). */
const FLOAT_SLACK = 1e-9
/** Molanın geldiği dalga. */
const REST_WAVE = WAVES.findIndex((w) => w.rest)

/** Zaferde kalan canın tam hasar karşılığı (eksi: tam hasarda ölürdü). */
function fullDamageHealth(health: number, scale: number, preRest?: number): number {
  if (preRest === undefined) return MAX_HEALTH - (MAX_HEALTH - health) / scale
  const { rested, fullPreRest, fullRested } = restPair(preRest, scale)
  // Tam hasarda molaya varılamazdı: mola ölüyü diriltmez.
  if (fullPreRest <= 0) return fullPreRest
  return fullRested - (rested - health) / scale
}

/** Moladan çıkan can: bu basamakta ve tam hasarda. */
function restPair(preRest: number, scale: number) {
  const fullPreRest = MAX_HEALTH - (MAX_HEALTH - preRest) / scale
  return { rested: restHealth(preRest, REST_WAVE), fullPreRest, fullRested: restHealth(fullPreRest, REST_WAVE) }
}
