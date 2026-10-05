// Savaş karnesi: savaşın özetinden oyuncuya tek ekranlık ders.
//
// Kapı B'nin sorusu "oyuncu gönüllü olarak bir kez daha oynuyor mu". Sonuç
// ekranı o kararın verildiği yer; karne dört ilkeye dayanıyor:
//  1. Kontrol edilebilir neden (Weiner'in atıf kuramı): yenilgi "yetmedin"
//     diye değil "şunu yaptın / yapmadın" diye anlatılırsa oyuncu yeniden
//     dener. Tavsiye tek ve somut — birden çok öneri seçim yükü getirir.
//  2. Yakın kaçış: "gün batımına 6 sn kala" yenilgiyi "az kaldı"ya çevirir;
//     tekrar oynama isteğinin en güçlü tetikleyicilerinden.
//  3. Hedef gradyanı: bir sonraki hedefin ilerleme çubuğu ("21'de 17").
//     Hedefe yaklaştığını gören oyuncunun çabası artar.
//  4. Zirve-son kuralı: deneyim en iyi anıyla ve sonuyla hatırlanır; karne
//     savaşın en iyi anını sonda yeniden gösterir.
//
// Tavsiyelerin her biri bot ölçümüyle doğrulanmış bir nedenselliğe dayanıyor
// (bkz. debrief.bots.test.ts ve corps/wings testleri): hangi bot türü hangi
// tavsiyeyi alıyor, tavsiyeye uyan bot daha iyi oynuyor mu.
//
// Saf: özet (telemetry/summary.ts) + sabitler girer, metin çıkar.

import {
  armySize,
  BATTLE_CONFIG,
  BATTLE_SIZE,
  CENTER,
  COLUMN_CONFIG,
  MALAZGIRT,
  MIRYOKEFALON,
  nightTarget,
  REARGUARD,
} from '../mechanics/corps'
import { PASS } from '../mechanics/pass'
import { TOTAL_WAVES, WAVES, waveConfig, wavesStarHealth } from '../mechanics/waves'
import type { WingOrder } from '../mechanics/wings'
import type { BattleSummary } from '../telemetry/summary'

export type AdviceId =
  // Metehan
  | 'waitReady'
  | 'closeRange'
  | 'tighten'
  | 'kite'
  | 'dodgeVolley'
  | 'sweep'
  | 'clean'
  | 'flawless'
  // Malazgirt
  | 'harass'
  | 'wingHarass'
  | 'saveHilal'
  | 'evade'
  | 'useWings'
  | 'bait'
  | 'saveWings'
  | 'duskStrike'
  | 'breakRear'
  | 'closeWings'
  | 'breakCenter'
  | 'aimEmperor'
  | 'mastery'
  // Miryokefalon
  | 'blockNeck'
  | 'holdBlock'
  | 'harvestJam'
  | 'jamCenter'

export type MarkKind = 'strike' | 'charge' | 'wave' | 'rout' | 'emperor' | 'shock' | 'block' | 'ambush'

export interface TimelineMark {
  /** 0–1: savaşın süresi içindeki yeri. */
  at: number
  kind: MarkKind
  /** Vuruşta düşen sayısı. */
  size?: number
}

export interface Debrief {
  /** Sonucun tek cümlelik anlatımı (sayılarla). */
  headline: string
  /** Yakın kaçış: başlık "az kaldı" tonunda gösterilir. */
  close: boolean
  /** Savaşın en iyi anı; hiç vuruş yoksa null. */
  peak: string | null
  advice: { id: AdviceId; text: string }
  /** Bir sonraki hedef ve ona ne kadar yaklaşıldığı; yoksa null. */
  goal: { label: string; value: number; target: number; unit: string } | null
  timeline: {
    /** Gün batımının yeri (0–1); dalgalı savaşta null. */
    dusk: number | null
    marks: TimelineMark[]
  }
}

export interface DebriefContext {
  /** Bu savaştan sonraki rekor. */
  best: number
}

