import { describe, expect, it } from 'vitest'
import { isFirstBattle, isUnlocked, recordBattleEnd, recordVictory, takeHint } from './progress'

// Test ortamında localStorage yok: ilerleme bellekte tutulur, kurallar aynı.
describe('ilerleme', () => {
  it('ipucu yalnızca bir kez verilir', () => {
    expect(takeHint('charge')).toBe(true)
    expect(takeHint('charge')).toBe(false)
    expect(takeHint('dusk')).toBe(true)
  })

  it('Alp Arslan, Metehan kazanılınca açılır', () => {
    expect(isUnlocked('metehan')).toBe(true)
    expect(isUnlocked('alp-arslan')).toBe(false)
    recordVictory('metehan')
    expect(isUnlocked('alp-arslan')).toBe(true)
  })

  it('ilk savaş bitince artık ilk savaş değil', () => {
    expect(isFirstBattle()).toBe(true)
    recordBattleEnd()
    expect(isFirstBattle()).toBe(false)
  })
})
