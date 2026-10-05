import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { createWorld, world } from '../sim/world'
import { reachedBaideng, recordWave } from '../sim/progress'
import { BAIDENG_WAVE, TOTAL_WAVES, retryWave, waveConfig } from '../mechanics/waves'
import { COMBAT_CONFIG } from '../mechanics/combat'

const game = () => useGameStore.getState()

/** Savaş Baideng'de, tam canla ve Han ordusuyla kurulu mu. */
function expectBaidengStart() {
  expect(world.waveIndex).toBe(BAIDENG_WAVE)
  expect(world.baideng).not.toBeNull()
  expect(world.enemies).toHaveLength(waveConfig(BAIDENG_WAVE).enemyCount)
  expect(world.playerHealth).toBe(COMBAT_CONFIG.playerMaxHealth)
  expect(world.restedFrom).toBeNull()
  expect(world.mode).toBe('playing')
  expect(game().waveIndex).toBe(BAIDENG_WAVE)
}

describe("Baideng'den başlama", () => {
  beforeEach(() => {
    game().backToMenu()
  })

  it('Baideng son dalga; YENİDEN yalnız Baideng’e varılan savaşı oradan başlatır', () => {
    expect(BAIDENG_WAVE).toBe(TOTAL_WAVES - 1)
    for (let i = 0; i < BAIDENG_WAVE; i++) expect(retryWave(i)).toBe(0)
    expect(retryWave(BAIDENG_WAVE)).toBe(BAIDENG_WAVE)
  })

  it('dünya başlangıç dalgasıyla kurulur; ordu savaşları bunu yok sayar', () => {
    const w = createWorld('metehan', { startWave: BAIDENG_WAVE, seed: 1 })
    expect(w.waveIndex).toBe(BAIDENG_WAVE)
    expect(w.baideng).not.toBeNull()
    expect(w.enemies).toHaveLength(waveConfig(BAIDENG_WAVE).enemyCount)
    expect(createWorld('metehan').baideng).toBeNull()

    const malazgirt = createWorld('alp-arslan', { startWave: BAIDENG_WAVE, seed: 1 })
    expect(malazgirt.waveIndex).toBe(0)
    expect(malazgirt.baideng).toBeNull()
  })

  it('Baideng’e varmayan oradan başlayamaz; savaşta varan moladan oradan yeniden başlar', () => {
    expect(reachedBaideng()).toBe(false)
    game().start()
    game().restartAt(BAIDENG_WAVE)
    expect(world.waveIndex).toBe(0)

    // Kayıt savaş bitince yazılır; bu savaşta varılmış olması yeter.
    world.waveIndex = BAIDENG_WAVE
    world.playerHealth = 30
    const generation = world.generation
    game().pause(false)
    game().restart()
    expect(world.generation).toBe(generation + 1)
    expectBaidengStart()
  })

  it('bir kez varan her iki yerden başlar: Baideng’den ve baştan', () => {
    recordWave(BAIDENG_WAVE)
    expect(reachedBaideng()).toBe(true)
    game().start()
    // 2. dalgada biten savaşın YENİDEN'i baştan; Baideng ayrı seçenek.
    world.waveIndex = 1
    game().restart()
    expect(world.waveIndex).toBe(0)
    game().restartAt(BAIDENG_WAVE)
    expectBaidengStart()
    game().restart()
    expectBaidengStart()
    game().restartAt(0)
    expect(world.waveIndex).toBe(0)
    expect(world.baideng).toBeNull()
    // Yalnız baş ve Baideng: ara dalgadan başlanmaz.
    game().restartAt(1)
    expect(world.waveIndex).toBe(0)
  })

  it('ordu savaşında Baideng seçeneği yok', () => {
    recordWave(BAIDENG_WAVE)
    game().enterBattle('alp-arslan')
    expect(world.battle).not.toBeNull()
    game().restartAt(BAIDENG_WAVE)
    expect(world.battle).not.toBeNull()
    expect(world.baideng).toBeNull()
    expect(world.waveIndex).toBe(0)
  })
})