/** Yakın kaçış sayılan kalan süre (sn). */
const CLOSE_SECONDS = 20
/** Metehan: dalganın bu payı ya da azı kaldıysa yenilgi "az kaldı". */
const CLOSE_WAVE_SHARE = 0.3
/** 2. yıldıza bu kadar ya da az asker eksikse "az kaldı". */
const CLOSE_STAR_GAP = 3
/** Gündüz bu kadar ya da çok vuruş: hilal akşama saklanmamış. */
const DAY_STRIKES_WASTEFUL = 2
/** Akşam en büyük vuruş bundan küçükse akşam hasadı kaçırılmış. */
const DUSK_STRIKE_GOOD = 6
/** Metehan: vuruş başına bundan az düşen: küme dağınıkken vurulmuş. */
const LOOSE_STRIKE = 4
/** Baideng: bu kadar yaylım yiyen halkadan kaçmayı öğrenmemiş. */
const DODGE_VOLLEY_HITS = 2
/** Kollar gün batımında bundan güçsüzse gündüz tüketilmiş (bkz. wings.test.ts). */
const WINGS_TIRED = 0.5
/** Akşam düşen oyuncu gün batımına bu candan azıyla girdiyse yaralar gündüzden. */
const DAY_WOUNDED = 50

export function debrief(s: BattleSummary, ctx: DebriefContext): Debrief {
  if (s.commander === 'alp-arslan') return battleDebrief(s)
  if (s.commander === 'kilicarslan') return passDebrief(s)
  return waveDebrief(s, ctx)
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)
const pct = (v: number) => Math.round(v * 100)

function bestStrike(s: BattleSummary): BattleSummary['strikes'][number] | null {
  let best: BattleSummary['strikes'][number] | null = null
  for (const x of s.strikes) if (!best || x.kills > best.kills) best = x
  return best && best.kills > 0 ? best : null
}

function at(s: BattleSummary, t: number): number {
  return s.duration > 0 ? Math.min(1, Math.max(0, t / s.duration)) : 0
}

// ——— Metehan: dört dalga ———

/** Savaşın başladığı dalgadan sona dek düşman sayısı (Baideng'den başlayınca yalnız o). */
function waveTotal(from: number): number {
  return sum(WAVES.slice(from).map((w) => w.enemyCount))
}

function waveDebrief(s: BattleSummary, ctx: DebriefContext): Debrief {
  // Baideng'de kendi yaylımının altında düşen Han atlısı da oyuncunun hanesine.
  const kills = sum(s.strikes.map((x) => x.kills)) + sum(s.volleys.map((x) => x.felled))
  const routed = sum(s.routs.map((x) => x.count))
  const peakStrike = bestStrike(s)
  const peak = peakStrike
    ? `En büyük hilalin: tek vuruşta ${peakStrike.kills} düşman (${waveAt(s, peakStrike.t) + 1}. dalga)`
    : null

  const marks: TimelineMark[] = [
    ...s.strikes.map((x) => ({ at: at(s, x.t), kind: 'strike' as const, size: x.kills })),
    ...s.waves.map((x) => ({ at: at(s, x.t), kind: 'wave' as const })),
    ...s.routs.map((x) => ({ at: at(s, x.t), kind: 'rout' as const })),
  ]
  const timeline = { dusk: null, marks }

  if (s.outcome === 'victory') {
    const won = s.startWave > 0 ? 'Baideng kuşatıldı' : `${TOTAL_WAVES} dalganın hepsi kuşatıldı`
    return {
      headline: s.health <= 15 ? `${won} — kıl payı, canın %${s.health}.` : `${won}.`,
      close: s.health <= 15,
      peak,
      advice: victoryAdvice(s, routed),
      goal: waveVictoryGoal(s, ctx),
      timeline,
    }
  }

  const waveSize = WAVES[Math.min(s.wave, WAVES.length - 1)].enemyCount
  return {
    headline: `${s.wave + 1}. dalgada düştün — ${s.remaining} düşman kalmıştı.`,
    close: s.remaining <= Math.ceil(waveSize * CLOSE_WAVE_SHARE),
    peak,
    advice: waveAdvice(s),
    goal: { label: 'Zafere', value: kills + routed, target: waveTotal(s.startWave), unit: 'düşman' },
    timeline,
  }
}

