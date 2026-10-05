// Metehan'ın dalgalı savaşı için headless oyun döngüsü ve test botları.
//
// Döngü oyunun adımını (sim/step.ts) sabit adımla çağırır: kurallar oyundakinin
// aynısı (vuruş sonrası donma, Baideng yaylımları, dalga geçişi). Metehan'ın
// dalgalarında rastgelelik yok; dağılım oyuncudan gelir. Botlar bu yüzden insan
// gibi kusurlu: tohumlu gürültüyle direksiyon hatası ve vuruşta tepki gecikmesi
// var — aynı "beceri" tohumdan tohuma farklı sonuç verir, eşikler olasılıkla
// ölçülür. Oyun kodu bu dosyayı içe aktarmaz.

import { HILAL_CONFIG, isStrikeReady } from './hilalSystem'
import { mulberry32 } from './random'
import type { Enemy, Vec2 } from './types'
import { BAIDENG, createBaidengState, type Volley } from './baideng'
import { spawnWave, waveConfig } from './waves'
import type { TelemetryEvent } from '../telemetry/summary'
import { wavesScenario } from '../sim/scenarios'
import { battleEnd, SILENT_FX, stepGame, type StepEffects, type StepInput } from '../sim/step'
import { createWorld } from '../sim/world'

export const WAVE_BOT_DT = 1 / 60
/** Hiçbir bot bundan uzun oynamaz (sonsuz döngü sigortası). */
const MAX_TIME = 600

export interface WaveView {
  enemies: readonly Enemy[]
  player: Vec2
  energy: number
  inCrescent: number
  health: number
  waveIndex: number
  time: number
  /** Baideng: düşmesi beklenen ok yağmurları (yerdeki halkalar). */
  volleys: readonly Volley[]
  /** Baideng: dört renkli çemberin merkezi; çember kurulmadıysa null. */
  focus: Vec2 | null
}

export interface WaveAction {
  move: Vec2
  strike: boolean
}

export type WaveBot = (view: WaveView) => WaveAction

export interface WaveRun {
  result: 'victory' | 'defeat'
  health: number
  kills: number
  time: number
  /** Ulaşılan dalga (0 tabanlı). */
  wave: number
  /** Yenilgide sahada kalan düşman. */
  remaining: number
  strikes: number[]
  /** Zaferde wavesStars (merdiven basamağı damageScale), yenilgide 0. */
  stars: number
}

/**
 * @param record Oyundaki olay takibiyle aynı olaylar (savaş karnesi testleri
 *   bot koşusunu oyuncunun özetine böyle çevirir). t: oyun süresi (sn).
 * @param rout false: bozgun kuralı olmadan (önce/sonra karşılaştırması için).
 * @param spawnAway false: dalgalar eskisi gibi hep aynı yerde doğar.
 * @param damageScale Hasar çarpanı: zorluk merdiveninin basamağı (world.assist).
 * @param startWave Bu dalgadan, tam canla başlar (tek dalgayı ölçmek için).
 */
