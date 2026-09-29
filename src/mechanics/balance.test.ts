// Headless denge testi — PLAN.md'deki "her denge kararı simülasyonla ölçüldü"
// iddiasının repoda yaşayan hali. Tarama betikleri commit edilmemişti; burada
// mekaniğin iki temel sözü sabitleniyor:
//   1. Taktik işe yarıyor: düşmanı peşinde sürükleyen bot kuşatmayı kurar.
//   2. Taktik şart: yerinde duran oyuncu hiç enerji toplayamaz.
// Bir sabit (chaseSpeed, energyFillRate…) oynanıp bu sözlerden biri bozulursa
// test kırılır. Tam oyun döngüsü GameDirector'da; burada yalnızca mekanik.

import { describe, expect, it } from 'vitest'
import { stepEnemies } from './enemySim'
import {
  calcFacing,
  calcSiegeState,
  countInCrescent,
  executeStrike,
  HILAL_CONFIG,
  isStrikeReady,
  stepEnergy,
} from './hilalSystem'
import { spawnWave, waveConfig } from './waves'
import type { Vec2 } from './types'

const DT = 1 / 60

interface RunResult {
  maxEnergy: number
  kills: number
}

/**
 * @param move Oyuncunun o karedeki hız vektörü.
 * @param retreating Bot kaçıyor mu (GameDirector'daki detectRetreat'in yerine).
 */
function run(seconds: number, move: (t: number, p: Vec2) => Vec2, retreating: boolean): RunResult {
  const enemies = spawnWave(0)
  const player: Vec2 = { x: 0, z: 8 }
  let energy = 0
  let maxEnergy = 0
  let kills = 0
  let facing = Math.PI

  for (let t = 0; t < seconds; t += DT) {
    const v = move(t, player)
    player.x += v.x * DT
    player.z += v.z * DT

    stepEnemies(enemies, player, DT, retreating, waveConfig(0).disciplineRecoveryMult)
    const siege = calcSiegeState(enemies)
    energy = stepEnergy(energy, siege.vulnerability, DT)
    maxEnergy = Math.max(maxEnergy, energy)

    facing = calcFacing(enemies, player, facing, siege.centroid)
    if (isStrikeReady(energy) && countInCrescent(enemies, player, facing) > 0) {
      kills += executeStrike(enemies, player, facing)
      energy = 0
    }
  }

  return { maxEnergy, kills }
}

/** Arena merkezinde geniş çember çizen kiting botu. */
function circle(radius: number) {
  const angular = HILAL_CONFIG.retreatSpeed / radius
  return (t: number): Vec2 => ({
    x: -Math.sin(angular * t) * HILAL_CONFIG.retreatSpeed,
    z: Math.cos(angular * t) * HILAL_CONFIG.retreatSpeed,
  })
}

describe('denge', () => {
  it('yerinde duran oyuncu hilal enerjisi toplayamaz', () => {
    const { maxEnergy, kills } = run(30, () => ({ x: 0, z: 0 }), false)
    expect(maxEnergy).toBeLessThan(HILAL_CONFIG.strikeThreshold)
    expect(kills).toBe(0)
  })

  it('çember çizerek düşmanı sürükleyen oyuncu kuşatmayı kurup düşman düşürür', () => {
    const { maxEnergy, kills } = run(40, circle(14), true)
    expect(maxEnergy).toBe(HILAL_CONFIG.strikeThreshold)
    expect(kills).toBeGreaterThan(0)
  })
})
