// Sefer haritası: bozkırdan Anadolu'ya, üç savaşta bir yürüyüş.
//
// Ana menüde komutan listesinin yerini alır. Düğümler savaşların yeri:
// Metehan doğuda bozkırda, Alp Arslan Malazgirt'te, II. Kılıçarslan batıda
// Miryokefalon'da. Aradaki yol kilit zinciri: her savaş bir öncekinin
// zaferiyle açılır. Ölçekli bir harita değil. Düğümler yukarıdan aşağı üç
// kuşakta, açılış sırasıyla dizili; böylece etiketler birbirine binmez ve
// ↑/↓ tuşları haritada da aynı yöne gider. Coğrafyaya sadık kalan tek şey
// doğu–batı yönü.
//
// Burada çizim yok, yalnızca düğümlerin yeri, yolun şekli ve ilerlemeden
// türeyen durum var. İlerlemenin kendisi (localStorage) sim/progress.ts'te
// tutulur; bileşen onu okur ve NodeProgress olarak buraya verir. Böylece
// kurallar testte localStorage olmadan sınanır.

import type { CommanderId } from './scenario'

/**
 * Haritanın çizim alanı (SVG viewBox). Kutu kısa ekranda bu orandan uzun
 * olabilir; yol kutuya esner, düğümler yüzde konumla onu izler.
 */
export const MAP_WIDTH = 300
export const MAP_HEIGHT = 170

export interface CampaignNode {
  id: CommanderId
  x: number
  y: number
  /** Etiket düğümün hangi yanında duruyor; yol öbür yandan geçer. */
  label: 'left' | 'right'
}

/**
 * COMMANDERS sırasıyla aynı: yol bu sırayla çizilir. Düğümler arası 61 birim:
 * kutu 148 px'ken satırlar 52 px arayla durur, 44 px'lik dokunma alanları
 * arasında 8 px kalır (MIMARI.md §10.8).
 *
 * Mühürler kenarlarda, etiketler içeri bakar: yatay telefonda harita ~195 px,
 * bir etiket 12 px yazıyla ~170 px. Ortadaki bir mühürün etiketi sığmaz.
 * Bozkır ve Malazgirt doğuda, Miryokefalon batıda; yol önce iner, sonra batıya
 * döner.
 */
export const CAMPAIGN_NODES: readonly CampaignNode[] = [
  { id: 'metehan', x: 276, y: 24, label: 'left' },
  { id: 'alp-arslan', x: 266, y: 85, label: 'left' },
  { id: 'kilicarslan', x: 30, y: 146, label: 'right' },
]

/** Bir savaşın ilerlemesi. Bileşen sim/progress'ten doldurur. */
export interface NodeProgress {
  id: CommanderId
  /** Seçilip oynanabilir: kilidi açık ya da URL ile istenmiş. */
  available: boolean
  /** En az bir kez zafer kazanıldı. */
  won: boolean
  /** En iyi yıldız, 0–3. */
  stars: number
  /** Kilidi yeni açıldı, henüz hiç oynanmadı. */
  fresh: boolean
}

/**
 * İki düğüm arasındaki yol: düğümden dik çıkar, ötekine dik iner. Böylece
 * yol yanlardaki etiketlerin üstünden değil, kuşakların arasından geçer.
 */
export function segmentPath(a: CampaignNode, b: CampaignNode): string {
  const mid = (a.y + b.y) / 2
  return `M ${a.x} ${a.y} C ${a.x} ${mid} ${b.x} ${mid} ${b.x} ${b.y}`
}

/** Bir savaşta kazanılabilecek en çok yıldız. */
export const MAX_STARS = 3

/**
 * Sancağın dikileceği düğüm: haritanın oyuncuya "sıradaki hedef" dediği
 * yer. null dönerse haritada sancak olmaz.
 *
 * Önce ilerleme: yolda kazanılmamış ilk açık savaş. URL ile ileri atlanmış
 * oyuncu için de sancak geride kalan savaşta durur. Hepsi kazanılınca
 * ustalık: yıldızı en az olan savaş; eşitlikte yolda önce gelen. Her savaş
 * tam yıldızsa sefer tamamdır, sancak kalkar.
 *
 * @param nodes CAMPAIGN_NODES sırasıyla, yolun başından sonuna.
 */
export function campaignFrontier(nodes: readonly NodeProgress[]): CommanderId | null {
  const next = nodes.find((n) => n.available && !n.won)
  if (next) return next.id
  let weakest: NodeProgress | null = null
  for (const n of nodes) {
    if (!n.available || n.stars >= MAX_STARS) continue
    if (!weakest || n.stars < weakest.stars) weakest = n
  }
  return weakest?.id ?? null
}
