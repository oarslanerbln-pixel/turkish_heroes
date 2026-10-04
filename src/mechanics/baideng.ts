// Baideng (MÖ 200): Metehan'ın dördüncü ve son dalgası.
//
// Shiji 110: Mete zayıf görünen öncülerle Han imparatoru Gaozu'yu peşine
// taktı ve Baideng'de yedi gün kuşattı; dört yanı dört renk atlıyla tutuldu
// (batı ak, doğu boz, kuzey kara, güney kızıl). Kuşatma barışla bitti, Gaozu
// esir düşmedi. Oyundaki karşılığı üç parça:
//
//  1. Gövde: Han süvarisi her dalga gibi kovalar; peşine takıp kuşatılır.
//  2. Komuta grubu: Gaozu ve arbaletli muhafızları geride, yayın menzili
//     dışında durur ve oyuncunun gideceği yere ok yağdırır: önce yerde halka,
//     sonra oklar. Kaçış çemberini düz çizen halkaya girer; yön değiştirmek
//     gerekir. Oklar halkadaki Han atlılarını da vurur: peşindeki sürüyü
//     halkanın üstünden geçiren oyuncu yağmuru Han'ın kendisine indirir.
//     Muhafız düştükçe yağmur seyrekleşir.
//  3. Gövde kırılınca dört renkli atlılar dört yandan gelir ve komuta
//     grubunun çevresinde çemberi kapatır. Muhafızlar paniğe kapılıp sıkışır;
//     son muhafız da düşünce Gaozu barış ister. Gaozu hep korunur, hiç düşmez.
//
// Kurallar saf: yönetmen (sim/scenarios.ts) ve botlar (waveBots.ts) aynı
// fonksiyonları çağırır, denge taraması oyunun kendisini ölçer.

import { createEnemies, steerToward } from './enemySim'
import type { Enemy, Vec2 } from './types'

export const BAIDENG = {
  /** Gaozu'nun çevresindeki arbaletli muhafız sayısı. */
  guards: 8,
  /** Muhafızların Gaozu'ya uzaklığı. */
  guardRing: 2.2,
  /**
   * Gaozu oyuncuya bundan yakın gelmek istemez: yayın dış yarıçapı (13) ve
   * kaçış çemberinin dışında. 15'te komuta grubu çemberin üstüne düşüyor,
   * oyuncunun yolunu tıkıyordu.
   */
  commandStandoff: 18,
  commandSpeed: 2.2,
  guardSpeed: 4,
  /** Muhafızların tamamı ayaktayken iki yağmur arası (sn); azaldıkça uzar. */
  volleyInterval: 6,
  /** Dalga doğduktan sonra ilk yağmura kadar (sn): oyuncu önce gövdeyi görsün. */
  firstVolley: 6,
  /** Halka belirdikten okların düşmesine kadar (sn). */
  volleyTelegraph: 1.2,
  volleyRadius: 2.6,
  /** Halkada yakalanan oyuncunun yarası (tam hasar; merdivenle ölçeklenir). */
  volleyDamage: 14,
  /**
   * Halka oyuncunun telegraf süresi sonraki tahmini yerine bu payla düşer:
   * 1 tam isabet olurdu, 0 bulunduğu yere. Düz koşan oyuncu yarı yolda yakalanır.
   */
  volleyLead: 0.8,
  /** Gövde kırılma eşiği: vuruştan sonra en fazla bu payı ayaktaysa bozguna uğrar. */
  routShare: 0.15,
  /** Dört renkli çemberin yarıçapı: dört yandan gelir, komuta grubunu sıkıştırır. */
  ringFrom: 30,
  ringTo: 4.5,
  /** Çemberin kapanma süresi (sim sn). */
  ringClose: 6,
  /** Çember kapanırken muhafızların oyuncudan kaçış hızı. */
  fleeSpeed: 4,
} as const

/** Gövde birlik 0, komuta grubu birlik 1 (calcSiegeState ayrı ölçer). */
export const SWARM = 0
export const COMMAND = 1

export interface Volley {
  x: number
  z: number
  /** Okların düşmesine kalan süre (sn). */
  left: number
}

export interface Ring {
  center: Vec2
  /** Çemberin kuruluşundan beri geçen süre (sim sn). */
  t: number
}

