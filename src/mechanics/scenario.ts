// Komutanlar ve senaryoların ortak tanımları.
//
// Her komutan kendi savaşını getiriyor: Metehan'da dalgalar halinde gelen
// sürü, Alp Arslan'da birlik düzeninde ilerleyen ordu. Yönetmen, hilal
// mekaniği, kamera ve arayüz iskeleti ortak; senaryoya özgü kurallar
// sim/scenarios.ts'teki uygulamalarda. Senaryolar birbirini bilmez.

import { armySize, MALAZGIRT, MIRYOKEFALON, type BattleLayout } from './corps'
import { MAX_WAVE_ENEMIES } from './waves'

export type CommanderId = 'metehan' | 'alp-arslan' | 'kilicarslan'

export interface CommanderInfo {
  id: CommanderId
  name: string
  /** Savaş ve tarih — kartın alt satırı. */
  battle: string
  /**
   * Komutanın öğrettiği karar ekseni. Üç komutan üç soru: Metehan NASIL
   * (hilalin kendisi), Alp Arslan NE ZAMAN (hilali akşama saklamak),
   * II. Kılıçarslan NEREDE (yolu nerede kesmeli). Menü bu sırayla okunur.
   */
  axis: 'NASIL' | 'NE ZAMAN' | 'NEREDE'
  /** Eksenin sorusu — menüdeki brifingin başlığı. */
  question: string
  /** Başlangıç ekranındaki üç adım. */
  steps: readonly { title: string; text: string }[]
  /** Klavyede bu savaşa özgü tuşlar (dokunmatikte düğmeler zaten ekranda). */
  keys?: string
  /** Bu komutanla zafer kazanınca açılır; yoksa hep açık. */
  unlockedBy?: CommanderId
  /**
   * Zafer beklenmeden, Metehan'ın dalgalı savaşında bu dalgaya (1'den sayılır)
   * ulaşmak da açar: kapı acemiye dar olmasın (TASARIM Mantık 6).
   */
  unlockWave?: number
  /** Yıldızların koşulu (1–3); brifing sıradakini hedef olarak gösterir (TASARIM Mantık 5). */
  stars: readonly [string, string, string]
}

export const COMMANDERS: readonly CommanderInfo[] = [
  {
    id: 'metehan',
    name: 'Metehan',
    battle: 'Hilal taktiği · MÖ 209',
    axis: 'NASIL',
    question: 'Düşmanı nasıl kuşatırsın?',
    steps: [
      { title: '1 · Çekil', text: 'Kaçıyormuş gibi yap. Düşman peşine düştükçe düzeni bozulur.' },
      { title: '2 · Topla', text: 'Düzeni bozulan düşman kümelenir. Hilal enerjisi böyle dolar.' },
      { title: '3 · Kuşat', text: 'Enerji dolunca yayı kapat. Yaydaki herkes düşer.' },
    ],
    stars: ['Dört dalgayı aş', 'Az yarayla bitir', 'Çok az yarayla bitir'],
  },
  {
    id: 'alp-arslan',
    name: 'Alp Arslan',
    battle: 'Malazgirt · 1071',
    axis: 'NE ZAMAN',
    question: 'Hilali ne zaman kapatırsın?',
    keys: 'Q / E: kol emirleri',
    unlockedBy: 'metehan',
    unlockWave: 3,
    steps: [
      { title: '1 · Taciz et', text: 'Birliklerin menzilinde dur. Düzenleri erir, ilerleyişleri yavaşlar.' },
      { title: '2 · Kışkırt', text: 'Çok yaklaşırsan ağır süvari hamle eder. Kırmızıyı görünce kaç.' },
      { title: '3 · Akşamı bekle', text: 'Gün batınca ordu döner. Gece çökene dek ordunun dörtte birini düşür ya da imparatoru esir al.' },
    ],
    stars: ['Ordunun dörtte birini düşür', 'Ordunun yarısını düşür', 'İmparatoru esir al'],
  },
  {
    id: 'kilicarslan',
    name: 'II. Kılıçarslan',
    battle: 'Miryokefalon · 1176',
    axis: 'NEREDE',
    question: 'Yolu nerede kesersin?',
    keys: 'R: yolu kes · Q / E: yamaçlar',
    unlockedBy: 'alp-arslan',
    steps: [
      { title: '1 · Yolu kes', text: 'Kol geçide girerken boğazın hemen ötesinde YOLU KES. Kolun başı durur.' },
      { title: '2 · Sıkıştır', text: 'Arkadan gelen üst üste biner; darda düzen tutulmaz. Öncüyü taciz et, yığını temizlemesin.' },
      { title: '3 · Kuşat', text: 'Sıkışan birliği hilalle kapat. Manuel açıkta kalınca savaş biter.' },
    ],
    stars: ['Kolu geceye dek geçitte tut', 'Ordunun yarısını düşür', "Manuel'i kuşat"],
  },
]

export function commanderInfo(id: CommanderId): CommanderInfo {
  return COMMANDERS.find((c) => c.id === id) ?? COMMANDERS[0]
}

/** URL'den komutan: ?commander=alp-arslan oyun testinde doğrudan seçer. */
export function parseCommander(search: string): CommanderId | null {
  const value = new URLSearchParams(search).get('commander')
  return COMMANDERS.some((c) => c.id === value) ? (value as CommanderId) : null
}

/** Ordu düzeninde savaşan komutanın savaş alanı; dalgalı savaşta null. */
export function battleLayout(id: CommanderId): BattleLayout | null {
  if (id === 'alp-arslan') return MALAZGIRT
  if (id === 'kilicarslan') return MIRYOKEFALON
  return null
}

/** instancedMesh kapasitesi: tüm senaryoların en kalabalık sahnesi. */
export const ENEMY_CAPACITY = Math.max(MAX_WAVE_ENEMIES, armySize(MALAZGIRT), armySize(MIRYOKEFALON))
