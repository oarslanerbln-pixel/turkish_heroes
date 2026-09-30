// Oynanış olaylarının toplanması. Veri cihazdan çıkmaz: savaş özetleri
// localStorage'da tutulur (son LOG_LIMIT savaş). Uzak bir analitik servisi
// (ör. PostHog) addSink ile bağlanır; kaydı ve özeti değiştirmez.
//
// ?telemetry adresi ayıklamayı kalıcı açar (?telemetry=0 kapatır): olaylar
// konsola yazılır, sonuç ekranında özetleri kopyalama düğmesi çıkar — telefonda
// oynanan testin verisi böyle alınır.

import type { CommanderId } from '../mechanics/scenario'
import { world } from '../sim/world'
import { applyEvent, startSummary, type BattleSummary, type Stamped, type TelemetryEvent } from './summary'

const STORAGE_KEY = 'hilal_telemetry'
const LOG_LIMIT = 40

export type Sink = (e: Stamped, summary: BattleSummary) => void

interface Stored {
  /** Komutan başına başlatılan savaş sayısı. */
  plays: Partial<Record<CommanderId, number>>
  log: BattleSummary[]
  /** Sekme gizlendiğinde süren savaşın anlık kaydı; sayfa kapanırsa yarıda sayılır. */
  pending: BattleSummary | null
  debug: boolean
}

const browser = typeof window !== 'undefined'

function load(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Partial<Stored>
      return { plays: s.plays ?? {}, log: s.log ?? [], pending: s.pending ?? null, debug: !!s.debug }
    }
  } catch {
    // Bozuk kayıt ya da erişilemeyen depolama: sıfırdan başla.
  }
  return { plays: {}, log: [], pending: null, debug: false }
}

const stored = load()

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Gizli sekme ya da dolu depolama: veri bu oturumla sınırlı.
  }
}

function pushLog(s: BattleSummary): void {
  stored.log.push(s)
  if (stored.log.length > LOG_LIMIT) stored.log.splice(0, stored.log.length - LOG_LIMIT)
}

// Önceki oturum savaşın ortasında kapandı: o savaş yarıda bırakıldı.
if (stored.pending) {
  pushLog({ ...stored.pending, outcome: 'abandoned' })
  stored.pending = null
}

if (browser) {
  const flag = new URLSearchParams(window.location.search).get('telemetry')
  if (flag !== null) stored.debug = flag !== '0'
}
save()

export const TELEMETRY_DEBUG = import.meta.env.DEV || stored.debug

const session = Math.random().toString(36).slice(2, 8)
const sinks: Sink[] = []
let current: BattleSummary | null = null
/** Savaşın başından beri geçen oyun süresi (sn). */
let clock = 0

if (TELEMETRY_DEBUG) sinks.push((e) => console.info('[telemetry]', e))

/** @returns Sink'i kaldıran fonksiyon. */
export function addSink(sink: Sink): () => void {
  sinks.push(sink)
  return () => {
    const i = sinks.indexOf(sink)
    if (i >= 0) sinks.splice(i, 1)
  }
}

export function battleActive(): boolean {
  return current !== null
}

/** Oyun saatini ilerletir; yönetmen savaş sürerken gerçek zamanla çağırır. */
export function advanceClock(realDelta: number): void {
  clock += realDelta
}

export function track(e: TelemetryEvent): void {
  if (e.type === 'battle_start') {
    // Sonucu gelmeden yeni savaş başladıysa eskisi yarıda kalmıştır.
    endUnfinished('abandoned')
    clock = 0
    current = startSummary(e, session, Date.now())
  }
  if (!current) return

  const stamped: Stamped = { ...e, t: Math.round(clock * 10) / 10 }
  applyEvent(current, stamped)
  for (const sink of sinks) sink(stamped, current)

  if (e.type === 'battle_end') {
    pushLog(current)
    stored.pending = null
    current = null
    save()
  }
}

/**
 * Süren savaşın, verilen sonuç olayıyla kapanmış hali — kaydetmeden. Savaş
 * karnesi bunu okur; tavsiye de böylece battle_end'in içinde kayda geçer.
 */
export function projectEnd(e: Extract<TelemetryEvent, { type: 'battle_end' }>): BattleSummary | null {
  if (!current) return null
  const s = structuredClone(current)
  applyEvent(s, { ...e, t: Math.round(clock * 10) / 10 })
  return s
}

/** battle_start'ın attempt alanı: sayacı artırıp kaydeder. */
export function nextAttempt(commander: CommanderId): number {
  const n = (stored.plays[commander] ?? 0) + 1
  stored.plays[commander] = n
  save()
  return n
}

/** Süren savaşı sonuçsuz kapatır; savaş yoksa bir şey yapmaz. */
export function endUnfinished(outcome: 'abandoned' | 'quit'): void {
  if (!current) return
  track({
    type: 'battle_end',
    outcome,
    cause: null,
    score: world.score,
    stars: 0,
    health: Math.round(world.playerHealth),
    wave: world.waveIndex,
    remaining: world.enemies.reduce((n, e) => n + (e.alive && !e.routed ? 1 : 0), 0),
    simTime: world.battle?.time ?? world.time,
  })
}

/** Kayıtlı savaş özetleri, kopyalanmaya hazır JSON. */
export function exportTelemetry(): string {
  return JSON.stringify({ version: 1, plays: stored.plays, log: stored.log })
}

export function loggedBattles(): number {
  return stored.log.length
}

// Mobilde sayfa kapanırken çoğu zaman yalnızca visibilitychange gelir; süren
// savaşın anlık hali o anda yazılır. Geri dönülürse savaş sürer, kayıt
// sonuçta temizlenir.
if (browser) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !current) return
    stored.pending = {
      ...current,
      duration: Math.round(clock * 10) / 10,
      score: world.score,
      health: Math.round(world.playerHealth),
      wave: world.waveIndex,
    }
    save()
  })
}