export interface BaidengState {
  /** Gövdenin doğuştaki sayısı (bozgun eşiği bundan). */
  swarm: number
  volleys: Volley[]
  volleyTimer: number
  ring: Ring | null
  peace: boolean
  /** Kendi yaylımlarının altında düşen Han atlıları. */
  felled: number
}

export type BaidengEvent =
  | { type: 'volleyAimed'; x: number; z: number }
  /** hit: oyuncu halkadaydı; felled: halkada düşen Han atlıları. */
  | { type: 'volleyLanded'; x: number; z: number; hit: boolean; felled: Enemy[] }
  | { type: 'encircle'; center: Vec2; routed: number }
  | { type: 'peace' }

/**
 * Baideng ordusu varsayılan dizilişte (-z): gövde öndeki yayda, Gaozu ve
 * muhafızları gövdenin arkasında. spawnWave hepsini birlikte döndürür.
 */
export function createBaidengArmy(count: number): Enemy[] {
  const enemies = createEnemies(swarmSize(count))
  for (const e of enemies) e.corps = SWARM
  const at: Vec2 = { x: 0, z: -25 }
  const emperor = soldier(enemies.length, at)
  emperor.emperor = true
  emperor.guarded = true
  enemies.push(emperor)
  for (let i = 0; i < BAIDENG.guards; i++) {
    const g = soldier(enemies.length, guardSlot(at, i, { x: 0, z: 0 }))
    g.guard = true
    enemies.push(g)
  }
  return enemies
}

/** Dalganın gövdesi: Gaozu ve muhafızları dışındakiler. */
export function swarmSize(count: number): number {
  return count - 1 - BAIDENG.guards
}

export function createBaidengState(count: number): BaidengState {
  return {
    swarm: swarmSize(count),
    volleys: [],
    volleyTimer: BAIDENG.firstVolley,
    ring: null,
    peace: false,
    felled: 0,
  }
}

function soldier(id: number, pos: Vec2): Enemy {
  return { id, pos: { ...pos }, vel: { x: 0, z: 0 }, alive: true, discipline: 1, corps: COMMAND }
}

const slot: Vec2 = { x: 0, z: 0 }

/** i. muhafızın Gaozu çevresindeki yeri; halka oyuncuya bakan yandan başlar. */
function guardSlot(emperor: Vec2, i: number, out: Vec2): Vec2 {
  const a = (i / BAIDENG.guards) * Math.PI * 2
  out.x = emperor.x + Math.sin(a) * BAIDENG.guardRing
  out.z = emperor.z + Math.cos(a) * BAIDENG.guardRing
  return out
}

export function isCommand(e: Enemy): boolean {
  return e.corps === COMMAND
}

/** Enerjiyi besleyen küme: önce gövde, çember kurulunca komuta grubu. */
export function siegeCorps(s: BaidengState): number {
  return s.ring ? COMMAND : SWARM
}

/** Çemberin o anki yarıçapı. */
export function ringRadius(ring: Ring): number {
  const p = Math.min(1, ring.t / BAIDENG.ringClose)
  const eased = p * p * (3 - 2 * p)
  return BAIDENG.ringFrom + (BAIDENG.ringTo - BAIDENG.ringFrom) * eased
}

export function ringClosed(ring: Ring): boolean {
  return ring.t >= BAIDENG.ringClose
}

function aliveGuards(enemies: readonly Enemy[]): number {
  let n = 0
  for (const e of enemies) if (e.alive && e.guard) n++
  return n
}

const flee: Vec2 = { x: 0, z: 0 }

/**
 * Komuta grubunu bir kare ilerletir (gövdeyi stepEnemies yürütür). Çember
 * yokken Gaozu oyuncuyla mesafesini korur, muhafızlar yanında; çember
 * kurulunca hepsi oyuncudan kaçar ama çemberin içinde kalır.
 */
