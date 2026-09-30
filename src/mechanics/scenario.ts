// Komutanlar ve senaryoların ortak tanımları.
//
// Her komutan kendi savaşını getiriyor: Metehan'da dalgalar halinde gelen
// sürü, Alp Arslan'da birlik düzeninde ilerleyen ordu. Yönetmen, hilal
// mekaniği, kamera ve arayüz iskeleti ortak; senaryoya özgü kurallar
// sim/scenarios.ts'teki uygulamalarda. Senaryolar birbirini bilmez.

import { BATTLE_SIZE } from './corps'
import { MAX_WAVE_ENEMIES } from './waves'

export type CommanderId = 'metehan' | 'alp-arslan'

export interface CommanderInfo {
  id: CommanderId
  name: string
  /** Savaş ve tarih — kartın alt satırı. */
  battle: string
  /** Başlangıç ekranındaki üç adım. */
  steps: readonly { title: string; text: string }[]
}

export const COMMANDERS: readonly CommanderInfo[] = [
  {
    id: 'metehan',
    name: 'Metehan',
    battle: 'Hilal taktiği · MÖ 209',
    steps: [
      { title: '1 · Çekil', text: 'Kaçıyormuş gibi yap. Düşman peşine düştükçe düzeni bozulur.' },
      { title: '2 · Topla', text: 'Düzeni bozulan düşman kümelenir. Hilal enerjisi böyle dolar.' },
      { title: '3 · Kuşat', text: 'Enerji dolunca yayı kapat. Yaydaki herkes düşer.' },
    ],
  },
  {
    id: 'alp-arslan',
    name: 'Alp Arslan',
    battle: 'Malazgirt · 1071',
    steps: [
      { title: '1 · Taciz et', text: 'Birliklerin menzilinde dur. Düzenleri erir, ilerleyişleri yavaşlar.' },
      { title: '2 · Kışkırt', text: 'Çok yaklaşırsan ağır süvari hamle eder. Kırmızıyı görünce kaç.' },
      { title: '3 · Akşamı bekle', text: 'Gün batınca ordu döner. Çözülen hattı kuşat, imparatoru esir al.' },
    ],
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

/** instancedMesh kapasitesi: tüm senaryoların en kalabalık sahnesi. */
export const ENEMY_CAPACITY = Math.max(MAX_WAVE_ENEMIES, BATTLE_SIZE)
