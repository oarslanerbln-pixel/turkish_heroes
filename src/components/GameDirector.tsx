import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { HILAL_CONFIG, isStrikeReady } from '../mechanics/hilalSystem'
import type { Vec2 } from '../mechanics/types'
import { useGameStore } from '../store/gameStore'
import { enterMode, isPlaying, simDelta, stepAnnouncements, stepTime, world } from '../sim/world'
import {
  earnedLore,
  isUnlocked,
  recordBattleEnd,
  recordLadder,
  recordLore,
  recordStars,
  recordVictory,
  recordWave,
  takeHint,
} from '../sim/progress'
import { pickLore } from '../lore/lore'
import { scenarioOf } from '../sim/scenarios'
import { saveBestScore } from '../sim/score'
import { battleEnd, stepGame, type StepEffects, type StepInput } from '../sim/step'
import { haptic, play } from '../audio/sfx'
import { duck, setBattleMusic } from '../audio/ambience'
import { COMMANDERS } from '../mechanics/scenario'
import { defeatCause } from '../mechanics/corps'
import { debrief } from '../debrief/debrief'
import { advanceClock, battleActive, nextAttempt, projectEnd, track } from '../telemetry/track'
import { useKeyboard } from '../hooks/useKeyboard'
import { useTouchControls } from '../hooks/useTouchControls'
import { shotDriver } from '../shot'

// Yönetmen karenin ilk işi: simülasyonu bir adım ilerletir (sim/step.ts),
// sonra oyuncu, düşmanlar ve görseller (öncelik ≥ 0) o adımın dünyasını çizer.
// Negatif öncelik elle çizimi açmaz; yalnız pozitifler sayılır.
const DIRECTOR_PRIORITY = -1

/** HUD'u 60Hz yerine ~12Hz güncelle — enerji çubuğu CSS ile yumuşatılıyor. */
const HUD_SYNC_INTERVAL = 0.08

/** Oyunun yan etkileri: ses, titreşim, olay kaydı, oyuncu başına bir kezlik ipuçları. */
const GAME_FX: StepEffects = { play, haptic, duck, track, hint: takeHint }

/** Her kare yeniden yazılır; kare başına nesne üretmesin. */
const input: StepInput = { move: { x: 0, z: 0 }, strike: false }

/**
 * Klavye dijitaldir: birim yön, çapraz hareket hızlı olmasın. Klavye boştaysa
 * dokunmatik joystick (analog, 0–1); iki kaynak birbirini kendiliğinden ezer,
 * ayrı bir "cihaz modu" seçimi gerekmez.
 */
function readMove(keys: ReadonlySet<string>, touch: Vec2, out: Vec2): void {
  let dx = 0
  let dz = 0
  if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1
  if (dx === 0 && dz === 0) {
    out.x = touch.x
    out.z = touch.z
    return
  }
  const len = Math.hypot(dx, dz)
  out.x = dx / len
  out.z = dz / len
}

/**
 * Savaş bitti: ilerleme (kilit, Metehan merdiveni), rekor, karne ve olay
 * kaydı. Zafer puanı ve yıldızlar adımda yazıldı (stepGame). Karne kayıttan
 * önce hesaplanır: gösterilen tavsiye de battle_end'in içinde kayda geçsin
 * ("tavsiye işe yarıyor mu" sorusu için).
 */
function finishBattle(): void {
  const victory = world.outcome === 'victory'
  const locked = COMMANDERS.filter((c) => !isUnlocked(c.id)).map((c) => c.id)
  if (victory) {
    recordVictory(world.commander)
    recordStars(world.commander, world.stars)
  }
  if (world.battle) recordBattleEnd(world.commander)
  else {
    recordLadder(victory)
    recordWave(world.waveIndex)
  }
  world.unlocked = locked.find((id) => isUnlocked(id)) ?? null
  world.bestScore = saveBestScore(world.commander, world.score)

  const end = battleEnd(world)
  const summary = projectEnd(end)
  world.debrief = summary ? debrief(summary, { best: world.bestScore }) : null
  // Kart hemen kaydedilir: oyuncu sonuç ekranını beklemeden kapatsa da kazanılmış sayılır.
  world.lore = summary ? pickLore(summary, earnedLore()) : null
  if (world.lore) recordLore(world.lore.id)
  track({ ...end, advice: world.debrief?.advice.id })

  play(victory ? 'victory' : 'defeat')
  // Zafer üç notalı boruyla aynı ritimde, yenilgi tek ağır titreşim.
  haptic(victory ? [50, 170, 50, 170, 140] : 200)
}

