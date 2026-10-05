import { describe, expect, it } from 'vitest'
import { battleSiege, countFallen, MALAZGIRT, MIRYOKEFALON, type BattleLayout } from '../mechanics/corps'
import {
  BOT_DT,
  greedyBot,
  passiveBot,
  runBattle,
  safeHarasser,
  type Bot,
  type BotAction,
} from '../mechanics/battleBots'
import { HILAL_CONFIG } from '../mechanics/hilalSystem'
import { SILENT_FX, stepGame, type StepInput } from './step'
import { createWorld, type World } from './world'

const IDLE: StepInput = { move: { x: 0, z: 0 }, strike: false }

/** Oyunun döngüsü: yönetmen gibi her adımda stepGame, karenin sonunda olaylar boşalır. */
function playGame(layout: BattleLayout, seed: number, assist: number, inputs?: StepInput[]): World {
  const w = createWorld(layout.pass ? 'kilicarslan' : 'alp-arslan', { seed, layout })
  w.assist = assist
  for (let i = 0; w.outcome === 'playing'; i++) {
    stepGame(w, inputs ? inputs[i] : IDLE, BOT_DT, SILENT_FX)
    w.events.length = 0
  }
  return w
}

describe('bot ile oyun döngüsü (MIMARI.md S1, S4)', () => {
  it('aynı tohum ve girdiyle aynı dünyaya varır', () => {
    // Botun girdisini kaydet, oyunun döngüsünde aynen oynat.
    const actions: BotAction[] = []
    const harasser = safeHarasser()()
    const bot: Bot = (v) => {
      const a = harasser(v)
      actions.push({ move: { ...a.move }, strike: a.strike })
      return a
    }
    const run = runBattle(bot, 7)
    const inputs = actions.map((a) => ({
      move: { x: a.move.x / HILAL_CONFIG.retreatSpeed, z: a.move.z / HILAL_CONFIG.retreatSpeed },
      strike: a.strike,
    }))
    const w = playGame(MALAZGIRT, 7, 1, inputs)

    expect(run.strikes.length).toBeGreaterThan(0)
    expect(w.outcome).toBe(run.result)
    expect(w.battle!.time).toBe(run.time)
    expect(w.playerHealth).toBe(run.health)
    expect(w.score).toBe(run.score)
    expect(countFallen(w.enemies)).toBe(run.fallen)
  })

  it('tohum 1071, boşta: oyun döngüsü ile pasif bot aynı sonuca varır', () => {
    // Adım 1.8 bulgusu (tarayıcıda, ilk savaş): boşta Malazgirt t=160'ta
    // zafer, Miryokefalon t≈85'te yenilgi. Ayrışma döngüde değil, ilk savaşın
    // yarı hasarındaydı (assist 0,5); testler tam hasarla koşuyordu.
    for (const layout of [MALAZGIRT, MIRYOKEFALON]) {
      for (const assist of [0.5, 1]) {
        const w = playGame(layout, 1071, assist)
        const run = runBattle(passiveBot(), 1071, undefined, layout, assist)
        expect(run.result).toBe(w.outcome)
        expect(run.time).toBe(w.battle!.time)
        expect(run.score).toBe(w.score)
      }
    }
    const firstBattle = runBattle(passiveBot(), 1071, undefined, MALAZGIRT, 0.5)
    expect(firstBattle.result).toBe('victory')
    expect(firstBattle.time).toBeCloseTo(160, 5)
    expect(runBattle(passiveBot(), 1071, undefined, MIRYOKEFALON, 0.5).result).toBe('defeat')
  })

  it('vuruştan sonra 0,9 sn enerji dolmaz — botlarda da', () => {
    const samples: { t: number; energy: number; vulnerability: number }[] = []
    const strikeTimes: number[] = []
    const greedy = greedyBot()
    const bot: Bot = (v) => {
      samples.push({
        t: v.battle.time,
        energy: v.energy,
        vulnerability: battleSiege(v.battle, v.enemies).vulnerability,
      })
      return greedy(v)
    }
    runBattle(bot, 1071, (e, t) => {
      if (e.type === 'strike') strikeTimes.push(t)
    })

    expect(strikeTimes.length).toBeGreaterThan(1)
    let frozenUnderPressure = 0
    for (const ts of strikeTimes) {
      for (const s of samples) {
        if (s.t <= ts || s.t >= ts + HILAL_CONFIG.strikeDuration - 1e-6) continue
        expect(s.energy).toBe(0)
        if (s.vulnerability > 0) frozenUnderPressure++
      }
    }
    // Donma gerçekten bir şey durdurdu: kuşatmaya açıklık varken enerji dolmadı.
    expect(frozenUnderPressure).toBeGreaterThan(0)
  })
})
