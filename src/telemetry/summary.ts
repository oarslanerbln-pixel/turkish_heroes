// Oynanış olayları ve savaş başına özet.
//
// Denge şu an bot simülasyonuna dayanıyor; gerçek oyuncu verisi için her savaş
// tek bir özet kaydına indirgenir: süre, sonuç ve nedeni, vuruş başına düşen,
// ret sayıları, dalga ve savaş olaylarının zamanı. Bu dosya saf — kayıt ve
// iletim track.ts'te.

import type { Outcome } from '../mechanics/combat'
import type { BattleEvent, DefeatCause } from '../mechanics/corps'
import type { CommanderId } from '../mechanics/scenario'
import type { StrikeRefusal } from '../mechanics/types'
import type { WingOrder } from '../mechanics/wings'

export type Refusal = Exclude<StrikeRefusal, 'none'>
/**
 * Sonucu gelmeden biten savaş: sayfa kapandıysa 'abandoned', oyuncu moladan
 * yeniden başlattı ya da komutanlara döndüyse 'quit'.
 */
export type EndOutcome = Exclude<Outcome, 'playing'> | 'abandoned' | 'quit'

export type TelemetryEvent =
  /**
   * attempt: bu cihazda o komutanla başlatılan kaçıncı savaş (1 tabanlı).
   * assist: temas hasarının çarpanı (1 = tam; Metehan'da zorluk merdiveni).
   */
  | {
      type: 'battle_start'
      commander: CommanderId
      attempt: number
      assist: number
      seed: number | null
      /** Metehan: savaş bu dalgadan başladı (Baideng'den yeniden); yoksa 0. */
      startWave?: number
    }
  /** Metehan: dalga temizlendi. Sıradaki dalga mola sonrası başlar. */
  | { type: 'wave_clear'; wave: number; health: number }
  /** Metehan: vuruştan sonra dalganın artığı bozguna uğradı. */
  | { type: 'rout'; count: number }
  /** Baideng: arbalet yaylımı indi. hit oyuncu halkadaydı; felled halkada düşen Han atlısı. */
  | { type: 'volley'; hit: boolean; felled: number }
  /** Miryokefalon: YOLU KES — yığının düştüğü z (geçidin neresi: asıl karar). */
  | { type: 'blockade'; z: number }
  /** alive: vuruştan önce sahada (Malazgirt'te teslim olmamış) kalan. */
  | { type: 'strike'; kills: number; alive: number }
  | { type: 'strike_refused'; reason: Refusal }
  /** Malazgirt: taciz, hamle, gün batımı… */
  | { type: 'battle_event'; event: BattleEvent }
  /** auto: uygulamadan çıkıldığı için (oyuncu durdurmadı). */
  | { type: 'pause'; auto: boolean }
  /** Malazgirt: kola emir. wing: 0 sol, 1 sağ. */
  | { type: 'wing_order'; wing: number; order: WingOrder }
  /**
   * Malazgirt gün batımı anı: birliklerin düzeni (sol, merkez, sağ, artçı),
   * kolların gücü (0–1) ve oyuncunun canı. Akşamın nasıl karşılandığı —
   * karnenin asıl verisi.
   */
  | { type: 'dusk'; cohesion: number[]; wings: number[]; health: number }
  | {
      type: 'battle_end'
      outcome: EndOutcome
      /** Yalnızca yenilgide. */
      cause: DefeatCause | null
      score: number
      stars: number
      health: number
      wave: number
      /** Sahada kalan düşman (teslim olan ve kaçan sayılmaz). */
      remaining: number
      /** Simülasyon saati (sn): Malazgirt'te gün çizgisiyle aynı ölçek. */
      simTime: number
      /** Sonuç ekranında gösterilen tavsiye (bkz. debrief.ts). */
      advice?: string
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
  /** Temas hasarının çarpanı: zafer oranı buna göre okunmalı. */
  assist: number
  /** Ordu dizilişinin tohumu: ?seed= ile aynı savaş yeniden kurulur. Dalgalı savaşta null. */
  seed: number | null
  outcome: EndOutcome | 'playing'
  cause: DefeatCause | null
  /** Oyun süresi (sn); sekme arka plandayken işlemez. */
  duration: number
  score: number
  stars: number
  health: number
  /** Savaşın başladığı dalga (0 tabanlı): Baideng'den yeniden başlayınca 0 değil. */
  startWave: number
  /** Ulaşılan dalga (0 tabanlı); Malazgirt'te hep 0. */
  wave: number
  strikes: { t: number; kills: number; alive: number }[]
  refusals: Record<Refusal, number>
  waves: { wave: number; t: number; health: number }[]
  routs: { t: number; count: number }[]
  /** Baideng'in arbalet yaylımları. */
  volleys: { t: number; hit: boolean; felled: number }[]
  /** Miryokefalon: yolun kesildiği an ve yer; kesilmediyse null. */
  blockade: { t: number; z: number } | null
  events: { event: BattleEvent; t: number }[]
  pauses: { t: number; auto: boolean }[]
  /** Kollara verilen emirler — oyuncu kolları kullanıyor mu, ne zaman. */
  orders: { t: number; wing: number; order: WingOrder }[]
  /** Malazgirt: gün batımında birliklerin düzeni ve kolların gücü. */
  dusk: { t: number; cohesion: number[]; wings: number[]; health: number } | null
  remaining: number
  simTime: number
  /**
   * Oyuncuya gösterilen tavsiye. Bir sonraki denemenin sonucuyla birlikte
   * "tavsiye işe yarıyor mu" sorusunu cevaplar.
   */
  advice: string | null
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
    assist: e.assist,
    seed: e.seed,
    outcome: 'playing',
    cause: null,
    duration: 0,
    score: 0,
    stars: 0,
    health: 100,
    startWave: e.startWave ?? 0,
    wave: e.startWave ?? 0,
    strikes: [],
    refusals: { notReady: 0, noTargets: 0, steady: 0 },
    waves: [],
    routs: [],
    volleys: [],
    blockade: null,
    events: [],
    pauses: [],
    orders: [],
    dusk: null,
    remaining: 0,
    simTime: 0,
    advice: null,
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
    case 'rout':
      s.routs.push({ t: e.t, count: e.count })
      break
    case 'volley':
      s.volleys.push({ t: e.t, hit: e.hit, felled: e.felled })
      break
    case 'blockade':
      s.blockade = { t: e.t, z: e.z }
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
    case 'pause':
      s.pauses.push({ t: e.t, auto: e.auto })
      break
    case 'wing_order':
      s.orders.push({ t: e.t, wing: e.wing, order: e.order })
      break
    case 'dusk':
      s.dusk = { t: e.t, cohesion: e.cohesion, wings: e.wings, health: e.health }
      break
    case 'battle_end':
      s.outcome = e.outcome
      s.cause = e.cause
      s.score = e.score
      s.stars = e.stars
      s.health = e.health
      s.wave = e.wave
      s.remaining = e.remaining
      s.simTime = e.simTime
      s.advice = e.advice ?? null
      break
  }
}
