import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import type { CameraCue } from '../sim/world'
import {
  BLEND_TIME,
  DUSK_FALL,
  DUSK_HOLD,
  DUSK_RISE,
  INTRO_TIME,
  applyBlend,
  createShotState,
  shotDone,
  shotWeight,
  skipShot,
  startShot,
  type Pose,
} from './cameraShots'

const pose = (x: number, y: number, z: number): Pose => ({ pos: new Vector3(x, y, z), look: new Vector3(x, 0, z - 20) })

/**
 * CameraDirector'ın çekim adımlarını sabit duruşlarla oynatır; her karenin
 * kamera konumunu döner. `cutAt` anında süren çekim açılışla kesilir.
 */
function film(first: CameraCue, cutAt: number, blend: boolean, skipAt = Infinity): Vector3[] {
  const tactical = pose(0, 17, 22)
  const cine: Record<CameraCue, Pose> = {
    intro: pose(6, 5.5, 14),
    dusk: pose(0, 9, 24),
    encircle: pose(0, 28, 22),
  }
  const shot = createShotState(pose(0, 0, 0))
  const out = pose(0, 0, 0)
  const frames: Vector3[] = []
  const dt = 1 / 60
  startShot(shot, first, out)
  for (let t = 0; t < 6; t += dt) {
    if (Math.abs(t - cutAt) < dt / 2) {
      if (!blend) shot.cue = null
      startShot(shot, 'intro', out)
    }
    if (Math.abs(t - skipAt) < dt / 2) skipShot(shot, out)
    out.pos.copy(tactical.pos)
    out.look.copy(tactical.look)
    if (shot.cue && shot.cue !== 'arrow') {
      shot.t += dt
      const w = shotWeight(shot.cue, shot.t)
      out.pos.lerp(cine[shot.cue].pos, w)
      out.look.lerp(cine[shot.cue].look, w)
      if (shotDone(shot.cue, shot.t)) shot.cue = null
    }
    applyBlend(shot, dt, out)
    frames.push(out.pos.clone())
  }
  return frames
}

function maxStep(frames: Vector3[]): number {
  let max = 0
  for (let i = 1; i < frames.length; i++) max = Math.max(max, frames[i].distanceTo(frames[i - 1]))
  return max
}

describe('sinematik çekimler', () => {
  it('açılış tam sinematik başlar, taktik duruşta biter', () => {
    expect(shotWeight('intro', 0)).toBe(1)
    expect(shotWeight('intro', 0.4)).toBe(1)
    expect(shotWeight('intro', INTRO_TIME / 2)).toBeGreaterThan(0)
    expect(shotWeight('intro', INTRO_TIME / 2)).toBeLessThan(1)
    expect(shotWeight('intro', INTRO_TIME)).toBe(0)
    expect(shotDone('intro', INTRO_TIME)).toBe(true)
  })

  it('gün batımı taktikten başlar, alçalır, bekler ve geri döner', () => {
    expect(shotWeight('dusk', 0)).toBe(0)
    expect(shotWeight('dusk', DUSK_RISE)).toBe(1)
    expect(shotWeight('dusk', DUSK_RISE + DUSK_HOLD / 2)).toBe(1)
    const end = DUSK_RISE + DUSK_HOLD + DUSK_FALL
    expect(shotWeight('dusk', end)).toBe(0)
    expect(shotDone('dusk', end - 0.01)).toBe(false)
    expect(shotDone('dusk', end)).toBe(true)
  })

  it('ağırlık sıçramaz: ardışık karelerde küçük adımlarla değişir', () => {
    for (const cue of ['intro', 'dusk'] as const) {
      let prev = shotWeight(cue, 0)
      for (let t = 1 / 60; t < 6; t += 1 / 60) {
        const w = shotWeight(cue, t)
        expect(Math.abs(w - prev)).toBeLessThan(0.05)
        prev = w
      }
    }
  })

  it('kesilen çekim sert kesmez: son duruştan süzülür (K3)', () => {
    // Gün batımı tam alçalmışken açılış isteği gelir.
    const cutAt = DUSK_RISE + DUSK_HOLD / 2
    const hard = maxStep(film('dusk', cutAt, false))
    const smooth = maxStep(film('dusk', cutAt, true))
    // Geçişsiz, açılışın ilk karesine bir karede atlardı.
    expect(hard).toBeGreaterThan(5)
    // Kesintisiz bir çekimin en hızlı adımından belirgin hızlı değil.
    const uncut = Math.max(maxStep(film('dusk', Infinity, true)), maxStep(film('intro', Infinity, true)))
    expect(smooth).toBeLessThanOrEqual(1.5 * uncut)
  })

  it('dokununca çekim atlanır, kamera taktiğe süzülür', () => {
    const skipAt = DUSK_RISE + DUSK_HOLD / 2
    const frames = film('dusk', Infinity, true, skipAt)
    const uncut = maxStep(film('dusk', Infinity, true))
    expect(maxStep(frames)).toBeLessThanOrEqual(1.5 * uncut)
    // BLEND_TIME sonra taktik duruşta; gün batımı kendi başına hâlâ alçakta olurdu.
    const i = Math.round((skipAt + BLEND_TIME) * 60) + 1
    expect(frames[i].distanceTo(new Vector3(0, 17, 22))).toBeLessThan(1e-6)
  })

  it('geçiş BLEND_TIME sonunda biter, çekim kaldığı yerden sürer', () => {
    const frames = film('dusk', 1, true)
    const direct = film('intro', Infinity, true)
    // Kesişten BLEND_TIME sonra kamera, aynı anda başlamış açılışla aynı yerde.
    const i = Math.round((1 + BLEND_TIME) * 60) + 1
    expect(frames[i].distanceTo(direct[i - 60])).toBeLessThan(1e-6)
  })
})
