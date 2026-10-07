// Senaryo uygulamaları: simülasyon adımının komutana göre değişen kısmı.
//
// Adım (step.ts) ortak döngüyü yürütür — temas, hilal yönü, enerji, vuruş.
// Senaryo yalnızca şunları söyler: düşman nasıl hareket
// eder, kuşatılabilirlik nereden gelir, vuruştan sonra ne olur, savaş nasıl
// akar ve ne zaman biter. Senaryolar birbirini bilmez; Metehan'ın dalga
// mantığı Alp Arslan eklenirken değişmeden buraya taşındı.

import { COMBAT_CONFIG, resolveOutcome, type Outcome } from '../mechanics/combat'
import {
  afterStrike,
  BATTLE_CONFIG,
  battleSiege,
  CENTER,
  CORPS,
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
import { canSpring, WING_CONFIG } from '../mechanics/wings'
import {
  calcSiegeState,
  isStrikeReady,
  type FallFilter,
  type SiegeState,
} from '../mechanics/hilalSystem'
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
import { announce, type World } from './world'
import { isFirstBattle, ladderStep } from './progress'
import type { StepEffects } from './step'

export interface Scenario {
  /**
   * Bu savaşın hasar çarpanı (1 = tam): Metehan'da zorluk merdiveni, Malazgirt'te
   * ilk savaşın yarı hasarı. Oyuncunun ilerlemesini okur; yönetmen savaş başında
   * bir kez world.assist'e yazar. Olay takibi de kaydeder — zafer oranı buna göre okunur.
   */
  assist(w: World): number
  /** Temas eden düşman başına saniyelik hasar (world.assist uygulanmış). */
  contactDamage(w: World): number
  /**
   * Temastan başka gelen hasar, çarpanı uygulanmış (Baideng'in arbalet
   * yaylımları). Adım temas hasarıyla toplayıp yaraya işler.
   */
  hazards(w: World, dt: number, fx: StepEffects): number
  /** Düşmanları bir adım ilerletir. */
  moveEnemies(w: World, dt: number): void
  /** Hilal enerjisini besleyen kuşatılabilirlik. */
  siege(w: World): SiegeState
  /** Yaydakilerden hangisi düşebilir; her sayım/vuruş için yeni. Yoksa hepsi. */
  fallFilter(w: World): FallFilter | undefined
  /** Vuruş düşmanları düşürdükten hemen sonra. */
  afterStrike(w: World, fx: StepEffects): void
  /** Savaşın akışı: dalga geçişleri, gün saati olayları. */
  advance(w: World, dt: number, fx: StepEffects): void
  outcome(w: World): Outcome
  /** Zaferde eklenen puan; yıldızlı senaryo w.stars'ı burada yazar. */
  victoryBonus(w: World): number
  /** Taban puanı bu savaşın zorluğuna çevirir; bkz. waveScore. */
  points(w: World, base: number): number
  /** Islıklı ok bu savaşta var mı (yalnız Metehan; bkz. whistle.ts). */
  whistle?: boolean
}

/** Düşürülen (ya da teslim olan) düşman başına puan. */
export const SCORE_PER_KILL = 100
/** Zaferde kalan can başına bonus — temiz oynamayı ödüllendirir. */
const HEALTH_BONUS_PER_POINT = 5

/**
 * Metehan puanı oynanan merdiven basamağıyla ölçeklenir (O4): yarı hasarda
 * (başlangıç) ×1, tam hasarda ×2, tabanda ×0,4. Ölçeklenmeyen puanda kolay
 * basamaktaki koşu daha çok dalga ve can bonusu toplar, rekoru zor
 * basamağınkini geçerdi. Başlangıç ×1: eski rekorlar bugünkü ölçekte kalır.
 */
function waveScore(w: World, base: number): number {
  return Math.round((base * w.assist) / ladderScale(0))
}

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
function presentBaideng(w: World, fx: StepEffects): void {
  for (const e of baidengEvents) {
    switch (e.type) {
      case 'volleyAimed':
        if (fx.hint('volley')) announce(w, 'Kırmızı halka: Han arbaletleri — halkadan çık')
        fx.play('volley')
        w.events.push(e)
        break
      case 'volleyLanded': {
        const felled = e.felled.length
        if (felled > 0 && w.baideng?.felled === felled) {
          announce(w, 'Han atlıları kendi oklarının altında kaldı!')
        }
        w.totalKills += felled
        w.score += waveScore(w, felled * SCORE_PER_KILL)
        fx.track({ type: 'volley', hit: e.hit, felled })
        w.events.push({ type: 'volleyLanded', x: e.x, z: e.z, hit: e.hit, felled })
        break
      }
      case 'encircle':
        announce(w, 'Dört yandan Hun atlıları — Gaozu kuşatılıyor!')
        fx.play('horn')
        w.slowmo = ENCIRCLE_SLOWMO
        w.cameraCue = 'encircle'
        fx.track({ type: 'rout', count: e.routed })
        w.events.push({ type: 'rout', count: e.routed })
        w.events.push({ type: 'encircle', center: e.center })
        break
      case 'peace':
        announce(w, 'Han barış istedi — Baideng, MÖ 200')
        w.events.push(e)
        break
    }
  }
  baidengEvents.length = 0
}

/**
 * Durana yüklenme (TASARIM Mantık 1): bu hızın altındaki oyuncu duruyor
 * sayılır; STILL_GRACE sn sonra sürünün koruduğu mesafe STILL_RAMP sn içinde
 * sıfıra iner. Bekleyen oyuncu da savaşı bitirir: yenilerek. Nişan almak
 * için durmak (1–2 sn) cezasız.
 */
const STILL_SPEED = 0.5
const STILL_GRACE = 5
const STILL_RAMP = 3
const STILL_HINT = 'Duran atlı hedeftir — çekil, peşine tak'

export function stillPress(stillTime: number): number {
  return Math.min(1, Math.max(0, (stillTime - STILL_GRACE) / STILL_RAMP))
}

/**
 * Hilalin nasıl dolduğu ilk dakikada öğretilir (TASARIM Mantık 5, O5/O7):
 * her ipucu sırası gelince bir kez. Dolduramayan oyuncu "dolmuyor"u duyar;
 * dolduran, dolarken neden dolduğunu; kuran, ne yapacağını.
 */
/** Uzman bot hilali ~9 sn'de doldurmaya başlıyor; 15 sn'de hâlâ boşsa takılmıştır. */
const STALL_HINT_AT = 15
const STALL_HINT_UNTIL = 60
/** Enerjinin "dolmuyor" sayıldığı üst sınır (eşik 100). */
const STALL_ENERGY = 15
const FILL_HINT_ENERGY = 30
const STALL_HINT = 'Hilal dolmuyor: düşman düzenli — uzaklaş, peşine düşsün'
const FILL_HINT = 'Peşine düşenin düzeni bozuldu — kümelendikçe hilal dolar'
const READY_HINT = 'Hilal kuruldu — VUR, yaydakiler düşer'
/**
 * Islıklı ok (whistle.ts) ilk hilal vuruşundan sonra öğretilir: yeni fiil
 * tek başına gelsin (TASARIM §8), enerji ipuçlarıyla aynı anda değil.
 */
const WHISTLE_HINT = 'Islıklı ok hazır — yere dokun ya da tıkla: bölük oraya yağdırır, peşindekiler durur'

function teachEnergy(w: World, fx: StepEffects): void {
  if (countAlive(w) === 0) return
  const ready = isStrikeReady(w.energy)
  if (
    w.totalKills === 0 &&
    w.time >= STALL_HINT_AT &&
    w.time < STALL_HINT_UNTIL &&
    w.energy < STALL_ENERGY &&
    fx.hint('stall')
  ) {
    announce(w, STALL_HINT)
  }
  if (!ready && w.energy >= FILL_HINT_ENERGY && fx.hint('fill')) announce(w, FILL_HINT)
  if (ready && w.strikeTimer === 0 && fx.hint('ready')) announce(w, READY_HINT)
}

/** Metehan'ın dalga kuralları; kapatmak yalnız önce/sonra ölçümü için (bkz. waveBots). */
export interface WaveRules {
  /** Kırılan dalganın artığı dağılır. */
  rout: boolean
  /** Yeni dalga oyuncunun yakasından doğar; false: hep aynı yerde. */
  spawnAway: boolean
}

/** Metehan: dört dalga halinde gelen, peşine takılınca kümelenen sürü. */
export function wavesScenario(rules: WaveRules = { rout: true, spawnAway: true }): Scenario {
  return {
    whistle: true,
    assist: () => ladderScale(ladderStep()),
    contactDamage: (w) => COMBAT_CONFIG.damagePerEnemy * w.assist,

    hazards(w, dt, fx) {
      if (!w.baideng) return 0
      const damage = stepVolleys(w.baideng, w.enemies, w.player, w.playerVel, dt, baidengEvents)
      presentBaideng(w, fx)
      return damage * w.assist
    },

    moveEnemies(w, dt) {
      const still = Math.hypot(w.playerVel.x, w.playerVel.z) < STILL_SPEED
      w.stillTime = still ? w.stillTime + dt : 0
      stepEnemies(
        w.enemies,
        w.player,
        dt,
        w.isRetreating,
        waveConfig(w.waveIndex).disciplineRecoveryMult,
        stillPress(w.stillTime),
      )
      if (w.baideng) stepCommand(w.baideng, w.enemies, w.player, dt)
    },

    siege: (w) => calcSiegeState(w.enemies, w.baideng ? siegeCorps(w.baideng) : undefined),

    fallFilter: () => undefined,

    afterStrike(w, fx) {
      if (w.baideng) {
        // Baideng'de gövdenin artığı tek başına kaçmaz: çember kurulur.
        afterBaidengStrike(w.baideng, w.enemies, baidengEvents)
        presentBaideng(w, fx)
        return
      }
      // Kırılan dalganın artığı dağılır: son bir-iki düşmanın peşinde ölmek yok.
      const routed = rules.rout ? routSurvivors(w.enemies, w.waveIndex) : 0
      if (routed === 0) return
      announce(w, routed === 1 ? 'Bozgun! Son düşman kaçıyor' : `Bozgun! Kalan ${routed} düşman kaçıyor`)
      fx.play('rout')
      fx.track({ type: 'rout', count: routed })
      w.events.push({ type: 'rout', count: routed })
    },

    advance(w, dt, fx) {
      if (w.baideng) {
        stepPeace(w.baideng, w.enemies, baidengEvents)
        presentBaideng(w, fx)
      }
      if (stillPress(w.stillTime) > 0 && countAlive(w) > 0 && fx.hint('still')) announce(w, STILL_HINT)
      teachEnergy(w, fx)
      if (w.totalKills > 0 && w.whistle.ready && countAlive(w) > 0 && fx.hint('whistle')) {
        announce(w, WHISTLE_HINT)
      }
      // alive yalnızca vuruşla azaldığı için vuruştan sonra, güncel sayıyla.
      const moreWaves = w.waveIndex < TOTAL_WAVES - 1
      if (countAlive(w) > 0 || !moreWaves) return
      const next = w.waveIndex + 1
      if (w.waveBreak === 0) {
        // Bonus temizlendiği anda; yeni dalga düşenler devrildikten sonra.
        w.score += waveScore(w, waveClearBonus(w.waveIndex))
        w.waveBreak = waveBreak(next)
        fx.track({ type: 'wave_clear', wave: w.waveIndex, health: Math.round(w.playerHealth) })
        if (waveConfig(next).rest) {
          // Molada sahada kimse yok: can molanın başında dönse de sonu aynı.
          w.restedFrom = w.playerHealth
          w.playerHealth = restHealth(w.playerHealth, next)
          announce(w, `Ordu soluklandı: +${Math.round(w.playerHealth - w.restedFrom)} can`)
        }
      } else if (dt > 0) {
        w.waveBreak = Math.max(0, w.waveBreak - dt)
        if (w.waveBreak === 0) {
          w.waveIndex = next
          const cfg = waveConfig(next)
          w.baideng = cfg.baideng ? createBaidengState(cfg.enemyCount) : null
          // Yeni dalga oyuncunun yakasından, arkadan gelir; kıskaç müfrezesi
          // gittiği yönde (bkz. spawnWave).
          w.enemies = spawnWave(next, rules.spawnAway ? w.player : undefined, w.playerVel)
          // Molada beklemek durmak sayılmaz: yeni dalga da önce mesafe korur.
          w.stillTime = 0
          fx.play('wave')
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
      // Yıldızlar oynanan basamağa göre (world.assist). Yıldız puanı yok: can
      // bonusu yarayı zaten sayıyor.
      w.stars = wavesStars(w.playerHealth, w.assist, w.restedFrom ?? undefined)
      // Son dalganın temizleme bonusu dalga geçişinde verilmiyor; burada.
      return waveScore(w, waveClearBonus(w.waveIndex) + Math.round(w.playerHealth * HEALTH_BONUS_PER_POINT))
    },

    points: waveScore,
  }
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
  wingMetLeft: 'Sol kol dönmemiş hatta çarptı — darbe boşa gitti',
  wingMetRight: 'Sağ kol dönmemiş hatta çarptı — darbe boşa gitti',
  guardRallied: 'Merkez döndü — muhafız toparlandı',
  ambushLeft: 'Sol kol pusudan çıktı — peşine düşen bölük kesildi!',
  ambushRight: 'Sağ kol pusudan çıktı — peşine düşen bölük kesildi!',
  commanderCaptured: 'Kanat komutanı esir — kanadı akşam dağınık dönecek',
  corpsBreaks: 'Komutansız kanat dönüşü beceremiyor — şimdi kuşat',
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
const AMBUSH_SLOWMO = 0.6

/** Yem bölüğün ilk tanıtımı: hamleden kaçmayı öğrenmiş oyuncunun ikinci hamlesinde. */
const BAIT_HINT = 'Hamle edeni pusudaki kolun yanına çek — kol peşindekileri keser'
/** Birlik adlarının -in hali (duyurularda). */
const CORPS_OF = ['Sol kanadın', 'Merkezin', 'Sağ kanadın', 'Artçının'] as const

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
  contactDamage: (w) => BATTLE_CONFIG.contactDamage * w.assist,
  hazards: () => 0,

  moveEnemies(w, dt) {
    if (w.battle) stepBattle(w.battle, w.enemies, w.player, dt)
  },

  siege: (w) => (w.battle ? battleSiege(w.battle, w.enemies) : calcSiegeState(w.enemies)),

  fallFilter: (w) => (w.battle ? strikeBudget(w.battle) : undefined),

  afterStrike(w) {
    if (w.battle) afterStrike(w.battle, w.enemies)
  },

  advance(w, _dt, fx) {
    const b = w.battle
    if (!b) return
    // Geçit: kol boğaza yaklaşırken yol hâlâ açıksa, bir kez.
    if (
      b.layout.pass &&
      !b.blockadeUsed &&
      b.frontZ > PASS.neckZ - BLOCKADE_HINT_DISTANCE &&
      fx.hint('blockade')
    ) {
      announce(w, BLOCKADE_HINT)
    }
    // Oyuncu kolları kendi keşfettiyse tanıtım gereksiz.
    if (
      b.time >= WINGS_HINT_AT &&
      b.time < b.layout.dayLength &&
      b.wings.every((x) => x.order === 'ambush') &&
      fx.hint('wings')
    ) {
      announce(w, WINGS_HINT)
    }
    let ambushed: BattleState['ambushes'][number] | null = null
    for (const event of b.events) {
      fx.track({ type: 'battle_event', event })
      switch (event) {
        case 'harass':
          // İpucu oyuncu başına bir kez: ikinci savaşta artık biliyor.
          if (fx.hint('harass')) announce(w, EVENT_TEXT.harass)
          w.arrowCue = { corps: null, wait: ARROW_CUE_WAIT }
          break
        case 'charge':
          fx.play('charge')
          fx.haptic(30)
          // İlk hamle: ağır çekim + ipucu. Oyuncu ne olduğunu görsün, kaçabilsin.
          if (fx.hint('charge')) {
            announce(w, EVENT_TEXT.charge)
            w.slowmo = FIRST_CHARGE_SLOWMO
          } else if (!b.layout.pass && b.wings.some(canSpring) && fx.hint('bait')) {
            // Hamleden kaçmayı öğrenen oyuncuya ikinci adım: kaçışın yönü.
            announce(w, BAIT_HINT)
          }
          break
        case 'ambushLeft':
        case 'ambushRight': {
          const a = b.ambushes.shift()
          if (!a) break
          ambushed = a
          w.totalKills += a.taken
          w.score += a.taken * SCORE_PER_KILL
          fx.track({ type: 'ambush', wing: a.side < 0 ? 0 : 1, corps: a.corps, taken: a.taken, commander: a.commander })
          fx.play('wingCharge')
          fx.haptic([30, 20, 60])
          w.slowmo = AMBUSH_SLOWMO
          announce(w, `Pusu! ${CORPS_OF[a.corps]} ${a.taken} askeri kesildi`)
          break
        }
        case 'commanderCaptured':
          announce(
            w,
            ambushed ? `Komutanı esir — ${CORPS[ambushed.corps].name} akşam dağınık dönecek` : EVENT_TEXT.commanderCaptured,
          )
          break
        case 'sunset':
          fx.track({
            type: 'dusk',
            cohesion: b.corps.map((c) => round2(c.cohesion)),
            wings: b.wings.map((x) => round2(x.strength)),
            health: Math.round(w.playerHealth),
          })
          fx.play('dusk')
          // Dönüş savaşın kilit anı: her seferinde kısa bir ağır çekimle başlar.
          w.slowmo = SUNSET_SLOWMO
          w.events.push({ type: 'sunset' })
          w.cameraCue = 'dusk'
          announce(w, fx.hint('dusk') ? DUSK_HINT : EVENT_TEXT.sunset)
          if (
            b.wings.some((x) => x.order === 'ambush' && x.strength >= WING_CONFIG.readyStrength) &&
            fx.hint('wingsDusk')
          ) {
            announce(w, WINGS_DUSK_HINT)
          }
          break
        case 'wingShockLeft':
        case 'wingShockRight':
          fx.play('wingCharge')
          fx.haptic(40)
          announce(w, eventText(b, event))
          break
        case 'emperorExposed':
          fx.play('horn')
          announce(w, eventText(b, event))
          w.arrowCue = { corps: CENTER, wait: ARROW_CUE_WAIT }
          break
        case 'blockade':
          fx.play('rockslide')
          fx.haptic([30, 20, 60])
          announce(w, EVENT_TEXT.blockade)
          break
        case 'jam':
          // Sıkışma geçidin hasat anı (Malazgirt'teki dönüş gibi): ağır çekimle okunsun.
          fx.play('dusk')
          w.slowmo = JAM_SLOWMO
          fx.hint('jam')
          announce(w, EVENT_TEXT.jam)
          break
        default:
          announce(w, eventText(b, event))
      }
    }
    b.events.length = 0
    b.ambushes.length = 0
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

  points: (_, base) => base,
}

const SCENARIOS: Record<CommanderId, Scenario> = {
  metehan: wavesScenario(),
  'alp-arslan': battle,
  kilicarslan: battle,
}

export function scenarioOf(w: World): Scenario {
  return SCENARIOS[w.commander]
}
