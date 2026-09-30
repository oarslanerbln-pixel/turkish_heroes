// Bilgi Hazinesi: tarih notlarının arşivi.
//
// Kural (lore.ts, 5): kazanılmamış notun başlığı ve onu neyin açacağı
// görünür, metni ve kaynağı görünmez. Merak başlıkla uyanır, bilgi ancak
// oynanınca gelir — "önce eylem, sonra bilgi" arşivde de bozulmasın. Bu modül
// arşivin görünümünü üretir; kilitli notun metni yapı gereği hiç kopyalanmaz,
// arayüz yanlışlıkla gösteremez.

import type { CommanderId } from '../mechanics/scenario'
import { LORE, loreOf, type LoreId } from './lore'

interface EntryBase {
  id: LoreId
  /** Komutanın notları arasındaki sırası (1'den): anlatı sırası. */
  no: number
  title: string
}

export type ArchiveEntry =
  | (EntryBase & { earned: true; text: string; source: string })
  | (EntryBase & { earned: false; hint: string })

/** Komutanın notları anlatı sırasıyla; kazanılmamışların metni yok. */
export function archiveOf(commander: CommanderId, earned: readonly LoreId[]): ArchiveEntry[] {
  return loreOf(commander).map((c, i): ArchiveEntry => {
    const base = { id: c.id, no: i + 1, title: c.title }
    return earned.includes(c.id)
      ? { ...base, earned: true, text: c.text, source: c.source }
      : { ...base, earned: false, hint: c.hint }
  })
}

export interface ArchiveCount {
  earned: number
  total: number
}

/** Kazanılan / toplam not; komutan verilmezse bütün hazine. */
export function archiveCount(earned: readonly LoreId[], commander?: CommanderId): ArchiveCount {
  const cards = commander ? loreOf(commander) : LORE
  return { earned: cards.filter((c) => earned.includes(c.id)).length, total: cards.length }
}

/**
 * Arşiv açıldığında seçili not: komutanın en son kazanılanı (az önce
 * sonuç ekranında görülen büyük olasılıkla odur); hiç yoksa ilk not — kilitli
 * haliyle bir hedef gösterir.
 */
export function defaultEntry(commander: CommanderId, earned: readonly LoreId[]): LoreId {
  const own = new Set(loreOf(commander).map((c) => c.id))
  const last = earned.filter((id) => own.has(id)).at(-1)
  return last ?? loreOf(commander)[0].id
}

/** Anlatı sırası için Roma rakamı (notlar el yazması gibi numaralanır). */
export function roman(n: number): string {
  const table: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let out = ''
  for (const [value, glyph] of table) {
    while (n >= value) {
      out += glyph
      n -= value
    }
  }
  return out
}