export function runWaves(
  bot: WaveBot,
  record?: (e: TelemetryEvent, t: number) => void,
  rout = true,
  spawnAway = true,
  damageScale = 1,
  startWave = 0,
): WaveRun {
  const w = createWorld('metehan')
  w.assist = damageScale
  if (startWave > 0) {
    const first = waveConfig(startWave)
    w.waveIndex = startWave
    w.enemies = spawnWave(startWave)
    w.baideng = first.baideng ? createBaidengState(first.enemyCount) : null
  }
  const scenario = wavesScenario({ rout, spawnAway })
  let kills = 0
  const strikes: number[] = []
  const fx: StepEffects = {
    ...SILENT_FX,
    track(e) {
      if (e.type === 'strike') {
        strikes.push(e.kills)
        kills += e.kills
      }
      record?.(e, w.time)
    },
  }
  const input: StepInput = { move: { x: 0, z: 0 }, strike: false }
  const view: WaveView = {
    enemies: w.enemies,
    player: w.player,
    energy: 0,
    inCrescent: 0,
    health: w.playerHealth,
    waveIndex: w.waveIndex,
    time: 0,
    volleys: [],
    focus: null,
  }

  record?.({ type: 'battle_start', commander: 'metehan', attempt: 1, assist: damageScale, seed: null }, 0)

  while (w.outcome === 'playing' && w.time < MAX_TIME) {
    view.enemies = w.enemies
    view.energy = w.energy
    view.inCrescent = w.inCrescent
    view.health = w.playerHealth
    view.waveIndex = w.waveIndex
    view.time = w.time
    view.volleys = w.baideng?.volleys ?? []
    view.focus = w.baideng?.ring?.center ?? null
    const action = bot(view)

    // Botun hızı oyuncunun çubuğuna çevrilir (retreatSpeed = tam itiş).
    input.move.x = action.move.x / HILAL_CONFIG.retreatSpeed
    input.move.z = action.move.z / HILAL_CONFIG.retreatSpeed
    input.strike = action.strike
    stepGame(w, input, WAVE_BOT_DT, fx, scenario)
    // Oyunda karenin sonunda boşalır (EventFlush).
    w.events.length = 0
  }

  const end = battleEnd(w)
  record?.(end, w.time)
  // Süre sigortası atarsa yenilgi sayılır.
  const result = w.outcome === 'victory' ? 'victory' : 'defeat'
  return {
    result,
    health: w.playerHealth,
    kills,
    time: w.time,
    wave: w.waveIndex,
    remaining: end.remaining,
    strikes,
    stars: result === 'victory' ? w.stars : 0,
  }
}

// ——— Botlar ———

export interface KiterSkill {
  /** Çizilen çemberin yarıçapı. */
  radius: number
  /** Enerji dolduktan sonra vuruşa basma gecikmesi (sn), ortalama. */
  reaction: number
  /** Yayda en az bu kadar düşman varsa vurur (beklemeye sabrı biterse 1). */
  minStrike: number
  /** Hazır enerjiyle en fazla bu kadar bekler, sonra kim varsa vurur (sn). */
  patience: number
  /** Direksiyon hatası: yön sapmasının standart sapması (radyan). */
  wobble: number
  /** Kötü hamle olasılığı: saniyede bu oranla 0,4 sn kümenin üstüne yürür. */
  blunder: number
  /** Enerji dolmadan basma alışkanlığı: saniyede bu oranla boşa basar. */
  mash: number
}

export const SKILLS = {
  /** Kusursuza yakın: geniş çember, anında tepki, hata yok. */
  expert: { radius: 14, reaction: 0.1, minStrike: 8, patience: 2, wobble: 0.05, blunder: 0, mash: 0 },
  /** İyi oyuncu: arada gecikir, direksiyonu biraz dalgalı. */
  skilled: { radius: 14, reaction: 0.3, minStrike: 6, patience: 2.5, wobble: 0.15, blunder: 0.03, mash: 0.05 },
  /** Orta: taktiği anlamış ama geç basıyor, arada yanlış yöne kaçıyor. */
  average: { radius: 13, reaction: 0.5, minStrike: 4, patience: 3, wobble: 0.3, blunder: 0.08, mash: 0.2 },
  /** Acemi: dar çember, enerji dolmadan basıyor, sık hata. */
  novice: { radius: 11, reaction: 0.8, minStrike: 2, patience: 3, wobble: 0.45, blunder: 0.15, mash: 0.6 },
} as const satisfies Record<string, KiterSkill>