/**
 * Üç yıldız yoksa hedef bir sonraki yıldız: bu savaşın basamağında kalması
 * gereken can (merdiven gizli; oyuncu yalnızca can çubuğunu görüyor). Üç
 * yıldızdan sonra, ya da yıldız bu savaşta artık alınamıyorsa, rekor.
 */
function waveVictoryGoal(s: BattleSummary, ctx: DebriefContext): Debrief['goal'] {
  const next = s.stars < 2 ? 2 : 3
  const target = wavesStarHealth(next, s.assist, preRest(s))
  // Sonsuz hedef: molaya tam hasarda ölü varılırdı, yıldız artık can çubuğunda değil.
  if (s.stars < 3 && Number.isFinite(target)) {
    return { label: `${next}. yıldız: az yara`, value: s.health, target, unit: 'can' }
  }
  return s.score < ctx.best ? { label: 'Rekor', value: s.score, target: ctx.best, unit: 'puan' } : null
}

/** Baideng öncesi molaya girerkenki can; molaya varılmadıysa undefined. */
function preRest(s: BattleSummary): number | undefined {
  return s.waves.find((w) => waveConfig(w.wave + 1).rest)?.health
}

/**
 * Metehan zaferinde ustalığın iki yolu: bozgunsuz kuşatma (kaçan düşman puan
 * getirmez) ve temiz ricat (can başına 5 puan). Önce bozgun: oyuncunun
 * vuruşlarına bağlı, daha somut.
 */
function victoryAdvice(s: BattleSummary, routed: number): Debrief['advice'] {
  if (routed > 0) {
    return {
      id: 'sweep',
      text: `${routed} düşman bozgunla kaçtı; kaçan puan getirmez. Dalganın son vuruşunda kümenin tamamını yaya al.`,
    }
  }
  if (s.health < 100) {
    return {
      id: 'clean',
      text: `Canın %${s.health} kaldı. Her can puanı 5 skor: daha az temas, daha yüksek rekor.`,
    }
  }
  return { id: 'flawless', text: 'Kusursuz zafer: kaçan yok, yara yok. Bu savaşın en yüksek skoru.' }
}

/** Vuruşun hangi dalgada yapıldığı: temizlenme anlarına göre. */
function waveAt(s: BattleSummary, t: number): number {
  return s.startWave + s.waves.filter((w) => w.t < t).length
}

/**
 * Metehan yenilgisinde en çok işe yarayacak tek tavsiye. Sıra, hatanın ne
 * kadar net okunduğuna göre: ret sayıları oyuncunun kendi basışları ve
 * Baideng'de yediği yaylımlar (kesin), vuruş başına düşen dolaylı, "hep kaç"
 * varsayılan.
 */
function waveAdvice(s: BattleSummary): Debrief['advice'] {
  // Erken basmanın kendisi zarar vermez; ama mekaniğin anlaşılmadığını
  // gösterir (vuruş saldırı düğmesi sanılıyor). Tavsiye hilalin nasıl
  // dolduğunu anlatır.
  if (s.refusals.notReady >= 3) {
    return {
      id: 'waitReady',
      text: `Hilal dolmadan ${s.refusals.notReady} kez bastın. Hilal sen kaçarken dolar: peşine düşenin düzeni bozulur. Çubuk parlayınca vur.`,
    }
  }
  if (s.refusals.noTargets >= 2) {
    return {
      id: 'closeRange',
      text: 'Yayın menzili 13 adım. Kaçarken kümeyi çok geride bırakma; peşindeyken vur.',
    }
  }
  const volleyHits = s.volleys.filter((x) => x.hit).length
  if (volleyHits >= DODGE_VOLLEY_HITS) {
    return {
      id: 'dodgeVolley',
      text: `Han yaylımı seni ${volleyHits} kez vurdu. Kırmızı halka belirince yön değiştir: ok, gittiğin yere düşer. Atlıları halkaya çekersen kendi okları onları düşürür.`,
    }
  }
  const strikes = s.strikes.filter((x) => x.kills > 0)
  if (strikes.length >= 2 && sum(strikes.map((x) => x.kills)) / strikes.length < LOOSE_STRIKE) {
    return {
      id: 'tighten',
      text: 'Vuruşların küçük kaldı. Küme dağınıkken vurma: bir tur daha peşinde sürükle, sıkışsınlar.',
    }
  }
  return {
    id: 'kite',
    text: 'Kümenin üstüne yürüme. Hep kaç: düzenleri kaçarken bozulur, hilal kaçarken dolar.',
  }
}

