import { describe, expect, it } from 'vitest'
import {
  isFirstBattle,
  isUnlocked,
  ladderStep,
  recordBattleEnd,
  recordLadder,
  recordVictory,
  takeHint,
} from './progress'
import { LADDER_TOP } from '../mechanics/waves'

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

  it('Metehan merdiveni yarı hasardan başlar, zaferle çıkar, yenilgiyle iner', () => {
    expect(ladderStep()).toBe(0)
    recordLadder(false)
    expect(ladderStep()).toBe(0)
    for (let i = 0; i < LADDER_TOP + 2; i++) recordLadder(true)
    expect(ladderStep()).toBe(LADDER_TOP)
    recordLadder(false)
    expect(ladderStep()).toBe(LADDER_TOP - 1)
  })

  it('ilk savaş komutan başına: biri bitince öteki hâlâ ilk', () => {
    expect(isFirstBattle('alp-arslan')).toBe(true)
    recordBattleEnd('alp-arslan')
    expect(isFirstBattle('alp-arslan')).toBe(false)
    expect(isFirstBattle('kilicarslan')).toBe(true)
  })

  it('kilit zinciri: Alp Arslan zaferi II. Kılıçarslan\'ı açar', () => {
    expect(isUnlocked('kilicarslan')).toBe(false)
    recordVictory('alp-arslan')
    expect(isUnlocked('kilicarslan')).toBe(true)
  })
})
