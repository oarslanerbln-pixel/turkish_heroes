import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import type { CameraCue } from '../sim/world'
import {
  BLEND_TIME,
  DUSK_FALL,
  DUSK_HOLD,
  DUSK_RISE,
  INTRO_TIME,
  OPENING_PUSH,
  OPENING_RISE,
  OPENING_TIME,
  applyBlend,
  createShotState,
  openingPose,
  planOpening,
  shotDone,
  shotWeight,
  skipShot,
  startShot,
  type OpeningPath,
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
    opening: pose(6, 5.5, 14),
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
    if (shot.cue && shot.cue !== 'arrow' && shot.cue !== 'volley') {
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

  it('savaş açılışı menü karesinde başlar, cephede bekler, R3 anından önce taktikte biter', () => {
    expect(shotWeight('opening', 0)).toBe(1)
    expect(shotWeight('opening', OPENING_RISE)).toBe(1)
    expect(shotWeight('opening', (OPENING_RISE + OPENING_TIME) / 2)).toBeGreaterThan(0)
    expect(shotWeight('opening', (OPENING_RISE + OPENING_TIME) / 2)).toBeLessThan(1)
    expect(shotWeight('opening', OPENING_TIME)).toBe(0)
    expect(shotDone('opening', OPENING_TIME - 0.01)).toBe(false)
    expect(shotDone('opening', OPENING_TIME)).toBe(true)
    // R3 referans anı (6 sn) taktik kadrajda çekilir; arayüzün belirmesi (0,6 sn) da sığar.
    expect(OPENING_TIME + 0.6).toBeLessThan(6)
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
    for (const cue of ['intro', 'opening', 'dusk'] as const) {
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

describe('savaş açılışı uçuşu', () => {
  const PLAYER = { x: 0, z: 0 }
  const START: Pose = { pos: new Vector3(6, 5.5, 14), look: new Vector3(-6, 2, -36) }
  /** Oyuncunun 40 birim önünde, altı sıra genişliğinde, dört sıra derin bir ordu. */
  const ARMY = Array.from({ length: 24 }, (_, i) => ({
    pos: { x: (i % 6) * 3 - 7.5, z: -40 - Math.floor(i / 6) * 4 },
    alive: true,
  }))

  function plan(enemies: typeof ARMY): OpeningPath {
    const path: OpeningPath = {
      start: { pos: START.pos.clone(), look: START.look.clone() },
      reveal: pose(0, 0, 0),
      dir: new Vector3(),
    }
    planOpening(path, PLAYER, enemies)
    return path
  }

  it('kamera öncünün önünde alçakta durur, ordunun ortasına bakar', () => {
    const { reveal, dir } = plan(ARMY)
    expect(dir.x).toBeCloseTo(0)
    expect(dir.z).toBeCloseTo(-1)
    expect(reveal.look.x).toBeCloseTo(0)
    expect(reveal.look.z).toBeCloseTo(-46)
    // Öncü z = -40: kamera onun oyuncu tarafında, ordunun içine gömülmez.
    expect(reveal.pos.z).toBeGreaterThan(-40)
    expect(reveal.pos.z).toBeLessThan(-20)
    // Alçakta: ordu ufka karşı görünür.
    expect(reveal.pos.y).toBeLessThan(START.pos.y)
  })

  it('geniş cephe çaprazdan görünür; dar kolda (geçit) kamera eksende kalır', () => {
    const wide = plan(ARMY.map((e) => ({ ...e, pos: { x: e.pos.x * 2, z: e.pos.z } })))
    const column = Array.from({ length: 20 }, (_, i) => ({
      pos: { x: (i % 2) * 3 - 1.5, z: -20 - i * 1.5 },
      alive: true,
    }))
    expect(wide.reveal.pos.x).toBeGreaterThan(3)
    expect(Math.abs(plan(column).reveal.pos.x)).toBeLessThan(0.5)
  })

  it('düşen asker cepheyi çekmez; ordu yoksa menü karesinin baktığı yere uçar', () => {
    const { reveal, dir } = plan(ARMY.map((e) => ({ ...e, alive: false })))
    expect(reveal.look.x).toBeCloseTo(START.look.x)
    expect(reveal.look.z).toBeCloseTo(START.look.z)
    expect(dir.length()).toBeCloseTo(1)
  })

  it('uçuş menü karesinden kesmesiz kalkar, cephe karşısına varır, taktiğe sıçramadan döner', () => {
    const path = plan(ARMY)
    const cine = pose(0, 0, 0)
    openingPose(path, 0, cine)
    expect(cine.pos.distanceTo(START.pos)).toBeLessThan(1e-9)
    expect(cine.look.distanceTo(START.look)).toBeLessThan(1e-9)
    openingPose(path, OPENING_PUSH, cine)
    // Varışta yalnızca cepheye doğru süzülme farkı kalır (0,8 b/sn).
    expect(cine.pos.distanceTo(path.reveal.pos)).toBeLessThan(OPENING_PUSH)

    const tactical = pose(0, 17, 22)
    const out = pose(0, 0, 0)
    const frames: Vector3[] = []
    for (let t = 0; t <= OPENING_TIME + 1e-9; t += 1 / 60) {
      openingPose(path, t, cine)
      const w = shotWeight('opening', t)
      out.pos.copy(tactical.pos).lerp(cine.pos, w)
      frames.push(out.pos.clone())
    }
    expect(frames.at(-1)!.distanceTo(tactical.pos)).toBeLessThan(1e-6)
    // En hızlı anda bile karede bir birimden az: uçuş, kesme değil.
    expect(maxStep(frames)).toBeLessThan(1)
  })
})
