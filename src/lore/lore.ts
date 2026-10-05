// Tarih notları: oyuncunun az önce yaptığı hamlenin tarihteki karşılığı.
//
// Oyun tarihi anlatmak için değil, oynatmak için var; bilgi ancak doğru anda
// verilirse akılda kalır. Kurallar:
//  1. Önce eylem, sonra bilgi. Kart, oyuncunun o savaşta yaşadığı bir anın
//     (ilk hilal, bozgun, gün batımı, YOLU KES…) tarihsel karşılığını anlatır.
//     Yaşanmış an hafızada kanca olur; kart ona tutunur.
//  2. Akış bölünmez: savaş sürerken kart yok. Kart sonuç ekranında, oyuncu
//     zaten durmuşken gelir.
//  3. Savaş başına en fazla bir kart. Sonuç ekranında karne de var; iki
//     yeni bilgi birbirini siler.
//  4. En nadir olan önce (zirve-son kuralı): imparatoru esir alan oyuncu o
//     anın kartını görür, tacizinkini değil. Kalanlar sonraki savaşlarda gelir;
//     her savaş yeni bir kart vaat eder.
//  5. Kazanılmamış kartın başlığı ve ne yapınca açılacağı görünür, metni
//     görünmez. Yarım kalan koleksiyon tamamlanmak ister.
//
// Metinler tek soluk (≤ 220 harf), her birinin dayandığı kaynak yanında.
// Saf: savaşın özeti (telemetry/summary.ts) girer, kart çıkar.

import type { CommanderId } from '../mechanics/scenario'
import type { BattleSummary } from '../telemetry/summary'

export type LoreId =
  // Metehan — Hun
  | 'sahte-ricat'
  | 'onluk'
  | 'bozgun'
  | 'yay'
  | 'baideng'
  // Alp Arslan — Malazgirt 1071
  | 'taciz'
  | 'kataphrakt'
  | 'kanat'
  | 'aksam'
  | 'yem'
  | 'esir'
  // II. Kılıçarslan — Miryokefalon 1176
  | 'gecit'
  | 'sikisma'
  | 'baris'
  | 'muhur'

export interface LoreCard {
  id: LoreId
  commander: CommanderId
  /** Kilitliyken de görünür: merak uyandırsın. */
  title: string
  /** Hap bilgi — tek soluk. */
  text: string
  /** Metnin dayandığı kaynak. */
  source: string
  /** Kilitliyken gösterilir: kartı ne açar. */
  hint: string
  /** Bu savaşta kazanıldı mı. */
  earn: (s: BattleSummary) => boolean
}

const MAX_TEXT = 220
const MAX_TITLE = 40

const struck = (s: BattleSummary, kills: number) => s.strikes.some((x) => x.kills >= kills)
const saw = (s: BattleSummary, event: BattleSummary['events'][number]['event']) =>
  s.events.some((e) => e.event === event)
const won = (s: BattleSummary) => s.outcome === 'victory'

/**
 * Komutan başına anlatı sırasıyla; aynı savaşta birden çok kart kazanılırsa
 * listede sonra gelen (daha nadir olan) seçilir.
 */
