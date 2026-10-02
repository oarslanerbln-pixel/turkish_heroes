import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { ARROW_FLIGHT, arrowPose, type Arrow } from './arrowPool'

describe('ok yayı', () => {
  const arrow = (age: number): Arrow => ({ age, sx: 0, sy: 2, sz: 0, tx: 10, tz: -6, t0: 0 })
  const pos = new Vector3()
  const vel = new Vector3()

  it('atış zemininden kalkar, hedefin zeminine iner', () => {
    arrowPose(arrow(0), pos, vel)
    expect(pos.toArray()).toEqual([0, 3.6, 0])
    arrowPose(arrow(ARROW_FLIGHT), pos, vel)
    expect(pos.x).toBeCloseTo(10)
    expect(pos.z).toBeCloseTo(-6)
    expect(pos.y).toBeCloseTo(0.4)
  })

  it('yükselerek kalkar, alçalarak iner', () => {
    arrowPose(arrow(0), pos, vel)
    expect(vel.y).toBeGreaterThan(0)
    arrowPose(arrow(ARROW_FLIGHT), pos, vel)
    expect(vel.y).toBeLessThan(0)
    // Yatay hız uçuş boyunca sabit: süre içinde hedefe varır.
    expect(vel.x * ARROW_FLIGHT).toBeCloseTo(10)
  })
})
