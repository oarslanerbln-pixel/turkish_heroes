// Senaryo uygulamaları: yönetmenin komutana göre değişen kısmı.
//
// Yönetmen (GameDirector) ortak döngüyü yürütür — temas, hilal yönü, enerji,
// vuruş, hitstop, HUD. Senaryo yalnızca şunları söyler: düşman nasıl hareket
// eder, kuşatılabilirlik nereden gelir, vuruştan sonra ne olur, savaş nasıl
// akar ve ne zaman biter. Senaryolar birbirini bilmez; Metehan'ın dalga
// mantığı Alp Arslan eklenirken değişmeden buraya taşındı.

import { COMBAT_CONFIG, resolveOutcome, type Outcome } from '../mechanics/combat'
import {
  afterStrike,
  BATTLE_CONFIG,
  battleSiege,
  battleStars,
  countSurrendered,
  resolveBattle,
  stepBattle,
  strikeBudget,
  type BattleEvent,
} from '../mechanics/corps'
import { stepEnemies } from '../mechanics/enemySim'
import { WING_CONFIG } from '../mechanics/wings'
import { calcSiegeState, type FallFilter, type SiegeState } from '../mechanics/hilalSystem'
import type { CommanderId } from '../mechanics/scenario'
import { spawnWave, TOTAL_WAVES, waveClearBonus, waveConfig } from '../mechanics/waves'
import { haptic, play } from '../audio/sfx'
import { announce, type World } from './world'
import { isFirstBattle, takeHint } from './progress'
import { track } from '../telemetry/track'

export interface Scenario {
  /** Temas eden düşman başına saniyelik hasar. */
  contactDamage(): number
  /** Düşmanları bir kare ilerletir (EnemySwarm, öncelik 1). */
  moveEnemies(w: World, dt: number): void
  /** Hilal enerjisini besleyen kuşatılabilirlik. */
  siege(w: World): SiegeState
  /** Yaydakilerden hangisi düşebilir; her sayım/vuruş için yeni. Yoksa hepsi. */
  fallFilter(w: World): FallFilter | undefined
  /** Vuruş düşmanları düşürdükten hemen sonra. */
  afterStrike(w: World): void
  /** Savaşın akışı: dalga geçişleri, gün saati olayları. */
  advance(w: World, dt: number): void
  outcome(w: World): Outcome
  /** Zaferde eklenen puan; yıldızlı senaryo w.stars'ı burada yazar. */
  victoryBonus(w: World): number
}

/** Düşürülen (ya da teslim olan) düşman başına puan. */
export const SCORE_PER_KILL = 100
/** Zaferde kalan can başına bonus — temiz oynamayı ödüllendirir. */
const HEALTH_BONUS_PER_POINT = 5

/** Dalga temizlendikten sonra yenisi doğmadan önceki mola (saniye). */
const WAVE_BREAK = 1.5

function countAlive(w: World): number {
  let n = 0
  for (const e of w.enemies) if (e.alive) n++
  return n
}

/** Metehan: üç dalga halinde gelen, peşine takılınca kümelenen sürü. */
const waves: Scenario = {
  contactDamage: () => COMBAT_CONFIG.damagePerEnemy,

  moveEnemies(w, dt) {
    stepEnemies(
      w.enemies,
      w.player,
      dt,
      w.isRetreating,
      waveConfig(w.waveIndex).disciplineRecoveryMult,
    )
  },

  siege: (w) => calcSiegeState(w.enemies),

  fallFilter: () => undefined,

  afterStrike() {},

  advance(w, dt) {
    // alive yalnızca vuruşla azaldığı için vuruştan sonra, güncel sayıyla.
    const moreWaves = w.waveIndex < TOTAL_WAVES - 1
    if (countAlive(w) > 0 || !moreWaves) return
    if (w.waveBreak === 0) {
      // Bonus temizlendiği anda; yeni dalga düşenler devrildikten sonra.
      w.score += waveClearBonus(w.waveIndex)
      w.waveBreak = WAVE_BREAK
      track({ type: 'wave_clear', wave: w.waveIndex, health: Math.round(w.playerHealth) })
    } else if (dt > 0) {
      w.waveBreak = Math.max(0, w.waveBreak - dt)
      if (w.waveBreak === 0) {
        w.waveIndex++
        w.enemies = spawnWave(w.waveIndex)
        play('wave')
      }
    }
  },

  outcome(w) {
    // Dalga molasında sahada kimse yok ama savaş bitmedi: sıradaki dalga
    // da "kalan düşman" sayılır, yoksa mola anında zafer ilan edilirdi.
    const remaining = countAlive(w) + (w.waveIndex < TOTAL_WAVES - 1 ? 1 : 0)
    return resolveOutcome(w.playerHealth, remaining)
  },

  victoryBonus(w) {
    // Son dalganın temizleme bonusu dalga geçişinde verilmiyor; burada.
    return waveClearBonus(w.waveIndex) + Math.round(w.playerHealth * HEALTH_BONUS_PER_POINT)
  },
}

/** Yıldız başına puan. */
const SCORE_PER_STAR = 500

