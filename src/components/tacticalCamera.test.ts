import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { HILAL_CONFIG, approachAngle } from '../mechanics/hilalSystem'
import { TACTICAL_OFFSET, followLook, tacticalTarget } from './tacticalCamera'

/** Telefon yatay (667×375), Scene'deki fov. */
function phoneCamera(): PerspectiveCamera {
  return new PerspectiveCamera(55, 667 / 375, 0.1, 500)
}

/** Dünya noktasının ekran yüksekliğine oranla dikey yeri (0 üst, 1 alt). */
function screenY(camera: PerspectiveCamera, look: Vector3, point: Vector3): number {
  camera.position.copy(look).add(TACTICAL_OFFSET)
  camera.lookAt(look)
  camera.updateMatrixWorld()
  return (1 - point.clone().project(camera).y) / 2
}

describe('taktik kadraj', () => {
  it('yay 180° dönünce oyuncu ekranda yüksekliğin ≤%10 kayar (K1)', () => {
    const camera = phoneCamera()
    const player = { x: 0, z: 16 }
    const target = new Vector3()
    const look = new Vector3()
    let facing = Math.PI
    tacticalTarget(player, facing, target)
    followLook(look, target, 0, true)

    const ys: number[] = []
    const dt = 1 / 60
    for (let t = 0; t < 3; t += dt) {
      facing = approachAngle(facing, 0, HILAL_CONFIG.facingTurnRate * dt)
      tacticalTarget(player, facing, target)
      followLook(look, target, dt, false)
      ys.push(screenY(camera, look, new Vector3(player.x, 0, player.z)))
    }
    expect(facing).toBeCloseTo(0)
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(0.1)
  })

  it('oyuncu ekranın ortasının altında, karşısındaki ordu üst kenardan uzak (K2)', () => {
    const camera = phoneCamera()
    const player = { x: 0, z: 16 }
    const look = tacticalTarget(player, Math.PI, new Vector3())
    // Malazgirt R3 (t=6): ön saf z=−11, arka saf z=−20.
    const playerY = screenY(camera, look, new Vector3(player.x, 0, player.z))
    const frontY = screenY(camera, look, new Vector3(0, 0.8, -11))
    const backY = screenY(camera, look, new Vector3(0, 0.8, -20))
    expect(playerY).toBeGreaterThan(0.5)
    expect(playerY).toBeLessThan(0.75)
    // Ortadaki gün çizgisi 667×375'te 45 px'te bitiyor (%12); 45°'de arka saf %6, ön saf %14'teydi.
    // Asıl ölçüt art.spec kadraj.
    expect(backY).toBeGreaterThan(0.12)
    expect(frontY).toBeGreaterThan(0.18)
  })
})
