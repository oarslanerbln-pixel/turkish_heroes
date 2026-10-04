import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import type { WorldEvent } from '../sim/events'
import { SLOWMO_SCALE } from '../sim/world'
import { ARROW_FLIGHT, arrowPose, type Arrow } from './arrowPool'
import {
  ARROW_FALL,
  ARROW_HOLD,
  ARROW_MAX,
  ARROW_RISE,
  arrowChasePose,
  arrowDone,
  arrowHolding,
  arrowWeight,
  beginArrow,
  createArrowShot,
  endArrow,
  findRelease,
  trackArrow,
} from './arrowShot'
import type { Pose } from './cameraShots'

const pose = (): Pose => ({ pos: new Vector3(), look: new Vector3() })

/** Oyuncu (0, 16)'dan merkez birliğe (z = −8) çapraz atış. */
function release(over: Partial<Extract<WorldEvent, { type: 'arrowReleased' }>> = {}) {
  return {
    type: 'arrowReleased' as const,
    slot: 3,
    origin: { x: 0, z: 16 },
    target: { x: 6, z: -8 },
    t0: 42,
    corps: 1,
    byPlayer: true,
    ...over,
  }
}

function arrowFrom(r: ReturnType<typeof release>): Arrow {
  return { age: 0, sx: r.origin.x, sy: 0, sz: r.origin.z, tx: r.target.x, tz: r.target.z, t0: r.t0, stick: 0 }
}

/**
 * CameraDirector'ın ok çekimi adımlarını oynatır: ok ağır çekimde uçar,
 * kamera taktik duruştan (oyuncunun üstü) okun çevresine iner ve geri döner.
 */
function film() {
  const r = release()
  const arrow = arrowFrom(r)
  const s = createArrowShot()
  beginArrow(s, r, arrow)
  const tactical = pose()
  tactical.pos.set(0, 17.4, 16 - 3 + 22.3)
  tactical.look.set(0, 0, 13)
  const cine = pose()
  const out = pose()
  const frames: { cam: Vector3; arrow: Vector3; weight: number }[] = []
  const dt = 1 / 60
  const arrowPos = new Vector3()
  for (let t = dt; !arrowDone(s, t - dt) && t < 10; t += dt) {
    arrow.age += dt * SLOWMO_SCALE
    trackArrow(s, arrow, t)
    arrowChasePose(arrow, s.side, false, cine)
    const weight = arrowWeight(s, t)
    out.pos.lerpVectors(tactical.pos, cine.pos, weight)
    out.look.lerpVectors(tactical.look, cine.look, weight)
    arrowPose(arrow, arrowPos, new Vector3())
    frames.push({ cam: out.pos.clone(), arrow: arrowPos.clone(), weight })
  }
  return { s, arrow, frames }
}