export const LORE: readonly LoreCard[] = [
  {
    id: 'sahte-ricat',
    commander: 'metehan',
    title: 'Kaçış bir tuzaktı',
    text: 'Hun süvarisi geri çekilir gibi yapıp düşmanı peşine takardı. Kovalayan ordunun safları açılınca döner, dağılmış düşmanı kuşatırdı. Çin kaynakları bu tuzağa defalarca düştüklerini yazar.',
    source: 'Sima Qian, Shiji, bölüm 110',
    hint: 'Hilalle bir vuruş yap',
    earn: (s) => struck(s, 3),
  },
  {
    id: 'onluk',
    commander: 'metehan',
    title: 'Ordu onluk sayılırdı',
    text: "Shiji, Mete'nin ordusunu her biri on bin atlıya komuta eden yirmi dört beye böldüğünü yazar. On, yüz, bin, on bin: bu onluk düzen sonraki Türk ve Moğol ordularında da sürdü.",
    source: 'Sima Qian, Shiji, bölüm 110',
    hint: 'Bir dalgayı temizle',
    earn: (s) => s.waves.length > 0,
  },
  {
    id: 'bozgun',
    commander: 'metehan',
    title: 'Ordular panikle dağılır',
    text: 'Askerî tarihçi Ardant du Picq\'e göre eski savaşlarda kayıpların çoğu çarpışmada değil, saflar bozulup kaçış başlayınca verilirdi. Kuşatmanın asıl hedefi düşmanın düzeniydi.',
    source: 'Ardant du Picq, Muharebe Üzerine İncelemeler (1880)',
    hint: 'Bir dalgayı bozguna uğrat',
    earn: (s) => s.routs.length > 0,
  },
  {
    id: 'yay',
    commander: 'metehan',
    title: 'Bir yay aylarca yapılırdı',
    text: 'Bozkır yayı ahşap, boynuz ve sinirin tutkalla birleşmesiydi. Kısa boyuna karşın at üstünden uzağa atardı. Katmanların kuruyup yayın kullanılır hale gelmesi aylar sürerdi.',
    source: 'Bozkır silahları üzerine genel literatür',
    hint: 'Tek vuruşta 20 düşman düşür',
    earn: (s) => struck(s, 20),
  },
  {
    id: 'baideng',
    commander: 'metehan',
    title: 'Yedi gün kuşatılan imparator',
    text: "MÖ 200'de Mete, zayıf görünen öncülerle Han imparatoru Gaozu'yu peşine taktı ve Baideng'de yedi gün kuşattı. Ardından gelen barışla Han sarayı Hunlara her yıl ipek ve tahıl gönderdi.",
    source: 'Sima Qian, Shiji, bölüm 110',
    hint: 'Metehan ile zafer kazan',
    earn: won,
  },

  {
    id: 'taciz',
    commander: 'alp-arslan',
    title: 'Vur, çekil, yine vur',
    text: 'Selçuklu atlı okçuları Bizans hattına yaklaşıp ok yağdırır, karşılık gelince çekilirdi. Saatler süren taciz, ağır zırhlı orduyu yorar ve saflarını gevşetirdi.',
    source: 'Mihail Attaleiates, Tarih',
    hint: 'Bir birliği taciz et',
    earn: (s) => saw(s, 'harass'),
  },
  {
    id: 'kataphrakt',
    commander: 'alp-arslan',
    title: 'Zırhlı at, zırhlı atlı',
    text: "Bizans'ın ağır süvarisi kataphraktlar atlarıyla birlikte zırhlıydı. Hamleleri durdurulamazdı ama ağırdı; Selçuklular hamleyi göğüslemek yerine önünden çekilip yorulmasını beklerdi.",
    source: 'Bizans askerî el kitapları (Taktika)',
    hint: 'Ağır süvariyi hamleye kışkırt',
    earn: (s) => saw(s, 'charge'),
  },
  {
    id: 'kanat',
    commander: 'alp-arslan',
    title: 'Ordugahtan uzağa',
    text: 'Malazgirt günü Selçuklular gün boyu geri çekildi; Bizans ordusu onları kovalarken ordugahından uzaklaştı. Bozkır ordusu merkezde çekilir, kanatlarıyla sarmak için doğru anı beklerdi.',
    source: 'Mihail Attaleiates, Tarih',
    hint: 'Bir kola emir ver',
    earn: (s) => s.orders.length > 0,
  },
  {
    id: 'aksam',
    commander: 'alp-arslan',
    title: 'Dönüş emri bozgun oldu',
    text: 'Akşam Romanos ordugaha dönmek için sancakları çevirdi. Arkadaki birlikler bunu yenilgi sandı; yedeği yöneten Andronikos Dukas savaşı bırakıp çekildi ve hat çözüldü.',
    source: 'Mihail Attaleiates, Tarih',
    hint: 'Gün batımına kadar dayan',
    earn: (s) => s.commander === 'alp-arslan' && saw(s, 'sunset'),
  },
  {
    id: 'yem',
    commander: 'alp-arslan',
    title: 'Yem akıncılar',
    text: "Malazgirt'ten bir gün önce Türk akıncıları Bizans ordugahının önünde görünüp kaçtı. Peşlerine düşen Nikephoros Basilakes pusuya çekildi ve esir alındı. Oyun bu çatışmayı savaş gününe taşır.",
    source: 'Nikephoros Bryennios, Tarih (I.14)',
    hint: 'Hamle edeni pusudaki kola çek',
    earn: (s) => s.ambushes.length > 0,
  },
  {
    id: 'esir',
    commander: 'alp-arslan',
    title: 'Esir imparator',
    text: 'Romanos Diogenes savaş meydanında esir düştü. Alp Arslan ona saygıyla davrandı ve bir antlaşmayla serbest bıraktı. Romanos\'u sonunda kör eden, tahtını alan kendi sarayı oldu.',
    source: 'Attaleiates; Mikhail Psellos, Khronographia',
    hint: 'İmparatoru esir al',
    earn: (s) => s.commander === 'alp-arslan' && saw(s, 'emperorCaptured'),
  },

  {
    id: 'gecit',
    commander: 'kilicarslan',
    title: 'Tzivritze geçidi',
    text: "1176'da Manuel Komnenos'un ordusu Konya yolunda dar Tzivritze geçidine uzun bir kol halinde girdi. Selçuklular iki yamacı tutmuştu; kolun başı durunca arkası geçitte kaldı.",
    source: 'Niketas Khoniates, Tarih',
    hint: 'YOLU KES',
    earn: (s) => s.blockade !== null,
  },
  {
    id: 'sikisma',
    commander: 'kilicarslan',
    title: 'Darda düzen tutulmaz',
    text: 'Geçitte ağırlık arabaları yolu tıkadı. Arkadan gelen birlikler üst üste bindi; ne saf kurabildiler ne geri dönebildiler. Yamaçlardan yağan oklar sıkışan kolu buldu.',
    source: 'Niketas Khoniates, Tarih',
    hint: 'Bir birliği geçitte sıkıştır',
    earn: (s) => saw(s, 'jam'),
  },
  {
    id: 'baris',
    commander: 'kilicarslan',
    title: 'Barışı Manuel istedi',
    text: 'Manuel ateşkes istedi. Kılıçarslan, Dorylaion ve Sublaion kalelerinin yıkılması şartıyla kabul etti. Manuel sözünün yarısını tuttu: yalnızca Sublaion\'u yıktı.',
    source: 'Niketas Khoniates, Tarih',
    hint: "Manuel'i kuşat",
    earn: (s) => s.commander === 'kilicarslan' && saw(s, 'emperorCaptured'),
  },
  {
    id: 'muhur',
    commander: 'kilicarslan',
    title: "Malazgirt'in mührü",
    text: "Malazgirt kapıyı açmıştı, Miryokefalon kapattı. Bizans bundan sonra Anadolu'nun içlerini geri almayı bir daha ciddi olarak denemedi; bölge kalıcı olarak Türk yurdu oldu.",
    source: 'Tarih yazımında genel değerlendirme',
    hint: 'II. Kılıçarslan ile zafer kazan',
    earn: (s) => s.commander === 'kilicarslan' && won(s),
  },
]

export const LORE_LIMITS = { text: MAX_TEXT, title: MAX_TITLE } as const

export function loreOf(commander: CommanderId): LoreCard[] {
  return LORE.filter((c) => c.commander === commander)
}

export function loreCard(id: LoreId): LoreCard | undefined {
  return LORE.find((c) => c.id === id)
}

/**
 * Bu savaşta kazanılan, daha önce görülmemiş kartlardan en nadiri; yoksa null.
 * Yalnızca savaşın komutanının kartları: Metehan'ın kartı Malazgirt'te çıkmaz.
 */
export function pickLore(s: BattleSummary, seen: readonly LoreId[]): LoreCard | null {
  const earned = loreOf(s.commander).filter((c) => !seen.includes(c.id) && c.earn(s))
  return earned.at(-1) ?? null
}
