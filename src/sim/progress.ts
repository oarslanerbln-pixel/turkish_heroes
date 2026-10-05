// Oyuncunun kalıcı ilerlemesi: hangi komutanla zafer kazandı, hangi ipuçlarını
// gördü. localStorage'da tek anahtar; gizli sekmede okuma/yazma atabilir, o
// zaman ilerleme o oturumla sınırlı kalır (oyun yine oynanır).

import type { LoreId } from '../lore/lore'
import { commanderInfo, type CommanderId } from '../mechanics/scenario'
import { LADDER_TOP, nextLadderStep } from '../mechanics/waves'
import { loadBestScore } from './score'

const STORAGE_KEY = 'hilal_progress'

export type HintId =
  | 'harass'
  | 'charge'
  | 'dusk'
  | 'wings'
  | 'wingsDusk'
  | 'blockade'
  | 'jam'
  | 'volley'
  | 'still'

interface Progress {
  /** Zafer kazanılan komutanlar. */
  won: CommanderId[]
  /** Bir kez gösterilip bir daha gösterilmeyecek ipuçları. */
  hints: HintId[]
  /** Komutan başına bitirilen (kazanılan ya da kaybedilen) ordu savaşı sayısı. */
  battles: Partial<Record<CommanderId, number>>
  /** Metehan'ın zorluk merdivenindeki basamak (bkz. waves.ts DAMAGE_LADDER). */
  ladder: number
  /** Kazanılan tarih notları, kazanılma sırasıyla (bkz. lore/lore.ts). */
  lore: LoreId[]
  /** Ordu savaşlarında kazanılan en iyi yıldız (1–3); menüdeki komutan kartı için. */
  stars: Partial<Record<CommanderId, number>>
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress> & { battlesPlayed?: number }
      const won = p.won ?? []
      return {
        won,
        hints: p.hints ?? [],
        // Eski kayıt yalnızca Malazgirt savaşlarını sayıyordu.
        battles: p.battles ?? { 'alp-arslan': p.battlesPlayed ?? 0 },
        // Merdivenden önce Metehan'ı zaten kazanmış oyuncu tam hasarda başlar:
        // o zorluğu yenmiş, kolaylaştırılmış savaş ona hediye değil.
        ladder: p.ladder ?? (won.includes('metehan') ? LADDER_TOP : 0),
        lore: p.lore ?? [],
        stars: p.stars ?? inferStars(won, p.lore ?? []),
      }
    }
  } catch {
    // Bozuk kayıt ya da erişilemeyen depolama: sıfırdan başla.
  }
  return { won: [], hints: [], battles: {}, ladder: 0, lore: [], stars: {} }
}

/**
 * Yıldız kaydı bu sürümle geldi; önceki oyuncunun yıldızları kayıttan
 * türetilir: zafer en az bir yıldızdır, imparatoru / Manuel'i
 * kuşatmanın notu (yalnızca o anda kazanılır) üç yıldız. İki yıldız
 * türetilemez; oyuncu bir sonraki zaferinde kendisi yazar.
 */
export function inferStars(
  won: readonly CommanderId[],
  lore: readonly LoreId[],
): Partial<Record<CommanderId, number>> {
  const stars: Partial<Record<CommanderId, number>> = {}
  for (const id of won) stars[id] = 1
  if (lore.includes('esir')) stars['alp-arslan'] = 3
  if (lore.includes('baris')) stars.kilicarslan = 3
  return stars
}

let progress = load()

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Gizli sekme: ilerleme bu oturumla sınırlı.
  }
}

/**
 * Komutan açık mı? Zincir: Metehan → Alp Arslan → II. Kılıçarslan; bir
 * öncekiyle zafer kazanınca açılır. Rekoru olan (prototipte zaten oynamış)
 * oyuncunun kilidi geri kapanmasın.
 */
export function isUnlocked(id: CommanderId): boolean {
  const by = commanderInfo(id).unlockedBy
  if (!by) return true
  return progress.won.includes(by) || loadBestScore(id) > 0
}

/** Bu komutanla zafer kazanıldı mı. */
export function hasWon(id: CommanderId): boolean {
  return progress.won.includes(id)
}

/** Bu komutanın ordu savaşında kazanılan en iyi yıldız (0 = henüz yok). */
export function bestStars(id: CommanderId): number {
  return progress.stars[id] ?? 0
}

/** Zafer yıldızı: yalnızca rekor kırarsa yazılır. */
export function recordStars(id: CommanderId, stars: number): void {
  if (stars <= bestStars(id)) return
  progress = { ...progress, stars: { ...progress.stars, [id]: stars } }
  save()
}

export function recordVictory(id: CommanderId): void {
  if (progress.won.includes(id)) return
  progress = { ...progress, won: [...progress.won, id] }
  save()
}

/** Ordu savaşı bitti (kazanılan ya da kaybedilen). */
export function recordBattleEnd(id: CommanderId): void {
  progress = { ...progress, battles: { ...progress.battles, [id]: (progress.battles[id] ?? 0) + 1 } }
  save()
}

/** Metehan'ın zorluk merdivenindeki basamak. */
export function ladderStep(): number {
  return progress.ladder
}

/** Metehan savaşı bitti: merdivende bir basamak yukarı ya da aşağı. */
export function recordLadder(victory: boolean): void {
  progress = { ...progress, ladder: nextLadderStep(progress.ladder, victory) }
  save()
}

/**
 * Bu komutanla ilk savaş mı? Tasarım belgesi: ilk ödül 30 sn içinde gelmeli
 * ve ilk oynayışta hamle hasarı yarıya iner; zorluk tekrar oynayışta
 * yıldızlarla gelir.
 */
export function isFirstBattle(id: CommanderId): boolean {
  return (progress.battles[id] ?? 0) === 0
}

/** İpucu daha önce gösterilmediyse işaretler ve true döner. */
export function takeHint(id: HintId): boolean {
  if (progress.hints.includes(id)) return false
  progress = { ...progress, hints: [...progress.hints, id] }
  save()
  return true
}

/** Kazanılan tarih notları. */
export function earnedLore(): readonly LoreId[] {
  return progress.lore
}

export function recordLore(id: LoreId): void {
  if (progress.lore.includes(id)) return
  progress = { ...progress, lore: [...progress.lore, id] }
  save()
}