// ——— Alp Arslan: Malazgirt ———

function battleDebrief(s: BattleSummary): Debrief {
  const cfg = BATTLE_CONFIG
  const sunset = s.events.find((e) => e.event === 'sunset')?.t ?? null
  const isDusk = (t: number) => sunset !== null && t >= sunset
  // Pusuda kesilenler de düşen sayılır (yıldız ölçüsüyle aynı: corps.ts countFallen).
  const fallen = sum(s.strikes.map((x) => x.kills)) + sum(s.ambushes.map((x) => x.taken))
  const peakStrike = bestStrike(s)

  const marks: TimelineMark[] = [
    ...s.strikes.map((x) => ({ at: at(s, x.t), kind: 'strike' as const, size: x.kills })),
    ...s.ambushes.map((x) => ({ at: at(s, x.t), kind: 'ambush' as const })),
    ...s.events.flatMap((e): TimelineMark[] => {
      if (e.event === 'charge') return [{ at: at(s, e.t), kind: 'charge' }]
      if (e.event === 'emperorCaptured') return [{ at: at(s, e.t), kind: 'emperor' }]
      if (e.event === 'wingShockLeft' || e.event === 'wingShockRight') {
        return [{ at: at(s, e.t), kind: 'shock' }]
      }
      return []
    }),
  ]
  const timeline = { dusk: sunset === null ? null : at(s, sunset), marks }

  let peak: string | null = null
  if (s.events.some((e) => e.event === 'emperorCaptured')) {
    peak = 'Romanos Diogenes esir alındı: savaşı tek hilal bitirdi.'
  } else if (peakStrike) {
    peak = `En büyük hilalin: tek vuruşta ${peakStrike.kills} asker (${isDusk(peakStrike.t) ? 'akşam' : 'gündüz'})`
  }

  if (s.outcome !== 'victory') {
    const day = s.simTime < cfg.dayLength
    const left = Math.max(0, Math.ceil((day ? cfg.dayLength : cfg.nightAt) - s.simTime))
    const goal = {
      label: day ? 'Gün batımına dayan' : 'Geceye dayan',
      value: Math.round(s.simTime),
      target: day ? cfg.dayLength : cfg.nightAt,
      unit: 'sn',
    }
    if (s.cause === 'night') {
      const need = nightTarget(MALAZGIRT, BATTLE_SIZE)
      return {
        headline: `Gece çöktü, Bizans ordusu ayakta: ${fallen} asker düştü, ${need} gerekiyordu.`,
        close: need - fallen <= CLOSE_STAR_GAP,
        peak,
        advice: s.events.some((e) => e.event === 'harass')
          ? harvestAdvice(s, sunset)
          : {
              id: 'harass',
              text: 'Kenarda beklemek zafer getirmez. Birliklerin ok menziline gir: düzenleri erir, akşam hilal onları biçer.',
            },
        goal: { label: 'Zafer: ordunun dörtte biri', value: fallen, target: need, unit: 'asker' },
        timeline,
      }
    }
    if (s.cause === 'camp') {
      return {
        headline: `Bizans ordusu ordugaha vardı — gün batımına ${left} sn kala.`,
        close: left <= CLOSE_SECONDS,
        peak,
        advice: campAdvice(s, sunset),
        goal,
        timeline,
      }
    }
    // Akşam düşen ama gün batımına yaralı giren oyuncunun asıl hatası gündüzde.
    const duskHealth = s.dusk?.health ?? 100
    const dayWounds = day || duskHealth <= DAY_WOUNDED
    return {
      headline: day
        ? `Ağır süvari seni çiğnedi — gün batımına ${left} sn vardı.`
        : `Safların arasında düştün — gece çökmesine ${left} sn vardı.`,
      close: left <= CLOSE_SECONDS,
      peak,
      advice: {
        id: 'evade',
        text: day
          ? 'Kırmızı kama hamle demek. Görünce menzilden çık; hamle 2,5 sn sürer, sonra geri dön.'
          : dayWounds
            ? `Gün batımına canın %${duskHealth} ile girdin: yaraları gündüz hamlelerde aldın. Kırmızı kamayı görünce menzilden çık.`
            : 'Akşam ordu hamle etmez ama temas yine can yakar. Yay 13 adım: safların içine girme.',
      },
      goal,
      timeline,
    }
  }

  const need = Math.ceil(BATTLE_SIZE / 2)
  const captured = s.stars >= 3
  const exposed = s.events.some((e) => e.event === 'emperorExposed')
  const rearLeft = s.events.some((e) => e.event === 'rearguardLeaves')

  if (captured) {
    return {
      headline: 'İmparator Romanos Diogenes esir alındı; ordu teslim oldu.',
      close: false,
      peak,
      advice: {
        id: 'mastery',
        text:
          s.health >= 100
            ? 'Üç yıldız, tek yara almadan. Rekor için imparatoru daha erken esir al.'
            : `Üç yıldız. Rekor için: daha az yara (canın %${s.health}), daha çok esir.`,
      },
      goal: null,
      timeline,
    }
  }

  if (s.stars >= 2) {
    const steps = (rearLeft || exposed ? 1 : 0) + (exposed ? 1 : 0)
    return {
      headline: `Gece çöktü. Bizans ordusunun ${fallen} askeri düştü.`,
      close: exposed,
      peak,
      advice: emperorAdvice(s, exposed, rearLeft),
      goal: { label: '3. yıldız: imparator', value: steps, target: 3, unit: 'adım' },
      timeline,
    }
  }

  return {
    headline: `Gece çöktü; ordugah korundu. ${fallen} asker düştü.`,
    close: need - fallen <= CLOSE_STAR_GAP,
    peak,
    advice: harvestAdvice(s, sunset),
    goal: { label: '2. yıldız: ordunun yarısı', value: fallen, target: need, unit: 'asker' },
    timeline,
  }
}

