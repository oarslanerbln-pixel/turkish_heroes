import { describe, expect, it } from 'vitest'
import { calcContactDamage, COMBAT_CONFIG, countAttackers, resolveOutcome } from './combat'
import { MAX_WAVE_ENEMIES, spawnWave, TOTAL_WAVES, waveClearBonus, waveConfig } from './waves'
import type { Enemy } from './types'

function enemy(x: number, z: number, alive = true): Enemy {
  return { id: 0, pos: { x, z }, vel: { x: 0, z: 0 }, alive, discipline: 0 }
}

describe('combat', () => {
  it('yalnızca temas yarıçapındaki canlı düşmanları sayar', () => {
    const enemies = [enemy(1, 0), enemy(0, 1, false), enemy(5, 5)]
    expect(countAttackers(enemies, { x: 0, z: 0 })).toBe(1)
  })

  it('hasar aynı anda vurabilecek düşman sayısıyla sınırlı', () => {
    const capped = calcContactDamage(50, 1)
    expect(capped).toBe(COMBAT_CONFIG.maxAttackers * COMBAT_CONFIG.damagePerEnemy)
  })

  it('sonuç: can bitince yenilgi, düşman bitince zafer', () => {
    expect(resolveOutcome(0, 3)).toBe('defeat')
    expect(resolveOutcome(50, 0)).toBe('victory')
    expect(resolveOutcome(50, 3)).toBe('playing')
  })

  it('aynı karede ikisi birden olursa yenilgi öncelikli', () => {
    expect(resolveOutcome(0, 0)).toBe('defeat')
  })
})

describe('waves', () => {
  it('her dalga tanımlı sayıda düşmanla doğar', () => {
    for (let i = 0; i < TOTAL_WAVES; i++) {
      const enemies = spawnWave(i)
      expect(enemies).toHaveLength(waveConfig(i).enemyCount)
      expect(enemies.every((e) => e.alive && e.discipline === 1)).toBe(true)
    }
  })

  it('dalgalar zorlaşıyor: daha kalabalık, daha çabuk toparlanan', () => {
    for (let i = 1; i < TOTAL_WAVES; i++) {
      expect(waveConfig(i).enemyCount).toBeGreaterThan(waveConfig(i - 1).enemyCount)
      expect(waveConfig(i).disciplineRecoveryMult).toBeGreaterThan(
        waveConfig(i - 1).disciplineRecoveryMult,
      )
    }
  })

  it('instancedMesh kapasitesi en kalabalık dalgayı karşılıyor', () => {
    for (let i = 0; i < TOTAL_WAVES; i++) {
      expect(spawnWave(i).length).toBeLessThanOrEqual(MAX_WAVE_ENEMIES)
    }
  })

  it('sonraki dalgaların bonusu daha yüksek', () => {
    expect(waveClearBonus(1)).toBeGreaterThan(waveClearBonus(0))
  })
})
