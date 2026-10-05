// Sinematik çekimler: kamera taktik duruşundan ayrılıp geri döner.
//
// Taktik kamera yukarıdan bakar; mesafeyi okumak için gereken bu. Ama o açıda
// ufuk kadraja giremez — "Bizans ordusu ufukta" ve gün batımı ancak kamera
// alçalınca görünür. Çekim kısa sürer ve oyuncu bu sırada da oynayabilir.
// Ağırlık 0 = taktik, 1 = tam sinematik duruş.

import type { Vector3 } from 'three'
import type { CameraCue } from '../sim/world'

/** Açılış: ordugahın ardından ufka bakış, sonra taktik duruşa yükseliş (sn). */
export const INTRO_TIME = 2.8

/**
 * Savaş açılışı (bir savaşa oturumda ilk girişte, MIMARI.md §8): menü
 * karesinden ordugahın üstünden düşman cephesine uçuş, cephe karşısında kısa
 * bekleyiş, sonra taktik duruşa yükseliş (sn). R3 anından (6 sn) önce biter.
 */
export const OPENING_PUSH = 2.6
export const OPENING_RISE = 3.1
export const OPENING_TIME = 5
/** Uçuş ordugahın ve kendi ordusunun üstünden geçerken ek yükseklik. */
const OPENING_ARC = 4
/** Kamera hep cepheye doğru süzülür (birim/sn): bekleyişte de sahne kıpırdar. */
const OPENING_DRIFT = 0.8
/** Cephe karşısı: kamera öncünün bu kadar önünde, alçakta; orduya ve ardındaki ufka bakar. */
const REVEAL_LEAD = 14
const REVEAL_SIDE = 4
/** Yana açılış cephenin yarı genişliğinin bu payı (en çok REVEAL_SIDE). */
const REVEAL_SIDE_SHARE = 0.25
const REVEAL_HEIGHT = 4
const REVEAL_LOOK_HEIGHT = 1.2
/** Ordu bundan yakınsa ya da hiç yoksa uçuş menü karesinin baktığı yere gider. */
const REVEAL_MIN_DISTANCE = 8

/** Gün batımı (ve Baideng'in vinç çekimi): alçalış, bekleyiş, dönüş (sn). */
export const DUSK_RISE = 0.9
export const DUSK_HOLD = 1.8
export const DUSK_FALL = 1.5

/** Kesilen çekimden yenisine geçiş (sn): son çizilen duruştan süzülür (K3). */
export const BLEND_TIME = 1

export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** Çekim başlayalı `t` saniye geçtiğinde sinematik duruşun ağırlığı. */
export function shotWeight(cue: CameraCue, t: number): number {
  if (cue === 'intro') {
    // İlk an kısa bir duraksama: oyuncu kadrajı görsün, sonra yükselsin.
    return 1 - smoothstep((t - 0.4) / (INTRO_TIME - 0.4))
  }
  if (cue === 'opening') return 1 - smoothstep((t - OPENING_RISE) / (OPENING_TIME - OPENING_RISE))
  if (t < DUSK_RISE) return smoothstep(t / DUSK_RISE)
  if (t < DUSK_RISE + DUSK_HOLD) return 1
  return 1 - smoothstep((t - DUSK_RISE - DUSK_HOLD) / DUSK_FALL)
}

/** Çekim bitti mi — kamera taktik duruşa tamamen döndü. */
export function shotDone(cue: CameraCue, t: number): boolean {
  if (cue === 'intro') return t >= INTRO_TIME
  if (cue === 'opening') return t >= OPENING_TIME
  return t >= DUSK_RISE + DUSK_HOLD + DUSK_FALL
}

interface XZ {
  x: number
  z: number
}

/** Açılış uçuşunun iki ucu ve cepheye doğru yatay birim yön. */
export interface OpeningPath {
  /** Menü karesi: SAVAŞA GİR'den sonra uçuş buradan kesmesiz başlar. */
  start: Pose
  reveal: Pose
  dir: Vector3
}

/**
 * Uçuşun varacağı cephe karşısını kurar (`path.start` dolu olmalı). Kamera
 * düşmanın öncüsünün önünde, oyuncu tarafında durur ve ordunun ortasına bakar:
 * ordu ufka karşı görünür (STIL.md §9). Uzun bir kolda (geçit) da öncünün
 * önünde kalır, kolun içine gömülmez.
 */