function campAdvice(s: BattleSummary, sunset: number | null): Debrief['advice'] {
  if (!s.events.some((e) => e.event === 'harass')) {
    return {
      id: 'harass',
      text: 'Birliklerin ok menziline gir. Taciz edilen birlik yavaşlar; kimse durdurmazsa ordu ordugaha yürür.',
    }
  }
  const dayStrikes = s.strikes.filter((x) => sunset === null || x.t < sunset)
  if (dayStrikes.length >= DAY_STRIKES_WASTEFUL) {
    return {
      id: 'saveHilal',
      text: `Gündüz ${dayStrikes.length} kez vurdun. Gündüz vuruşu tüm orduyu toparlar ve hızlandırır: hilali akşama sakla.`,
    }
  }
  if (s.orders.length === 0) {
    return {
      id: 'wingHarass',
      text: 'Kolları hiç kullanmadın. TACİZ emriyle karşılarındaki kanadı yavaşlatırlar.',
    }
  }
  return {
    id: 'harass',
    text: 'Ön birlikleri sırayla taciz et; en hızlı ilerleyeni (düzeni en sağlam olanı) önce.',
  }
}

/** 1 yıldız: ordu korundu ama akşam hasadı eksik kaldı. */
function harvestAdvice(s: BattleSummary, sunset: number | null): Debrief['advice'] {
  const dayStrikes = s.strikes.filter((x) => sunset === null || x.t < sunset)
  const duskBest = Math.max(0, ...s.strikes.filter((x) => sunset !== null && x.t >= sunset).map((x) => x.kills))
  if (dayStrikes.length >= DAY_STRIKES_WASTEFUL && duskBest < DUSK_STRIKE_GOOD) {
    return {
      id: 'saveHilal',
      text: `Gündüz ${dayStrikes.length} kez vurdun, akşam en çok ${duskBest} düştü. Gündüz vuruşu orduyu toparlar: hilali akşama sakla.`,
    }
  }
  // Önce kolların gücü: gündüz tüketilen kol akşam da hücum edebilir, ama
  // zayıf darbesi dönen orduyu sarsmaz — darbe var diye iş bitmiş sayılmaz.
  const duskWings = s.dusk?.wings ?? []
  if (s.orders.length > 0 && duskWings.length > 0 && Math.max(...duskWings) < WINGS_TIRED) {
    return {
      id: 'saveWings',
      text: `Kollar gün batımında yorgundu (güç %${pct(Math.max(...duskWings))}). Gündüz pusuda dinlensinler; akşam HÜCUM.`,
    }
  }
  const shocks = s.events.some((e) => e.event === 'wingShockLeft' || e.event === 'wingShockRight')
  if (!shocks) {
    return {
      id: 'useWings',
      text: 'Kolları pusuda sakla, gün batımında HÜCUM ver: dönen orduya arkadan vurur, düzeni bir anda çöker.',
    }
  }
  if (s.ambushes.length === 0) {
    return {
      id: 'bait',
      text: 'Gündüz hamle edeni pusudaki kolun yanına çek: kol çıkar, peşindekileri keser. Kanadın komutanı esir düşerse kanat akşam dağılır.',
    }
  }
  return {
    id: 'duskStrike',
    text: 'Akşam dönen birliği dönüşün ortasında kuşat: disiplini sıfıra iner, yaydaki herkes düşer.',
  }
}

