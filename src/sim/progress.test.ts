import { describe, expect, it } from 'vitest'
import {
  bestStars,
  inferStars,
  isFirstBattle,
  furthestWave,
  isUnlocked,
  recordStars,
  ladderStep,
  recordBattleEnd,
  recordLadder,
  recordVictory,
  recordWave,
  takeHint,
} from './progress'
import { LADDER_BOTTOM, LADDER_TOP } from '../mechanics/waves'

// Test ortamında localStorage yok: ilerleme bellekte tutulur, kurallar aynı.
describe('ilerleme', () => {
  it('ipucu yalnızca bir kez verilir', () => {
    expect(takeHint('charge')).toBe(true)
    expect(takeHint('charge')).toBe(false)
    expect(takeHint('dusk')).toBe(true)
  })

  it("Alp Arslan, Metehan'da 3. dalgaya ulaşınca açılır: zafer beklenmez", () => {
    expect(isUnlocked('metehan')).toBe(true)
    expect(isUnlocked('alp-arslan')).toBe(false)
    recordWave(1)
    expect(isUnlocked('alp-arslan')).toBe(false)
    recordWave(2)
    expect(isUnlocked('alp-arslan')).toBe(true)
    // Rekor geri düşmez.
    recordWave(0)
    expect(furthestWave()).toBe(2)
    recordVictory('metehan')
    expect(isUnlocked('alp-arslan')).toBe(true)
  })

  it('Metehan merdiveni yarı hasardan başlar, zaferle çıkar, yenilgiyle tabana iner', () => {
    expect(ladderStep()).toBe(0)
    for (let i = 0; i < -LADDER_BOTTOM + 2; i++) recordLadder(false)
    expect(ladderStep()).toBe(LADDER_BOTTOM)
    for (let i = 0; i < LADDER_TOP - LADDER_BOTTOM + 2; i++) recordLadder(true)
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

  it('yıldız yalnızca rekor kırınca yazılır', () => {
    expect(bestStars('alp-arslan')).toBe(0)
    recordStars('alp-arslan', 2)
    recordStars('alp-arslan', 1)
    expect(bestStars('alp-arslan')).toBe(2)
    recordStars('alp-arslan', 3)
    expect(bestStars('alp-arslan')).toBe(3)
  })

  it('eski kayıttan yıldız türetilir: zafer ≥ 1, esir / barış notu 3', () => {
    expect(inferStars(['metehan', 'alp-arslan'], [])).toEqual({ metehan: 1, 'alp-arslan': 1 })
    expect(inferStars(['metehan', 'alp-arslan'], ['esir'])).toEqual({ metehan: 1, 'alp-arslan': 3 })
    expect(inferStars(['alp-arslan', 'kilicarslan'], ['baris'])).toEqual({
      'alp-arslan': 1,
      kilicarslan: 3,
    })
  })
})