export function stepCommand(s: BaidengState, enemies: Enemy[], player: Vec2, dt: number): void {
  const emperor = enemies.find((e) => e.emperor && e.alive)
  if (!emperor) return
  if (s.ring) {
    s.ring.t += dt
    const r = ringRadius(s.ring) - 0.6
    for (const e of enemies) {
      if (!e.alive || !isCommand(e)) continue
      e.discipline = 0
      const dx = e.pos.x - player.x
      const dz = e.pos.z - player.z
      const d = Math.hypot(dx, dz) || 1
      flee.x = e.pos.x + (dx / d) * 10
      flee.z = e.pos.z + (dz / d) * 10
      steerToward(e, enemies, flee, BAIDENG.fleeSpeed, 0, dt)
      confine(e, s.ring.center, r)
    }
    return
  }
  steerToward(emperor, enemies, player, BAIDENG.commandSpeed, BAIDENG.commandStandoff, dt)
  let i = 0
  for (const e of enemies) {
    if (!e.alive || !e.guard) continue
    steerToward(e, enemies, guardSlot(emperor.pos, i++, slot), BAIDENG.guardSpeed, 0, dt)
  }
}

function confine(e: Enemy, center: Vec2, r: number): void {
  const dx = e.pos.x - center.x
  const dz = e.pos.z - center.z
  const d = Math.hypot(dx, dz)
  if (d <= r || d === 0) return
  e.pos.x = center.x + (dx / d) * r
  e.pos.z = center.z + (dz / d) * r
}

/**
 * Ok yağmurunu bir kare ilerletir. Halkadaki Han atlıları düşer.
 * @returns bu karede düşen okların tam hasar cinsinden yarası.
 */
export function stepVolleys(
  s: BaidengState,
  enemies: Enemy[],
  player: Vec2,
  playerVel: Vec2,
  dt: number,
  events: BaidengEvent[],
): number {
  let damage = 0
  for (let i = s.volleys.length - 1; i >= 0; i--) {
    const v = s.volleys[i]
    v.left -= dt
    if (v.left > 0) continue
    const hit = Math.hypot(player.x - v.x, player.z - v.z) <= BAIDENG.volleyRadius
    if (hit) damage += BAIDENG.volleyDamage
    const felled: Enemy[] = []
    for (const e of enemies) {
      if (!e.alive || e.routed || e.corps !== SWARM) continue
      if (Math.hypot(e.pos.x - v.x, e.pos.z - v.z) > BAIDENG.volleyRadius) continue
      e.alive = false
      felled.push(e)
    }
    s.felled += felled.length
    events.push({ type: 'volleyLanded', x: v.x, z: v.z, hit, felled })
    s.volleys.splice(i, 1)
  }
  const guards = aliveGuards(enemies)
  if (s.ring || guards === 0) return damage
  s.volleyTimer -= dt * (guards / BAIDENG.guards)
  if (s.volleyTimer > 0) return damage
  s.volleyTimer = BAIDENG.volleyInterval
  const lead = BAIDENG.volleyTelegraph * BAIDENG.volleyLead
  const v: Volley = {
    x: player.x + playerVel.x * lead,
    z: player.z + playerVel.z * lead,
    left: BAIDENG.volleyTelegraph,
  }
  s.volleys.push(v)
  events.push({ type: 'volleyAimed', x: v.x, z: v.z })
  return damage
}

/**
 * Vuruştan sonra: gövde kırıldıysa artığı bozguna uğrar ve çember kurulur
 * (Gaozu'nun yerinde). Komuta grubu zaten çemberdeyse ve son muhafız da
 * düştüyse Gaozu barış ister — vuruşla da, çember kapanınca da (stepPeace).
 */
export function afterBaidengStrike(s: BaidengState, enemies: Enemy[], events: BaidengEvent[]): void {
  if (s.ring) return
  let n = 0
  for (const e of enemies) if (e.alive && !e.routed && e.corps === SWARM) n++
  if (n > Math.floor(s.swarm * BAIDENG.routShare)) return
  for (const e of enemies) if (e.alive && e.corps === SWARM) e.routed = true
  const emperor = enemies.find((e) => e.emperor && e.alive)
  if (!emperor) return
  s.ring = { center: { x: emperor.pos.x, z: emperor.pos.z }, t: 0 }
  s.volleys.length = 0
  events.push({ type: 'encircle', center: s.ring.center, routed: n })
}

/** Çember kapandı ve muhafız kalmadı: Gaozu barış ister, savaş alanından çekilir. */
export function stepPeace(s: BaidengState, enemies: Enemy[], events: BaidengEvent[]): void {
  if (s.peace || !s.ring || !ringClosed(s.ring) || aliveGuards(enemies) > 0) return
  s.peace = true
  for (const e of enemies) {
    if (!e.alive) continue
    e.alive = false
    e.fled = true
  }
  events.push({ type: 'peace' })
}
