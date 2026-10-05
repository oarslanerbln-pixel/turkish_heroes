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
  CENTER,
  battleStars,
  countSurrendered,
  resolveBattle,
  stepBattle,
  strikeBudget,
  type BattleEvent,
  type BattleState,
} from '../mechanics/corps'
import { PASS } from '../mechanics/pass'
import {
  afterBaidengStrike,
  createBaidengState,
  siegeCorps,
  stepCommand,
  stepPeace,
  stepVolleys,
  type BaidengEvent,
} from '../mechanics/baideng'
import { stepEnemies } from '../mechanics/enemySim'
import { WING_CONFIG } from '../mechanics/wings'
import { calcSiegeState, type FallFilter, type SiegeState } from '../mechanics/hilalSystem'
import type { CommanderId } from '../mechanics/scenario'
import {
  ladderScale,
  restHealth,
  routSurvivors,
  spawnWave,
  TOTAL_WAVES,
  waveBreak,
  waveClearBonus,
  waveConfig,
  wavesStars,
} from '../mechanics/waves'
import { haptic, play } from '../audio/sfx'
import { announce, type World } from './world'
import { isFirstBattle, ladderStep, takeHint } from './progress'
import { track } from '../telemetry/track'

export interface Scenario {
  /**
   * Temas hasarının çarpanı (1 = tam): Metehan'da zorluk merdiveni, Malazgirt'te
   * ilk savaşın yarı hasarı. Olay takibi de kaydeder — zafer oranı buna göre okunur.
   */
  assist(w: World): number
  /** Temas eden düşman başına saniyelik hasar. */
  contactDamage(w: World): number
  /**
   * Temastan başka gelen hasar, çarpanı uygulanmış (Baideng'in arbalet
   * yaylımları). Yönetmen temas hasarıyla toplayıp yaraya işler.
   */
  hazards(w: World, dt: number): number
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

function countAlive(w: World): number {
  let n = 0
  for (const e of w.enemies) if (e.alive) n++
  return n
}

/** Baideng kurallarının bu karedeki olayları; presentBaideng boşaltır. */
const baidengEvents: BaidengEvent[] = []

/** Çember kurulurken ağır çekim (gerçek sn): dört yandan gelen atlılar görülsün. */
const ENCIRCLE_SLOWMO = 0.9

/**
 * Baideng olaylarını sunar: dünya olayı, ses, duyuru, puan ve telemetri.
 * Yaylımın altında düşen Han atlısı oyuncunun hanesine yazılır: onları
 * oraya o çekti.
 */
function presentBaideng(w: World): void {
  for (const e of baidengEvents) {
    switch (e.type) {
      case 'volleyAimed':
        if (takeHint('volley')) announce('Kırmızı halka: Han arbaletleri — halkadan çık')
        play('volley')
        w.events.push(e)
        break
      case 'volleyLanded': {
        const felled = e.felled.length
        if (felled > 0 && w.baideng?.felled === felled) {
          announce('Han atlıları kendi oklarının altında kaldı!')
        }
        w.totalKills += felled
        w.score += felled * SCORE_PER_KILL
        track({ type: 'volley', hit: e.hit, felled })
        w.events.push({ type: 'volleyLanded', x: e.x, z: e.z, hit: e.hit, felled })
        break
      }
      case 'encircle':
        announce('Dört yandan Hun atlıları — Gaozu kuşatılıyor!')
        play('horn')
        w.slowmo = ENCIRCLE_SLOWMO
        w.cameraCue = 'encircle'
        track({ type: 'rout', count: e.routed })
        w.events.push({ type: 'rout', count: e.routed })
        w.events.push({ type: 'encircle', center: e.center })
        break
      case 'peace':
        announce('Han barış istedi — Baideng, MÖ 200')
        w.events.push(e)
        break
    }
  }
  baidengEvents.length = 0
}

/** Metehan: dört dalga halinde gelen, peşine takılınca kümelenen sürü. */
const waves: Scenario = {
  assist: () => ladderScale(ladderStep()),
  contactDamage: () => COMBAT_CONFIG.damagePerEnemy * ladderScale(ladderStep()),

  hazards(w, dt) {
    if (!w.baideng) return 0
    const damage = stepVolleys(w.baideng, w.enemies, w.player, w.playerVel, dt, baidengEvents)
    presentBaideng(w)
    return damage * ladderScale(ladderStep())
  },

  moveEnemies(w, dt) {
    stepEnemies(
      w.enemies,
      w.player,
      dt,
      w.isRetreating,
      waveConfig(w.waveIndex).disciplineRecoveryMult,
    )
    if (w.baideng) stepCommand(w.baideng, w.enemies, w.player, dt)
  },

  siege: (w) => calcSiegeState(w.enemies, w.baideng ? siegeCorps(w.baideng) : undefined),

  fallFilter: () => undefined,

  afterStrike(w) {
    if (w.baideng) {
      // Baideng'de gövdenin artığı tek başına kaçmaz: çember kurulur.
      afterBaidengStrike(w.baideng, w.enemies, baidengEvents)
      presentBaideng(w)
      return
    }
    // Kırılan dalganın artığı dağılır: son bir-iki düşmanın peşinde ölmek yok.
    const routed = routSurvivors(w.enemies, w.waveIndex)
    if (routed === 0) return
    announce(routed === 1 ? 'Bozgun! Son düşman kaçıyor' : `Bozgun! Kalan ${routed} düşman kaçıyor`)
    play('rout')
    track({ type: 'rout', count: routed })
    w.events.push({ type: 'rout', count: routed })
  },

  advance(w, dt) {
    if (w.baideng) {
      stepPeace(w.baideng, w.enemies, baidengEvents)
      presentBaideng(w)
    }
    // alive yalnızca vuruşla azaldığı için vuruştan sonra, güncel sayıyla.
    const moreWaves = w.waveIndex < TOTAL_WAVES - 1
    if (countAlive(w) > 0 || !moreWaves) return
    const next = w.waveIndex + 1
    if (w.waveBreak === 0) {
      // Bonus temizlendiği anda; yeni dalga düşenler devrildikten sonra.
      w.score += waveClearBonus(w.waveIndex)
      w.waveBreak = waveBreak(next)
      track({ type: 'wave_clear', wave: w.waveIndex, health: Math.round(w.playerHealth) })
      if (waveConfig(next).rest) {
        // Molada sahada kimse yok: can molanın başında dönse de sonu aynı.
        w.restedFrom = w.playerHealth
        w.playerHealth = restHealth(w.playerHealth, next)
        announce(`Ordu soluklandı: +${Math.round(w.playerHealth - w.restedFrom)} can`)
      }
    } else if (dt > 0) {
      w.waveBreak = Math.max(0, w.waveBreak - dt)
      if (w.waveBreak === 0) {
        w.waveIndex = next
        const cfg = waveConfig(next)
        w.baideng = cfg.baideng ? createBaidengState(cfg.enemyCount) : null
        // Yeni dalga oyuncunun yakasından, arkadan gelir; kıskaç müfrezesi
        // gittiği yönde (bkz. spawnWave).
        w.enemies = spawnWave(next, w.player, w.playerVel)
        play('wave')
        w.events.push({ type: 'waveSpawn', wave: next })
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
    // Merdiven bu savaşın sonucuyla finishBattle'da ilerliyor, yani burada
    // hâlâ oynanan basamak. Yıldız puanı yok: can bonusu yarayı zaten sayıyor.
    w.stars = wavesStars(w.playerHealth, ladderScale(ladderStep()), w.restedFrom ?? undefined)
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
  // Geçitte (Miryokefalon) bu olayların kendi metni var: bkz. PASS_TEXT.
  wingTiredLeft: 'Sol kol yoruldu — pusuya dönüyor',
  wingTiredRight: 'Sağ kol yoruldu — pusuya dönüyor',
  blockade: 'Yol kesildi — kol duruyor',
  blockadeCleared: 'Öncü yığını temizledi — yol açıldı',
  jam: 'Kol sıkıştı — şimdi kuşat',
}

/** Miryokefalon'da aynı olayın geçitteki anlatımı. */
const PASS_TEXT: Partial<Record<BattleEvent, string>> = {
  emperorExposed: 'Manuel açıkta — muhafızları sıkıştı!',
  emperorCaptured: 'Manuel kuşatıldı — sultan barış önerdi',
  wingShockLeft: 'Sol yamaç sıkışan kola indi!',
  wingShockRight: 'Sağ yamaç sıkışan kola indi!',
  wingTiredLeft: 'Sol yamaç yoruldu — sırta dönüyor',
  wingTiredRight: 'Sağ yamaç yoruldu — sırta dönüyor',
}

function eventText(b: BattleState, event: BattleEvent): string {
  return (b.layout.pass && PASS_TEXT[event]) || EVENT_TEXT[event]
}

/** Kol boğaza bu kadar yaklaşınca, yol henüz kesilmediyse (bir kez) ipucu. */
const BLOCKADE_HINT = 'Kol boğaza yaklaşıyor — boğazın hemen ötesinde YOLU KES'
const BLOCKADE_HINT_DISTANCE = 12
/** Sıkışma kuşatma anı: ilk kez ağır sıkışınca kısa ağır çekim. */
const JAM_SLOWMO = 0.6

/** İlk gün batımında (oyuncu başına bir kez) gösterilen ipucu. */
const DUSK_HINT = 'Dönen birlik savunmasız — şimdi kuşat'
/** Kolların ilk tanıtımı: açılış çekimi bitip ordu yaklaşırken. */
const WINGS_HINT = 'Kolların pusuda — taciz ya da hücum emri ver'
const WINGS_HINT_AT = 12
/** Gün batımında pusuda hazır bekleyen kol varsa (bir kez). */
const WINGS_DUSK_HINT = 'Pusudaki kollara HÜCUM emri ver'
const round2 = (v: number) => Math.round(v * 100) / 100

/** Ağır çekim süreleri (gerçek zaman, sn). */
const FIRST_CHARGE_SLOWMO = 0.45
const SUNSET_SLOWMO = 0.9

/**
 * Ok kamerası (bkz. components/arrowShot.ts) savaş başına en çok iki kez:
 * oyuncunun ilk tacizi (oklar düzeni bozar, bu anlatılsın) ve imparatorun
 * açığa çıkışı (merkeze giden ilk ok). Ok bu süre (gerçek sn) içinde
 * kalkmazsa istek düşer: oyuncu menzilden çıkmış olabilir.
 */
const ARROW_CUE_WAIT = 2.5

/**
 * Ordu düzeninde savaş: Alp Arslan (Malazgirt, açık bozkır, gün batımında
 * dönüş) ve II. Kılıçarslan (Miryokefalon, geçitte kol). Kurallar ortak;
 * farkı savaş alanı düzeni (corps.ts BattleLayout) taşır.
 */
const battle: Scenario = {
  // Komutanla ilk savaşta hamle hasarı yarıya iner: ilk ödül cezadan önce gelsin.
  assist: (w) => (isFirstBattle(w.commander) ? 0.5 : 1),
  contactDamage: (w) => BATTLE_CONFIG.contactDamage * (isFirstBattle(w.commander) ? 0.5 : 1),
  hazards: () => 0,

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
    // Geçit: kol boğaza yaklaşırken yol hâlâ açıksa, bir kez.
    if (
      b.layout.pass &&
      !b.blockadeUsed &&
      b.frontZ > PASS.neckZ - BLOCKADE_HINT_DISTANCE &&
      takeHint('blockade')
    ) {
      announce(BLOCKADE_HINT)
    }
    // Oyuncu kolları kendi keşfettiyse tanıtım gereksiz.
    if (
      b.time >= WINGS_HINT_AT &&
      b.time < b.layout.dayLength &&
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
          w.arrowCue = { corps: null, wait: ARROW_CUE_WAIT }
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
          track({
            type: 'dusk',
            cohesion: b.corps.map((c) => round2(c.cohesion)),
            wings: b.wings.map((x) => round2(x.strength)),
            health: Math.round(w.playerHealth),
          })
          play('dusk')
          // Dönüş savaşın kilit anı: her seferinde kısa bir ağır çekimle başlar.
          w.slowmo = SUNSET_SLOWMO
          w.events.push({ type: 'sunset' })
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
          announce(eventText(b, event))
          break
        case 'emperorExposed':
          play('horn')
          announce(eventText(b, event))
          w.arrowCue = { corps: CENTER, wait: ARROW_CUE_WAIT }
          break
        case 'blockade':
          play('rockslide')
          haptic([30, 20, 60])
          announce(EVENT_TEXT.blockade)
          break
        case 'jam':
          // Sıkışma geçidin hasat anı (Malazgirt'teki dönüş gibi): ağır çekimle okunsun.
          play('dusk')
          w.slowmo = JAM_SLOWMO
          takeHint('jam')
          announce(EVENT_TEXT.jam)
          break
        default:
          announce(eventText(b, event))
      }
    }
    b.events.length = 0
    for (const c of b.charges) w.events.push({ type: 'charge', corps: c.corps, pos: c.pos })
    b.charges.length = 0
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
  kilicarslan: battle,
}

export function scenarioOf(w: World): Scenario {
  return SCENARIOS[w.commander]
}