export function GameDirector() {
  const hudTimer = useRef(0)
  const syncHud = useGameStore((s) => s.syncHud)
  const keys = useKeyboard()
  const touch = useTouchControls()

  useFrame((_, delta) => {
    // Sekme arka plandayken delta şişer ve karakter ışınlanır; donmada sıfır.
    const dt = simDelta(delta)
    const realDelta = Math.min(delta, 0.1)
    world.animTime += dt
    const scenario = scenarioOf(world)

    if (isPlaying()) {
      if (!battleActive()) {
        // Hasar çarpanı savaş boyunca sabit: ilerleme sonuçta değişir.
        world.assist = scenario.assist(world)
        track({
          type: 'battle_start',
          commander: world.commander,
          attempt: nextAttempt(world.commander),
          assist: world.assist,
          seed: world.seed,
          ...(world.waveIndex > 0 && { startWave: world.waveIndex }),
        })
      }
      readMove(keys.current, touch, input.move)
      input.strike = world.strikeRequested
      shotDriver.drive?.(world, input)
      const prevOutcome = world.outcome
      stepGame(world, input, dt, GAME_FX, scenario)

      // Kenar flaşı DOM'da: sayaç beklemeden artar, HUD eşitlemesini (12 Hz) beklemez.
      if (world.events.some((e) => e.type === 'hurt')) {
        useGameStore.setState((s) => ({ hurtPulse: s.hurtPulse + 1 }))
      }
      if (world.outcome !== 'playing' && prevOutcome === 'playing') {
        enterMode('outcome')
        finishBattle()
        // Sonuç bu karede eşitlensin: kare döngüsü sonuçta durur, karne beklemesin.
        hudTimer.current = HUD_SYNC_INTERVAL
      }
    } else {
      world.playerVel.x = 0
      world.playerVel.z = 0
    }

    // Müzik savaşla başlar, sonuçta susar; kös hilal enerjisiyle hızlanır.
    setBattleMusic(isPlaying(), world.energy / HILAL_CONFIG.strikeThreshold)

    // İstek her karede tüketilir: vuruş hazır değilken basılan tuş birikip
    // enerji dolar dolmaz kendiliğinden patlamasın.
    world.strikeRequested = false

    // Donma ve hız bu karenin görsellerinde (simDelta) ve sonraki adımda geçerli.
    if (world.mode !== 'paused') stepTime(realDelta)
    // Duyurular da gerçek zamanla: yavaşlayan dünyada uzamasınlar.
    if (isPlaying()) {
      stepAnnouncements(realDelta)
      advanceClock(realDelta)
    }

    // Gerçek zamanla: ağır çekimde HUD ~4 Hz'e düşüyor, donmada hiç güncellenmiyordu.
    hudTimer.current += realDelta
    if (hudTimer.current >= HUD_SYNC_INTERVAL) {
      hudTimer.current = 0
      const b = world.battle
      const siege = scenario.siege(world)
      syncHud({
        phase: world.phase,
        outcome: world.outcome,
        hilalEnergy: world.energy,
        playerHealth: world.playerHealth,
        attackers: world.attackers,
        enemyClusterDensity: siege.density,
        enemyDiscipline: siege.discipline,
        vulnerability: siege.vulnerability,
        enemiesAlive: siege.aliveCount,
        inCrescent: world.inCrescent,
        refusal: world.refusalTimer > 0 ? world.refusal : 'none',
        strikeReady: isStrikeReady(world.energy),
        totalKills: world.totalKills,
        waveIndex: world.waveIndex,
        score: world.score,
        bestScore: world.bestScore,
        announcement: world.announceTimer > 0 ? world.announcement : '',
        stars: world.stars,
        battleTime: b?.time ?? 0,
        campDistance: b ? Math.max(0, b.layout.objectiveZ - b.frontZ) : 0,
        corpsCohesion: b ? b.corps.map((c) => (c.alive > 0 ? c.cohesion : -1)) : [],
        wingOrders: b ? b.wings.map((w) => w.order) : [],
        wingStrength: b ? b.wings.map((w) => w.strength) : [],
        defeatCause: defeatCause(b, world.playerHealth),
        emperorCaptured: b?.emperorCaptured ?? false,
        debrief: world.debrief,
        unlocked: world.unlocked,
        lore: world.lore,
        canBlock: !!b?.layout.pass && !b.blockadeUsed,
        blockade: b?.blockade?.strength ?? 0,
      })
    }
  }, DIRECTOR_PRIORITY)

  return null
}
