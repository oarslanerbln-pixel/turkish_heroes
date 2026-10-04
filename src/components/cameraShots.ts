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

/** Gün batımı: alçalış, bekleyiş, dönüş (sn). */
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
  if (t < DUSK_RISE) return smoothstep(t / DUSK_RISE)
  if (t < DUSK_RISE + DUSK_HOLD) return 1
  return 1 - smoothstep((t - DUSK_RISE - DUSK_HOLD) / DUSK_FALL)
}

/** Çekim bitti mi — kamera taktik duruşa tamamen döndü. */
export function shotDone(cue: CameraCue, t: number): boolean {
  return cue === 'intro' ? t >= INTRO_TIME : t >= DUSK_RISE + DUSK_HOLD + DUSK_FALL
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