/** Savaş olaylarının duyurusu; bir kez gösterilen ipuçları dahil. */
const EVENT_TEXT: Record<BattleEvent, string> = {
  harass: 'Menzilde kal — düzenleri bozuluyor',
  charge: 'Hamle! Menzilden çık',
  sunset: 'Güneş batıyor — ordu dönüyor',
  rearguardLeaves: 'Artçı savaş alanını terk ediyor',
  emperorExposed: 'İmparator korumasız!',
  emperorCaptured: 'İmparator esir alındı',
  wingShockLeft: 'Sol kol dönen orduya yüklendi!',
  wingShockRight: 'Sağ kol dönen orduya yüklendi!',
  wingTiredLeft: 'Sol kol yoruldu — pusuya dönüyor',
  wingTiredRight: 'Sağ kol yoruldu — pusuya dönüyor',
}

/** İlk gün batımında (oyuncu başına bir kez) gösterilen ipucu. */
const DUSK_HINT = 'Dönen birlik savunmasız — şimdi kuşat'
/** Kolların ilk tanıtımı: açılış çekimi bitip ordu yaklaşırken. */
const WINGS_HINT = 'Kolların pusuda — taciz ya da hücum emri ver'
const WINGS_HINT_AT = 12
/** Gün batımında pusuda hazır bekleyen kol varsa (bir kez). */
const WINGS_DUSK_HINT = 'Pusudaki kollara HÜCUM emri ver'
/** Ağır çekim süreleri (gerçek zaman, sn). */
const FIRST_CHARGE_SLOWMO = 0.45
const SUNSET_SLOWMO = 0.9

/** Alp Arslan: birlik düzeninde ilerleyen Bizans ordusu, gün batımında dönüş. */
const battle: Scenario = {
  // İlk savaşta hamle hasarı yarıya iner: ilk ödül cezadan önce gelsin.
  contactDamage: () => BATTLE_CONFIG.contactDamage * (isFirstBattle() ? 0.5 : 1),

  moveEnemies(w, dt) {
    if (w.battle) stepBattle(w.battle, w.enemies, w.player, dt)
  },

  siege: (w) => (w.battle ? battleSiege(w.battle, w.enemies) : calcSiegeState(w.enemies)),

  fallFilter: (w) => (w.battle ? strikeBudget(w.battle) : undefined),

  afterStrike(w) {
    if (w.battle) afterStrike(w.battle, w.enemies)
  },

  advance(w) {
    const b = w.battle
    if (!b) return
    // Oyuncu kolları kendi keşfettiyse tanıtım gereksiz.
    if (
      b.time >= WINGS_HINT_AT &&
      b.time < BATTLE_CONFIG.dayLength &&
      b.wings.every((x) => x.order === 'ambush') &&
      takeHint('wings')
    ) {
      announce(WINGS_HINT)
    }
    for (const event of b.events) {
      track({ type: 'battle_event', event })
      switch (event) {
        case 'harass':
          // İpucu oyuncu başına bir kez: ikinci savaşta artık biliyor.
          if (takeHint('harass')) announce(EVENT_TEXT.harass)
          break
        case 'charge':
          play('charge')
          haptic(30)
          // İlk hamle: ağır çekim + ipucu. Oyuncu ne olduğunu görsün, kaçabilsin.
          if (takeHint('charge')) {
            announce(EVENT_TEXT.charge)
            w.slowmo = FIRST_CHARGE_SLOWMO
          }
          break
        case 'sunset':
          play('dusk')
          // Dönüş savaşın kilit anı: her seferinde kısa bir ağır çekimle başlar.
          w.slowmo = SUNSET_SLOWMO
          w.cameraCue = 'dusk'
          announce(takeHint('dusk') ? DUSK_HINT : EVENT_TEXT.sunset)
          if (
            b.wings.some((x) => x.order === 'ambush' && x.strength >= WING_CONFIG.readyStrength) &&
            takeHint('wingsDusk')
          ) {
            announce(WINGS_DUSK_HINT)
          }
          break
        case 'wingShockLeft':
        case 'wingShockRight':
          play('wingCharge')
          haptic(40)
          announce(EVENT_TEXT[event])
          break
        case 'emperorExposed':
          play('horn')
          announce(EVENT_TEXT.emperorExposed)
          break
        default:
          announce(EVENT_TEXT[event])
      }
    }
    b.events.length = 0
  },

  outcome(w) {
    return w.battle ? resolveBattle(w.battle, w.enemies, w.playerHealth) : 'playing'
  },

  victoryBonus(w) {
    if (!w.battle) return 0
    w.stars = battleStars(w.battle, w.enemies)
    // İmparator esir düşünce kalan ordu teslim olur; esirler de puan getirir.
    const surrendered = countSurrendered(w.battle, w.enemies)
    return (
      surrendered * SCORE_PER_KILL +
      w.stars * SCORE_PER_STAR +
      Math.round(w.playerHealth * HEALTH_BONUS_PER_POINT)
    )
  },
}

const SCENARIOS: Record<CommanderId, Scenario> = {
  metehan: waves,
  'alp-arslan': battle,
}

export function scenarioOf(w: World): Scenario {
  return SCENARIOS[w.commander]
}
