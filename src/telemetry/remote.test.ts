import { afterEach, describe, expect, it, vi } from 'vitest'
import { startSummary, type BattleSummary, type TelemetryEvent } from './summary'

const START: Extract<TelemetryEvent, { type: 'battle_start' }> = {
  type: 'battle_start',
  commander: 'metehan',
  attempt: 1,
  assist: 0.5,
}
const END: TelemetryEvent = {
  type: 'battle_end',
  outcome: 'defeat',
  cause: 'health',
  score: 12,
  stars: 0,
  health: 0,
  wave: 1,
  remaining: 9,
  simTime: 41,
}

interface Row {
  commander: string
  outcome: string
  stars: number
  summary: Partial<BattleSummary>
}

/** Test ortamında localStorage yok; modüller onu yüklenirken okuyor. */
function memoryStorage(seed: Record<string, string>): Storage {
  const m = new Map(Object.entries(seed))
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

/** Rıza ve yarıda kalan savaş yüklenirken okunduğu için modüller her testte baştan yüklenir. */
async function boot(seed: Record<string, string> = {}, configured = true) {
  vi.resetModules()
  if (configured) {
    vi.stubEnv('VITE_TELEMETRY_URL', 'https://db.test')
    vi.stubEnv('VITE_TELEMETRY_KEY', 'test-key')
  }
  vi.stubGlobal('localStorage', memoryStorage(seed))
  const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
    Promise.resolve(new Response(null, { status: 201 })),
  )
  vi.stubGlobal('fetch', fetchMock)
  // Geliştirme modunda olaylar konsola da yazılıyor.
  vi.spyOn(console, 'info').mockImplementation(() => {})
  const remote = await import('./remote')
  const track = await import('./track')
  const sent = (): Row[] => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string) as Row)
  return { remote, track, sent }
}

function playOne(track: typeof import('./track'), attempt = 1): void {
  track.track({ ...START, attempt })
  track.track(END)
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('uzak kayıt ve rıza', () => {
  it('rıza önceden EVET ise savaş sonunda özet gider', async () => {
    const { track, sent } = await boot({ hilal_consent: 'yes' })
    playOne(track)
    expect(sent()).toHaveLength(1)
    expect(sent()[0]).toMatchObject({ commander: 'metehan', outcome: 'defeat', stars: 0 })
    expect(sent()[0].summary.attempt).toBe(1)
  })

  it('sonuç ekranında verilen EVET, o savaşı bir kez gönderir', async () => {
    const { remote, track, sent } = await boot()
    playOne(track)
    expect(sent()).toHaveLength(0)
    remote.setConsent('yes')
    expect(sent()).toHaveLength(1)
    expect(sent()[0].summary.attempt).toBe(1)
    // Aynı ekranda KAPALI → AÇIK: savaş ikinci kez gitmez.
    remote.setConsent('no')
    remote.setConsent('yes')
    expect(sent()).toHaveLength(1)
  })

  it('HAYIR hiçbir şey göndermez, sonraki savaşları da', async () => {
    const { remote, track, sent } = await boot()
    playOne(track)
    remote.setConsent('no')
    playOne(track, 2)
    expect(sent()).toHaveLength(0)
  })

  it('EVET yalnızca ekrandaki savaşı kapsar, önce cevapsız bitenleri değil', async () => {
    const pending = startSummary(START, 'eski01', 0)
    const { remote, track, sent } = await boot({
      hilal_telemetry: JSON.stringify({ plays: { metehan: 1 }, log: [], pending, debug: false }),
    })
    playOne(track, 2)
    playOne(track, 3)
    remote.setConsent('yes')
    expect(sent()).toHaveLength(1)
    expect(sent()[0].summary.attempt).toBe(3)
  })

  it('önceki ekranda HAYIR denmiş olsa da bu ekrandaki AÇIK, ekrandaki savaşı gönderir', async () => {
    const { remote, track, sent } = await boot()
    playOne(track)
    remote.setConsent('no')
    playOne(track, 2)
    remote.setConsent('yes')
    expect(sent()).toHaveLength(1)
    expect(sent()[0].summary.attempt).toBe(2)
  })

  it('geçen açılışta yarıda kalan savaş, rıza varsa açılışta gider', async () => {
    const pending = startSummary(START, 'eski01', 0)
    const { sent } = await boot({
      hilal_consent: 'yes',
      hilal_telemetry: JSON.stringify({ plays: { metehan: 1 }, log: [], pending, debug: false }),
    })
    expect(sent()).toHaveLength(1)
    expect(sent()[0]).toMatchObject({ outcome: 'abandoned', stars: 0 })
    expect(sent()[0].summary.session).toBe('eski01')
  })

  it('rıza yoksa yarıda kalan savaş gitmez', async () => {
    const pending = startSummary(START, 'eski01', 0)
    const { sent } = await boot({
      hilal_telemetry: JSON.stringify({ plays: { metehan: 1 }, log: [], pending, debug: false }),
    })
    expect(sent()).toHaveLength(0)
  })

  it('uzak kayıt tanımlı olmayan derlemede rıza olsa da hiçbir şey gitmez', async () => {
    const { track, sent } = await boot({ hilal_consent: 'yes' }, false)
    playOne(track)
    expect(sent()).toHaveLength(0)
  })
})