/** Tohumlu normal dağılım (Box–Muller). */
function gaussian(rand: () => number): number {
  const u = Math.max(1e-9, rand())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

/**
 * Atlı okçu: arena merkezi çevresinde çember çizerek sürüyü peşinde sürükler,
 * hilal dolunca yay yeterince doluysa vurur. Kusurları `skill` ve tohumdan.
 */
export function kiter(skill: KiterSkill, seed: number): WaveBot {
  const rand = mulberry32(seed)
  // Her oyuncunun kendi yönü: kimi saat yönünde döner, kimi tersine.
  const spin = rand() < 0.5 ? 1 : -1
  let readySince = -1
  let delay = 0
  let blunderUntil = -1
  let wobble = 0
  /** Her ok yağmurunu fark etme gecikmesi (sn). */
  const noticeDelay = new WeakMap<Volley, number>()
  return (v) => {
    const dt = WAVE_BOT_DT

    // Yön: teğet + yarıçapa dönüş, üstüne yavaş değişen direksiyon hatası.
    // Baideng çemberi kurulunca çember merkezinin çevresinde, yay menzilinde.
    const cx = v.focus?.x ?? 0
    const cz = v.focus?.z ?? 0
    const radius = v.focus ? FOCUS_RADIUS : skill.radius
    const r = Math.hypot(v.player.x - cx, v.player.z - cz) || 1
    const ux = (v.player.x - cx) / r
    const uz = (v.player.z - cz) / r
    const radial = Math.max(-1, Math.min(1, (radius - r) / 3))
    let mx = -uz * spin + ux * radial
    let mz = ux * spin + uz * radial
    wobble += (gaussian(rand) * skill.wobble - wobble) * Math.min(1, 2 * dt)
    const cos = Math.cos(wobble)
    const sin = Math.sin(wobble)
    ;[mx, mz] = [mx * cos - mz * sin, mx * sin + mz * cos]

    // Kötü hamle: kümenin üstüne yürümek (kaçmayı unutmak).
    if (blunderUntil < v.time && rand() < skill.blunder * dt) blunderUntil = v.time + 0.4
    if (v.time < blunderUntil) {
      const c = centroid(v.enemies)
      if (c) {
        mx = c.x - v.player.x
        mz = c.z - v.player.z
      }
    }
    // Ok yağmuru: halkayı tepki gecikmesiyle fark eder. İçindeyse dışarı
    // kaçar; kenarındaysa halkaya giren bileşeni atıp kenar boyunca dolanır
    // (yalnız dışarı itilse çember onu yine içeri çeker, sınırda titrerdi).
    for (const vol of v.volleys) {
      let delay = noticeDelay.get(vol)
      if (delay === undefined) {
        delay = skill.reaction * (0.5 + rand())
        noticeDelay.set(vol, delay)
      }
      if (BAIDENG.volleyTelegraph - vol.left < delay) continue
      const dx = v.player.x - vol.x
      const dz = v.player.z - vol.z
      const d = Math.hypot(dx, dz)
      if (d > BAIDENG.volleyRadius + DODGE_MARGIN) continue
      if (d < 0.01) {
        ;[mx, mz] = [-mz, mx]
        continue
      }
      const ox = dx / d
      const oz = dz / d
      if (d < BAIDENG.volleyRadius + DODGE_MARGIN / 2) {
        ;[mx, mz] = [ox, oz]
        continue
      }
      const inward = -(mx * ox + mz * oz)
      if (inward > 0) {
        mx += ox * inward
        mz += oz * inward
      }
    }

    const ml = Math.hypot(mx, mz) || 1
    const move = { x: (mx / ml) * HILAL_CONFIG.retreatSpeed, z: (mz / ml) * HILAL_CONFIG.retreatSpeed }

    // Vuruş: dolunca tepki gecikmesi, sonra yay yeterince doluysa ya da sabır bitince.
    let strike = false
    if (isStrikeReady(v.energy)) {
      if (readySince < 0) {
        readySince = v.time
        delay = skill.reaction * (0.5 + rand())
      }
      const waited = v.time - readySince
      if (waited >= delay) {
        strike = v.inCrescent >= skill.minStrike || (waited >= skill.patience && v.inCrescent > 0)
      }
    } else {
      readySince = -1
      strike = rand() < skill.mash * dt
    }
    return { move, strike }
  }
}

/** Çember kurulunca botun çember merkezine uzaklığı: yayın menzilinde. */
const FOCUS_RADIUS = 9
/** Halkanın bu kadar dışına kadar kaç. */
const DODGE_MARGIN = 0.8

function centroid(enemies: readonly Enemy[]): Vec2 | null {
  let x = 0
  let z = 0
  let n = 0
  for (const e of enemies) {
    if (!e.alive) continue
    x += e.pos.x
    z += e.pos.z
    n++
  }
  return n > 0 ? { x: x / n, z: z / n } : null
}

/** Aynı beceriyle `n` farklı oyuncu (tohum 1..n). */
export function sweepWaves(skill: KiterSkill, seeds: readonly number[]): WaveRun[] {
  return seeds.map((s) => runWaves(kiter(skill, s)))
}
