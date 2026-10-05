import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import {
  CASTER_TOP,
  fitSunShadow,
  LIGHT_DISTANCE,
  SHADOW_FAR,
  SHADOW_RADIUS,
  type SunShadowFrame,
} from './sunShadow'

// DayCycle'ın anahtar karelerindeki güneş konumları.
const NOON = new Vector3(18, 22, 12).normalize()
const SUNSET = new Vector3(22, 12, -20).normalize()
const NIGHT = new Vector3(-12, 20, 10).normalize()
/** Eski sabit çerçeve: ±35. */
const OLD_AREA = 70 * 70

function fit(sun: Vector3): SunShadowFrame {
  return fitSunShadow(sun, { center: new Vector3(), halfWidth: 0, halfHeight: 0 })
}

/** Sahanın kenarı: yerde ve en uzun düşürücünün boyunda. */
function* rim() {
  for (let a = 0; a < 2 * Math.PI; a += Math.PI / 64) {
    for (const h of [0, CASTER_TOP]) {
      yield new Vector3(Math.cos(a) * SHADOW_RADIUS, h, Math.sin(a) * SHADOW_RADIUS)
    }
  }
}

describe('güneş gölgesi çerçevesi', () => {
  it('saha gölge kamerasının içinde kalır', () => {
    for (const sun of [NOON, SUNSET, NIGHT]) {
      const f = fit(sun)
      // three'nin gölge kamerası eksenleri (Matrix4.lookAt).
      const x = new Vector3().crossVectors(new Vector3(0, 1, 0), sun).normalize()
      const y = new Vector3().crossVectors(sun, x)
      const light = f.center.clone().addScaledVector(sun, LIGHT_DISTANCE)
      for (const p of rim()) {
        const d = p.clone().sub(f.center)
        expect(Math.abs(d.dot(x))).toBeLessThanOrEqual(f.halfWidth + 1e-9)
        expect(Math.abs(d.dot(y))).toBeLessThanOrEqual(f.halfHeight + 1e-9)
        const depth = light.clone().sub(p).dot(sun)
        expect(depth).toBeGreaterThan(0.5)
        expect(depth).toBeLessThan(SHADOW_FAR)
      }
    }
  })

  it('güneş alçaldıkça aynı harita daha az alana yayılır', () => {
    const gain = (sun: Vector3) => {
      const f = fit(sun)
      return OLD_AREA / (4 * f.halfWidth * f.halfHeight)
    }
    // Ölçülen: öğle 1,24, gün batımı 2,15, gece 1,14.
    expect(gain(NOON)).toBeGreaterThan(1.2)
    expect(gain(NIGHT)).toBeGreaterThan(1.1)
    expect(gain(SUNSET)).toBeGreaterThan(2.1)
  })
})