/** 2 yıldız: imparatora giden yolun hangi adımında kalındı. */
function emperorAdvice(s: BattleSummary, exposed: boolean, rearLeft: boolean): Debrief['advice'] {
  const cfg = BATTLE_CONFIG
  if (exposed) {
    return {
      id: 'aimEmperor',
      text: 'İmparator korumasızdı. Merkezin arkasına dolan; yayı ona çevir — tek vuruş savaşı bitirir.',
    }
  }
  const cohesion = s.dusk?.cohesion ?? []
  if (!rearLeft) {
    const rear = cohesion[REARGUARD]
    return {
      id: 'breakRear',
      text:
        rear !== undefined
          ? `Artçının düzeni gün batımında %${pct(rear)} kaldı. %${pct(cfg.rearguardThreshold)}'in altına inerse akşam kaçar, imparatorun arkası açılır.`
          : `Artçıyı gündüz yıprat: düzeni %${pct(cfg.rearguardThreshold)}'in altına inerse akşam kaçar, imparatorun arkası açılır.`,
    }
  }
  // Artçı kaçtı: imparatoru kolların gün batımında merkeze kapanması açar.
  const wings = s.dusk?.wings ?? []
  if (wings.length > 0 && wings.reduce((a, x) => a + x, 0) < cfg.emperorPin) {
    return {
      id: 'saveWings',
      text: `Artçı kaçtı ama kollar gün batımında yorgundu (güç %${pct(Math.max(...wings))}): merkeze kapanacak güç kalmadı. En az bir kolu pusuda sakla.`,
    }
  }
  if (!chargedAtDusk(s)) {
    const late = lateDuskCharge(s)
    return {
      id: 'closeWings',
      text:
        late !== null
          ? `Kollara HÜCUM'u sancak döndükten ${late} sn sonra verdin; merkez çarkını bitirdi, muhafız toparlandı. Sancak döner dönmez sal: kolların merkeze varması ~2 sn sürer.`
          : 'Artçı kaçtı, merkezin arkası açıldı. Sancak dönünce kollara HÜCUM ver: merkez çark ederken kapanırlarsa imparator korumasız kalır.',
    }
  }
  const center = cohesion[CENTER]
  return {
    id: 'breakCenter',
    text:
      center !== undefined
        ? `Kollar merkeze kapandı ama merkez dağılmadı (gün batımında %${pct(center)}). Gündüz merkezi de yıprat: düzeni %${pct(cfg.emperorThreshold)}'in altındayken imparator korumasız kalır.`
        : `Kollar merkeze kapandı ama merkez dağılmadı. Gündüz merkezi de yıprat: düzeni %${pct(cfg.emperorThreshold)}'in altındayken imparator korumasız kalır.`,
  }
}