export function planOpening(path: OpeningPath, player: XZ, enemies: readonly { pos: XZ; alive: boolean }[]): void {
  const { start, reveal, dir } = path
  let n = 0
  let cx = 0
  let cz = 0
  for (const e of enemies) {
    if (!e.alive) continue
    cx += e.pos.x
    cz += e.pos.z
    n++
  }
  if (n > 0) {
    cx /= n
    cz /= n
  }
  if (n === 0 || Math.hypot(cx - player.x, cz - player.z) < REVEAL_MIN_DISTANCE) {
    cx = start.look.x
    cz = start.look.z
  }
  dir.set(cx - player.x, 0, cz - player.z).normalize()
  const center = (cx - player.x) * dir.x + (cz - player.z) * dir.z
  let lead = center
  let spread = 0
  for (const e of enemies) {
    if (!e.alive) continue
    lead = Math.min(lead, (e.pos.x - player.x) * dir.x + (e.pos.z - player.z) * dir.z)
    spread = Math.max(spread, Math.abs((e.pos.x - cx) * dir.z - (e.pos.z - cz) * dir.x))
  }
  const along = Math.max(0, lead - REVEAL_LEAD)
  // Yana açılış menü karesinin tarafında (sağda): uçuş yön değiştirmez. Geniş
  // cephe çaprazdan görünür; dar kolda (geçit) kamera eksende kalır, yamaca yaslanmaz.
  const side = Math.min(REVEAL_SIDE, spread * REVEAL_SIDE_SHARE)
  reveal.pos.set(player.x + dir.x * along - dir.z * side, REVEAL_HEIGHT, player.z + dir.z * along + dir.x * side)
  reveal.look.set(cx, REVEAL_LOOK_HEIGHT, cz)
}

/** Açılış uçuşunun `t` anındaki sinematik duruşu; taktiğe dönüşü ağırlık (shotWeight) yapar. */
export function openingPose(path: OpeningPath, t: number, out: Pose): void {
  const u = smoothstep(t / OPENING_PUSH)
  out.pos.lerpVectors(path.start.pos, path.reveal.pos, u)
  out.look.lerpVectors(path.start.look, path.reveal.look, u)
  out.pos.y += Math.sin(Math.PI * u) * OPENING_ARC
  const drift = t * OPENING_DRIFT
  out.pos.addScaledVector(path.dir, drift)
  out.look.addScaledVector(path.dir, drift)
}

/** Süren çekim: senaryonun işaretleri ya da ok kamerası (arrowShot.ts). */
export type ShotCue = CameraCue | 'arrow'

/** Kameranın konumu ve baktığı nokta. */
export interface Pose {
  pos: Vector3
  look: Vector3
}

/** Yönetmenin çekim durumu (bkz. CameraDirector). */
export interface ShotState {
  cue: ShotCue | null
  /** Çekim başlayalı geçen gerçek süre. */
  t: number
  /** Geçişin başladığı duruş: çekim kesildiği an çizilen kare. */
  from: Pose
  /** Geçiş başlayalı geçen süre; BLEND_TIME'a varınca geçiş yok. */
  blend: number
}

export function createShotState(from: Pose): ShotState {
  return { cue: null, t: 0, from, blend: BLEND_TIME }
}

/**
 * Yeni çekim. Süren bir çekimi keserse eğri baştan başlar; kamera oraya
 * atlamasın diye son çizilen duruştan süzülür.
 */
export function startShot(s: ShotState, cue: ShotCue, rendered: Pose): void {
  if (s.cue) beginBlend(s, rendered)
  s.cue = cue
  s.t = 0
}

/**
 * Çekimi ve geçişi iptal eder: yeni savaşta, menüde ve hareketi azaltta kamera
 * süzülmeden taktik kadraja oturur.
 */
export function resetShot(s: ShotState): void {
  s.cue = null
  s.blend = BLEND_TIME
}

/** Oyuncu dokundu: çekim biter, kamera son çizilen duruştan taktik kadraja süzülür. */
export function skipShot(s: ShotState, rendered: Pose): void {
  if (!s.cue) return
  beginBlend(s, rendered)
  s.cue = null
}

function beginBlend(s: ShotState, rendered: Pose): void {
  s.from.pos.copy(rendered.pos)
  s.from.look.copy(rendered.look)
  s.blend = 0
}

/** Geçiş sürüyorsa `pose`'u başladığı duruşla karıştırır. */
export function applyBlend(s: ShotState, dt: number, pose: Pose): void {
  if (s.blend >= BLEND_TIME) return
  s.blend = Math.min(BLEND_TIME, s.blend + dt)
  const k = smoothstep(s.blend / BLEND_TIME)
  pose.pos.lerpVectors(s.from.pos, pose.pos, k)
  pose.look.lerpVectors(s.from.look, pose.look, k)
}
