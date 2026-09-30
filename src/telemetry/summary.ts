// Oynanış olayları ve savaş başına özet.
//
// Denge şu an bot simülasyonuna dayanıyor; gerçek oyuncu verisi için her savaş
// tek bir özet kaydına indirgenir: süre, sonuç ve nedeni, vuruş başına düşen,
// ret sayıları, dalga ve savaş olaylarının zamanı. Bu dosya saf — kayıt ve
// iletim track.ts'te.

import type { Outcome } from '../mechanics/combat'
import type { BattleEvent } from '../mechanics/corps'
import type { CommanderId } from '../mechanics/scenario'
import type { StrikeRefusal } from '../mechanics/types'

export type Refusal = Exclude<StrikeRefusal, 'none'>
/** Sayfa savaş sürerken kapandıysa 'abandoned'. */
export type EndOutcome = Exclude<Outcome, 'playing'> | 'abandoned'
export type DefeatCause = 'health' | 'camp'

export type TelemetryEvent =
  /** attempt: bu cihazda o komutanla başlatılan kaçıncı savaş (1 tabanlı). */
  | { type: 'battle_start'; commander: CommanderId; attempt: number }
  /** Metehan: dalga temizlendi. Sıradaki dalga mola sonrası başlar. */
  | { type: 'wave_clear'; wave: number; health: number }
  /** alive: vuruştan önce sahada (Malazgirt'te teslim olmamış) kalan. */
  | { type: 'strike'; kills: number; alive: number }
  | { type: 'strike_refused'; reason: Refusal }
  /** Malazgirt: taciz, hamle, gün batımı… */
  | { type: 'battle_event'; event: BattleEvent }
  | {
      type: 'battle_end'
      outcome: EndOutcome
      /** Yalnızca yenilgide. */
      cause: DefeatCause | null
      score: number
      stars: number
      health: number
      wave: number
    }

/** Olay + savaşın başından beri geçen oyun süresi (sn, gerçek zaman). */
export type Stamped = TelemetryEvent & { t: number }

export interface BattleSummary {
  /** Sayfa yüklemesi başına rastgele kimlik: aynı oturumda tekrar oynamayı ayırır. */
  session: string
  /** Başlangıç anı (epoch ms). */
  startedAt: number
  commander: CommanderId
  attempt: number
  outcome: EndOutcome | 'playing'
  cause: DefeatCause | null
  /** Oyun süresi (sn); sekme arka plandayken işlemez. */
  duration: number
  score: number
  stars: number
  health: number
  /** Ulaşılan dalga (0 tabanlı); Malazgirt'te hep 0. */
  wave: number
  strikes: { t: number; kills: number; alive: number }[]
  refusals: Record<Refusal, number>
  waves: { wave: number; t: number; health: number }[]
  events: { event: BattleEvent; t: number }[]
}

export function startSummary(
  e: Extract<TelemetryEvent, { type: 'battle_start' }>,
  session: string,
  startedAt: number,
): BattleSummary {
  return {
    session,
    startedAt,
    commander: e.commander,
    attempt: e.attempt,
    outcome: 'playing',
    cause: null,
    duration: 0,
    score: 0,
    stars: 0,
    health: 100,
    wave: 0,
    strikes: [],
    refusals: { notReady: 0, noTargets: 0, steady: 0 },
    waves: [],
    events: [],
  }
}

/** Olayı özete işler (yerinde). */
export function applyEvent(s: BattleSummary, e: Stamped): void {
  s.duration = e.t
  switch (e.type) {
    case 'battle_start':
      break
    case 'wave_clear':
      s.waves.push({ wave: e.wave, t: e.t, health: e.health })
      s.wave = e.wave + 1
      s.health = e.health
      break
    case 'strike':
      s.strikes.push({ t: e.t, kills: e.kills, alive: e.alive })
      break
    case 'strike_refused':
      s.refusals[e.reason]++
      break
    case 'battle_event':
      s.events.push({ event: e.event, t: e.t })
      break
    case 'battle_end':
      s.outcome = e.outcome
      s.cause = e.cause
      s.score = e.score
      s.stars = e.stars
      s.health = e.health
      s.wave = e.wave
      break
  }
}