/**
 * Sancak penceresi kapanmadan bir kol hücumdaydı mı. Pencere merkezin
 * dönüşü kadar: bitişi 'guardRallied' olayı (bkz. corps.ts emperorOpen).
 */
function chargedAtDusk(s: BattleSummary): boolean {
  if (!s.events.some((e) => e.event === 'sunset')) return false
  const closed = s.events.find((e) => e.event === 'guardRallied')?.t ?? Infinity
  const last: WingOrder[] = ['ambush', 'ambush']
  for (const o of s.orders) if (o.t < closed) last[o.wing] = o.order
  return last.includes('charge')
}

/** Pencere kapandıktan sonra verilen ilk HÜCUM emri, gün batımından kaç sn sonra (yoksa null). */
function lateDuskCharge(s: BattleSummary): number | null {
  const sunset = s.events.find((e) => e.event === 'sunset')?.t
  const closed = s.events.find((e) => e.event === 'guardRallied')?.t
  if (sunset === undefined || closed === undefined) return null
  const late = s.orders.find((o) => o.order === 'charge' && o.t >= closed)
  return late ? Math.round(late.t - sunset) : null
}

// ——— II. Kılıçarslan: Miryokefalon ———

/**
 * Yığının iyi yeri: boğazın biraz gerisinden biraz ötesine. Bot taraması
 * (column.test.ts): genişte kesen 1, bu aralıkta kesen 3, çıkışa yakın kesen
 * ≤ 2 yıldız alıyor.
 */
const BLOCK_WINDOW = { before: 2, after: 4 }

type Placement = 'none' | 'wide' | 'late' | 'good'

function placement(s: BattleSummary): Placement {
  if (!s.blockade) return 'none'
  if (s.blockade.z < PASS.neckZ - BLOCK_WINDOW.before) return 'wide'
  if (s.blockade.z > PASS.neckZ + BLOCK_WINDOW.after) return 'late'
  return 'good'
}

/** "Nerede" dersi: yığının yeri iyi değilse söylenecek tek cümle. */
function placementAdvice(p: Placement): Debrief['advice'] | null {
  switch (p) {
    case 'none':
      return {
        id: 'blockNeck',
        text: "YOLU KES'i hiç kullanmadın. Boğazın hemen ötesinde kes: kolun başı durur, arkası darda üst üste biner.",
      }
    case 'wide':
      return {
        id: 'blockNeck',
        text: 'Yolu geniş vadide kestin; kol yayıldı, sıkışmadı. Boğazın hemen ötesinde kes.',
      }
    case 'late':
      return {
        id: 'blockNeck',
        text: 'Yolu çıkışa yakın kestin; merkez boğaza gelmeden durdu. Boğazın hemen ötesinde kes.',
      }
    case 'good':
      return null
  }
}