describe('ok kamerası', () => {
  it('iner, ok saplanana dek okta kalır, bekler ve döner', () => {
    const s = createArrowShot()
    expect(arrowWeight(s, 0)).toBe(0)
    expect(arrowWeight(s, ARROW_RISE)).toBe(1)
    // Ok havadayken süre ne olursa olsun kamera okta.
    expect(arrowWeight(s, 3)).toBe(1)
    expect(arrowHolding(s, 3)).toBe(true)
    s.landedAt = 3
    expect(arrowWeight(s, 3 + ARROW_HOLD)).toBe(1)
    expect(arrowHolding(s, 3 + ARROW_HOLD)).toBe(false)
    expect(arrowWeight(s, 3 + ARROW_HOLD + ARROW_FALL)).toBe(0)
    expect(arrowDone(s, 3 + ARROW_HOLD + ARROW_FALL - 0.01)).toBe(false)
    expect(arrowDone(s, 3 + ARROW_HOLD + ARROW_FALL)).toBe(true)
  })

  it('kamera sıçramaz ve okun etrafında döner', () => {
    const { frames } = film()
    let maxStep = 0
    for (let i = 1; i < frames.length; i++) maxStep = Math.max(maxStep, frames[i].cam.distanceTo(frames[i - 1].cam))
    // Taktik duruştan oka ~28 birimlik dalış: sert kesme bir karede atlardı.
    expect(maxStep).toBeLessThan(1.6)
    // Tam sinematik karelerde okun çevresindeki yatay açı en az ~60° döner.
    const full = frames.filter((f) => f.weight === 1)
    const bearing = (f: (typeof frames)[number]) => Math.atan2(f.cam.x - f.arrow.x, f.cam.z - f.arrow.z)
    let sweep = bearing(full[full.length - 1]) - bearing(full[0])
    sweep = Math.atan2(Math.sin(sweep), Math.cos(sweep))
    expect(Math.abs(sweep)).toBeGreaterThan((60 * Math.PI) / 180)
    // Kamera hep zeminin üstünde, oka yakın; saplanırken atlıların üstünde.
    for (const f of full) {
      expect(f.cam.y).toBeGreaterThan(0.5)
      expect(f.cam.distanceTo(f.arrow)).toBeLessThan(8.5)
    }
    expect(full[full.length - 1].cam.y).toBeGreaterThan(4)
    // Son karede taktik duruşa dönmüş.
    expect(frames[frames.length - 1].weight).toBe(0)
  })

  it('ok ağır çekimde uçar, çekim ok saplanınca biter', () => {
    const { s, frames } = film()
    // Yaklaşık 0,75 / 0,3 = 2,5 sn havada.
    expect(s.landedAt).toBeCloseTo(ARROW_FLIGHT / SLOWMO_SCALE, 1)
    expect(frames.length / 60).toBeCloseTo(s.landedAt! + ARROW_HOLD + ARROW_FALL, 1)
  })

  it('yana atışta kamera taktik duruşun yanına döner (ekranın altı, +z)', () => {
    for (const tx of [20, -20]) {
      const r = release({ target: { x: tx, z: 12 } })
      const arrow = arrowFrom(r)
      const s = createArrowShot()
      beginArrow(s, r, arrow)
      arrow.age = ARROW_FLIGHT / 2
      const cine = arrowChasePose(arrow, s.side, false, pose())
      const at = new Vector3()
      arrowPose(arrow, at, new Vector3())
      expect(cine.pos.z - at.z).toBeGreaterThan(2)
    }
  })

  it('izlenen ok saplı kalır, çekim bitince bırakılır', () => {
    const r = release()
    const arrows = Array.from({ length: 8 }, () => arrowFrom(release({ t0: 0 })))
    arrows[r.slot] = arrowFrom(r)
    const s = createArrowShot()
    beginArrow(s, r, arrows[r.slot])
    expect(arrows[r.slot].stick).toBe(Infinity)
    endArrow(s, arrows)
    expect(arrows[r.slot].stick).toBe(0)
    expect(s.slot).toBe(-1)
  })

  it('yuva başka oka geçerse ya da süre dolarsa ok saplanmış sayılır', () => {
    const r = release()
    const arrow = arrowFrom(r)
    const s = createArrowShot()
    beginArrow(s, r, arrow)
    trackArrow(s, arrow, 0.5)
    expect(s.landedAt).toBeNull()
    arrow.t0 = 99
    trackArrow(s, arrow, 0.6)
    expect(s.landedAt).toBe(0.6)

    const late = createArrowShot()
    const a2 = arrowFrom(r)
    beginArrow(late, r, a2)
    trackArrow(late, a2, ARROW_MAX)
    expect(late.landedAt).toBe(ARROW_MAX)
  })

  it('istenen birliğe oyuncunun attığı oku seçer, kol oklarını değil', () => {
    const events: WorldEvent[] = [
      release({ slot: 1, byPlayer: false, corps: 1 }),
      release({ slot: 2, corps: 0 }),
      release({ slot: 5, corps: 1 }),
    ]
    expect(findRelease(events, 1)?.slot).toBe(5)
    expect(findRelease(events, null)?.slot).toBe(2)
    expect(findRelease(events, 2)).toBeUndefined()
  })
})
