import { describe, expect, it } from 'vitest'
import { CRESCENT } from '../mechanics/hilalSystem'
import type { Enemy } from '../mechanics/types'
import { TOTAL_WAVES, waveBreak } from '../mechanics/waves'
import {
  LINE_RADIUS,
  MAX_ARCHERS,
  VOLLEY_DEATH_TIME,
  VOLLEY_END,
  VOLLEY_FLIGHT,
  VOLLEY_LAST_LAND,
  VOLLEY_RELEASE,
  archerPose,
  createVolley,
  fallState,
  isKeyVolley,
  planVolley,
  resetVolley,
  stepVolley,
  strikeByVolley,
  volleyFade,
  type ArcherPose,
  type VolleyShot,
} from './volleyPlan'

const enemy = (id: number, x: number, z: number, vx = 0, vz = 0): Enemy => ({
  id,
  pos: { x, z },
  vel: { x: vx, z: vz },
  alive: true,
  discipline: 1,
})

/** Sabit tohumlu üreteç: testler her koşuda aynı yaylımı kurar. */
function lcg(seed = 7): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** Oyuncu kökte, +z'ye bakıyor; üç düşen hilalin içinde, biri dışarıda. */
function battle() {
  const enemies = [enemy(10, -4, 7, 0, -3), enemy(11, 0.5, 9, 0, -4), enemy(12, 4, 8, 1, -2), enemy(13, 0, -6)]
  for (const e of enemies.slice(0, 3)) e.alive = false
  const strike = {
    type: 'strike' as const,
    origin: { x: 0, z: 0 },
    facing: 0,
    victims: enemies.slice(0, 3).map((e) => ({ id: e.id, x: e.pos.x, z: e.pos.z })),
  }
  return { enemies, strike }
}

/** Yaylımı `t` sim saniyesine dek küçük adımlarla ilerletir. */
function run(v: ReturnType<typeof createVolley>, t: number, onLand: (shot: VolleyShot) => void = () => {}) {
  const dt = 1 / 60
  for (let k = 0; k < Math.round(t / dt); k++) stepVolley(v, dt, onLand)
}