function passDebrief(s: BattleSummary): Debrief {
  const has = (e: string) => s.events.some((x) => x.event === e)
  const fallen = sum(s.strikes.map((x) => x.kills))
  const peakStrike = bestStrike(s)
  const where = placement(s)
  const cleared = has('blockadeCleared')

  const marks: TimelineMark[] = [
    ...s.strikes.map((x) => ({ at: at(s, x.t), kind: 'strike' as const, size: x.kills })),
    ...(s.blockade ? [{ at: at(s, s.blockade.t), kind: 'block' as const }] : []),
    ...s.events.flatMap((e): TimelineMark[] => {
      if (e.event === 'charge') return [{ at: at(s, e.t), kind: 'charge' }]
      if (e.event === 'emperorCaptured') return [{ at: at(s, e.t), kind: 'emperor' }]
      if (e.event === 'wingShockLeft' || e.event === 'wingShockRight') {
        return [{ at: at(s, e.t), kind: 'shock' }]
      }
      return []
    }),
  ]
  const timeline = { dusk: null, marks }

  const captured = s.stars >= 3
  let peak: string | null = null
  if (captured) peak = 'Manuel barış istedi: savaşı tek hilal bitirdi.'
  else if (peakStrike) peak = `En büyük hilalin: tek vuruşta ${peakStrike.kills} asker`

  const nightAt = COLUMN_CONFIG.nightAt
  if (s.outcome !== 'victory') {
    const left = Math.max(0, Math.ceil(nightAt - s.simTime))
    const goal = { label: 'Geceye dayan', value: Math.round(s.simTime), target: nightAt, unit: 'sn' }
    if (s.cause === 'camp') {
      return {
        headline: `Bizans ordusu geçidi aştı — geceye ${left} sn kala.`,
        close: left <= CLOSE_SECONDS,
        peak,
        advice: cleared
          ? {
              id: 'holdBlock',
              text: 'Öncü kaya yığınını temizledi. Yığının önündeki öncüyü taciz et: ok altında üç kat yavaş temizler.',
            }
          : (placementAdvice(where) ?? {
              id: 'harass',
              text: 'Kolun başını taciz et: ok altındaki öncü yavaşlar, arkası da onunla yavaşlar.',
            }),
        goal,
        timeline,
      }
    }
    return {
      headline: `Dar geçitte düştün — geceye ${left} sn vardı.`,
      close: left <= CLOSE_SECONDS,
      peak,
      advice: {
        id: 'evade',
        text: 'Dar geçitte yana kaçacak yer yok. Kırmızı kamayı görünce hemen kuzeye çekil; hamle 2,5 sn sürer.',
      },
      goal,
      timeline,
    }
  }

  if (captured) {
    return {
      headline: 'Manuel Komnenos barış istedi; ordu geçitten geri döndü.',
      close: false,
      peak,
      advice: {
        id: 'mastery',
        text:
          s.health >= 100
            ? 'Üç yıldız, tek yara almadan. Rekor için Manuel\'i daha erken sıkıştır.'
            : `Üç yıldız. Rekor için: daha az yara (canın %${s.health}), daha erken barış.`,
      },
      goal: null,
      timeline,
    }
  }

  const exposed = has('emperorExposed')
  if (s.stars >= 2) {
    const steps = (s.blockade ? 1 : 0) + (has('jam') ? 1 : 0) + (exposed ? 1 : 0)
    return {
      headline: `Gece çöktü; kol geçitte kaldı. ${fallen} asker düştü.`,
      close: exposed,
      peak,
      advice: exposed
        ? {
            id: 'aimEmperor',
            text: "Manuel açıktaydı. Merkezin kuzeyinden yaklaş, yayı ona çevir — tek vuruş savaşı bitirir.",
          }
        : (placementAdvice(where) ?? {
            id: 'jamCenter',
            text: 'Manuel merkezde. Merkez boğaza yığılınca muhafızları dağılır: yolu kesip öncüyü orada tut.',
          }),
      goal: { label: '3. yıldız: Manuel', value: steps, target: 3, unit: 'adım' },
      timeline,
    }
  }

  const need = Math.ceil(armySize(MIRYOKEFALON) / 2)
  return {
    headline: `Gece çöktü; kol geçitte kaldı. ${fallen} asker düştü.`,
    close: need - fallen <= CLOSE_STAR_GAP,
    peak,
    advice:
      placementAdvice(where) ??
      (cleared || !has('jam')
        ? {
            id: 'holdBlock',
            text: 'Kol sıkışmadan yol açıldı. Yığının önündeki öncüyü taciz et: temizlemesi yavaşlar, arkası sıkışır.',
          }
        : {
            id: 'harvestJam',
            text: 'Kol sıkıştı ama az vurdun. Sıkışan birliğin disiplini sıfırlanır: yayı ona kapat.',
          }),
    goal: { label: '2. yıldız: ordunun yarısı', value: fallen, target: need, unit: 'asker' },
    timeline,
  }
}
