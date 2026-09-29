import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_TIER_CHANGES,
  parseForcedTier,
  QUALITY,
  shiftTier,
  startTier,
  useQuality,
} from './quality'

describe('kademe seçimi', () => {
  it('URL parametresi yalnızca geçerli kademeleri kabul eder', () => {
    expect(parseForcedTier('?quality=low')).toBe('low')
    expect(parseForcedTier('?perf&quality=high')).toBe('high')
    expect(parseForcedTier('?quality=ultra')).toBeNull()
    expect(parseForcedTier('')).toBeNull()
  })

  it('dokunmatik ortadan, masaüstü yüksekten başlar; URL her şeyi ezer', () => {
    expect(startTier(null, true)).toBe('medium')
    expect(startTier(null, false)).toBe('high')
    expect(startTier('low', false)).toBe('low')
  })

  it('basamak kaydırma uçlarda durur', () => {
    expect(shiftTier('low', -1)).toBe('low')
    expect(shiftTier('high', 1)).toBe('high')
    expect(shiftTier('medium', 1)).toBe('high')
  })

  it('düşük kademe her maliyet düğmesinde daha ucuz', () => {
    expect(QUALITY.low.maxDpr).toBeLessThan(QUALITY.medium.maxDpr)
    expect(QUALITY.medium.maxDpr).toBeLessThan(QUALITY.high.maxDpr)
    expect(QUALITY.low.multisampling).toBeLessThanOrEqual(QUALITY.medium.multisampling)
    expect(QUALITY.low.bloom).toBe(false)
  })
})

describe('uyarlama', () => {
  beforeEach(() => {
    useQuality.setState({ tier: 'medium', locked: false, changes: 0 })
  })

  it('FPS yetmezse bir basamak iner, yeterse çıkar', () => {
    useQuality.getState().step(-1)
    expect(useQuality.getState().tier).toBe('low')
    useQuality.getState().step(1)
    expect(useQuality.getState().tier).toBe('medium')
  })

  // Regresyon koruması: rahat bir cihaz en üstte her ölçümde "yükselt" der.
  // Bunlar değişim sayılsaydı salınım kilidi yanlışlıkla devreye girerdi.
  it('en üst kademede tekrarlanan yükseltme istekleri sayılmaz', () => {
    useQuality.setState({ tier: 'high' })
    for (let i = 0; i < 20; i++) useQuality.getState().step(1)
    expect(useQuality.getState()).toMatchObject({ tier: 'high', changes: 0, locked: false })
  })

  it('iki kademe arasında gidip gelirse düşük olanda kilitlenir', () => {
    const { step } = useQuality.getState()
    step(1) // high
    step(-1) // medium
    step(1) // high
    step(-1) // medium — dördüncü değişim
    expect(useQuality.getState().changes).toBe(MAX_TIER_CHANGES)
    expect(useQuality.getState()).toMatchObject({ tier: 'medium', locked: true })
    step(1)
    expect(useQuality.getState().tier).toBe('medium')
  })

  it('kilit yükseltme anına denk gelirse yükseltmeyi uygulamaz', () => {
    const { step } = useQuality.getState()
    step(-1) // low
    step(1) // medium
    step(-1) // low
    step(1) // dördüncü: medium'a çıkmak yerine low'da kalır
    expect(useQuality.getState()).toMatchObject({ tier: 'low', locked: true })
  })

  it('kilitliyken (URL ile sabitlenmiş) hiç değişmez', () => {
    useQuality.setState({ locked: true })
    useQuality.getState().step(-1)
    expect(useQuality.getState().tier).toBe('medium')
  })
})