describe('hilal yaylımı', () => {
  it('düşen yoksa yaylım kurulmaz', () => {
    const v = createVolley(8)
    const { enemies, strike } = battle()
    expect(planVolley(v, { ...strike, victims: [] }, enemies, 10, lcg())).toBe(false)
    expect(v.active).toBe(false)
    expect(v.count).toBe(0)
  })

  it('her düşene bir ok; kameranın oku yayın ortasındaki düşenin, gecikmesiz', () => {
    const v = createVolley(8)
    const { enemies, strike } = battle()
    expect(planVolley(v, strike, enemies, 10, lcg())).toBe(true)
    expect(v.count).toBe(1)
    expect(v.archers).toBe(10)
    for (let i = 0; i < 3; i++) {
      const s = v.shotOf[i]
      expect(s).toBeGreaterThanOrEqual(0)
      expect(v.shots[s].enemy).toBe(i)
    }
    expect(v.shotOf[3]).toBe(-1)
    const hero = v.shots[v.hero]
    expect(hero.enemy).toBe(1)
    expect(hero.release).toBe(VOLLEY_RELEASE)
    expect(hero.arrow.age).toBe(-VOLLEY_RELEASE)
    // Az düşende de yaylım dolu görünür: okçu başına iki ok, artanı ıska.
    expect(v.shotCount).toBe(20)
    expect(v.shots.slice(3, v.shotCount).every((s) => s.enemy === -1)).toBe(true)
  })

  it('okçular hilalin ardında; oklar düşmanın arkasından gelir', () => {
    const v = createVolley(8)
    const { enemies, strike } = battle()
    planVolley(v, strike, enemies, 40, lcg())
    expect(v.archers).toBe(MAX_ARCHERS)
    expect(LINE_RADIUS).toBeGreaterThan(CRESCENT.outerRadius)
    for (let s = 0; s < v.shotCount; s++) {
      const a = v.shots[s].arrow
      expect(Math.hypot(a.sx, a.sz)).toBeGreaterThan(CRESCENT.outerRadius)
      // Kalkış hedefin ardında: ok oyuncuya doğru iner.
      expect(Math.hypot(a.sx, a.sz)).toBeGreaterThan(Math.hypot(a.tx, a.tz))
    }
  })

  it('düşen oku gelene dek koşar, ok onu bulduğu yere saplanır', () => {
    const v = createVolley(8)
    const { enemies, strike } = battle()
    planVolley(v, strike, enemies, 10, lcg())
    const at = { x: 0, z: 0 }
    expect(fallState(v, enemies, 1, at)).toBe('pending')
    run(v, VOLLEY_RELEASE / 2)
    expect(fallState(v, enemies, 1, at)).toBe('pending')
    // Hızıyla yavaşlayarak ilerledi: vuruş yerinden önde, oku hâlâ havada.
    expect(at.z).toBeLessThan(9)

    const landed: number[] = []
    run(v, VOLLEY_RELEASE + VOLLEY_FLIGHT, (shot) => landed.push(shot.enemy))
    const hero = v.shots[v.hero].arrow
    expect(fallState(v, enemies, 1, at)).toBe('landed')
    expect(at.x).toBeCloseTo(hero.tx, 5)
    expect(at.z).toBeCloseTo(hero.tz, 5)
    // Okun saplandığı yer sonra da kıpırdamaz: devriliş orada oynar.
    run(v, 0.5)
    expect(fallState(v, enemies, 1, at)).toBe('landed')
    expect(at.z).toBeCloseTo(hero.tz, 5)
    expect(landed.filter((e) => e === 1)).toHaveLength(1)
  })

  it('her ok bir kez saplanır; yaylım biter', () => {
    const v = createVolley(8)
    const { enemies, strike } = battle()
    planVolley(v, strike, enemies, 7, lcg())
    let landed = 0
    run(v, VOLLEY_END + 0.1, () => landed++)
    expect(landed).toBe(v.shotCount)
    expect(v.active).toBe(false)
  })

  it('dalgayı bitiren yaylımın cesedi yeni dalga doğmadan gömülür', () => {
    for (let next = 1; next < TOTAL_WAVES; next++) {
      expect(VOLLEY_LAST_LAND + VOLLEY_DEATH_TIME).toBeLessThan(waveBreak(next))
    }
  })

  it('dalga değişince ya da düşen yaylımda değilse normal düşüş', () => {
    const v = createVolley(8)
    const { enemies, strike } = battle()
    planVolley(v, strike, enemies, 10, lcg())
    const at = { x: 0, z: 0 }
    expect(fallState(v, enemies, 3, at)).toBe('none')
    expect(fallState(v, [...enemies], 1, at)).toBe('none')
    resetVolley(v)
    expect(fallState(v, enemies, 1, at)).toBe('none')
    expect(v.count).toBe(0)
  })

  it('okçular belirir, bırakışta durur, sonra dışa dönüp silinir', () => {
    const v = createVolley(8)
    const { enemies, strike } = battle()
    planVolley(v, strike, enemies, 10, lcg())
    const pose: ArcherPose = { x: 0, z: 0, heading: 0, gait: 0, recoil: 0 }
    expect(volleyFade(v)).toBe(0)
    archerPose(v, 0, pose)
    expect(Math.hypot(pose.x, pose.z)).toBeGreaterThan(LINE_RADIUS)

    run(v, VOLLEY_RELEASE + 0.1)
    expect(volleyFade(v)).toBe(1)
    archerPose(v, 0, pose)
    expect(Math.hypot(pose.x, pose.z)).toBeCloseTo(LINE_RADIUS, 1)
    expect(pose.gait).toBeLessThan(1)
    expect(pose.recoil).toBeGreaterThan(0)
    // Hilalin ortasına bakar.
    expect(Math.cos(pose.heading - (v.angles[0] + Math.PI))).toBeCloseTo(1, 5)

    run(v, 1.1)
    archerPose(v, 0, pose)
    expect(Math.hypot(pose.x, pose.z)).toBeGreaterThan(LINE_RADIUS + 1)
    expect(volleyFade(v)).toBeLessThan(1)
    run(v, VOLLEY_END)
    expect(volleyFade(v)).toBe(0)
  })

  it('kamera yalnız önemli yaylımda iner: ilk vuruş ve dalgayı bitiren vuruş', () => {
    const { enemies } = battle()
    expect(isKeyVolley(1, enemies)).toBe(true)
    expect(isKeyVolley(2, enemies)).toBe(false)
    enemies[3].routed = true
    expect(isKeyVolley(3, enemies)).toBe(true)
  })

  it('vuruşu yaylım yalnız Metehan’da taşır', () => {
    expect(strikeByVolley({ battle: null })).toBe(true)
    expect(strikeByVolley({ battle: {} })).toBe(false)
  })
})
