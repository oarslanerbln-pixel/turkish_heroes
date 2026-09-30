// Oyuncunun kalıcı ilerlemesi: hangi komutanla zafer kazandı, hangi ipuçlarını
// gördü. localStorage'da tek anahtar; gizli sekmede okuma/yazma atabilir, o
// zaman ilerleme o oturumla sınırlı kalır (oyun yine oynanır).

import type { CommanderId } from '../mechanics/scenario'
import { LADDER_TOP, nextLadderStep } from '../mechanics/waves'
import { loadBestScore } from './score'

const STORAGE_KEY = 'hilal_progress'

export type HintId = 'harass' | 'charge' | 'dusk' | 'wings' | 'wingsDusk'

interface Progress {
  /** Zafer kazanılan komutanlar. */
  won: CommanderId[]
  /** Bir kez gösterilip bir daha gösterilmeyecek ipuçları. */
  hints: HintId[]
  /** Bitirilen (kazanılan ya da kaybedilen) Malazgirt savaşı sayısı. */
  battlesPlayed: number
  /** Metehan'ın zorluk merdivenindeki basamak (bkz. waves.ts DAMAGE_LADDER). */
  ladder: number
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>
      const won = p.won ?? []
      return {
        won,
        hints: p.hints ?? [],
        battlesPlayed: p.battlesPlayed ?? 0,
        // Merdivenden önce Metehan'ı zaten kazanmış oyuncu tam hasarda başlar:
        // o zorluğu yenmiş, kolaylaştırılmış savaş ona hediye değil.
        ladder: p.ladder ?? (won.includes('metehan') ? LADDER_TOP : 0),
      }
    }
  } catch {
    // Bozuk kayıt ya da erişilemeyen depolama: sıfırdan başla.
  }
  return { won: [], hints: [], battlesPlayed: 0, ladder: 0 }
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
 * Komutan açık mı? Metehan hep açık; Alp Arslan, Metehan kazanılınca.
 * İlerleme kaydı bu sürümle geldi: Alp Arslan'ı prototipte zaten oynamış
 * (rekoru olan) oyuncunun kilidi geri kapanmasın.
 */
export function isUnlocked(id: CommanderId): boolean {
  if (id === 'metehan') return true
  return progress.won.includes('metehan') || loadBestScore(id) > 0
}

export function recordVictory(id: CommanderId): void {
  if (progress.won.includes(id)) return
  progress = { ...progress, won: [...progress.won, id] }
  save()
}

export function recordBattleEnd(): void {
  progress = { ...progress, battlesPlayed: progress.battlesPlayed + 1 }
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
 * İlk savaş mı? Tasarım belgesi: ilk ödül 30 sn içinde gelmeli ve ilk
 * oynayışta hamle hasarı yarıya iner; zorluk tekrar oynayışta yıldızlarla gelir.
 */
export function isFirstBattle(): boolean {
  return progress.battlesPlayed === 0
}

/** İpucu daha önce gösterilmediyse işaretler ve true döner. */
export function takeHint(id: HintId): boolean {
  if (progress.hints.includes(id)) return false
  progress = { ...progress, hints: [...progress.hints, id] }
  save()
  return true
}
