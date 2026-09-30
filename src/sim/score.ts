// En iyi skor kalıcılığı — komutan başına ayrı: iki savaşın puan ölçeği farklı.

import type { CommanderId } from '../mechanics/scenario'

/** Metehan eski anahtarı korur: güncellemeden önceki rekorlar kaybolmasın. */
function storageKey(commander: CommanderId): string {
  return commander === 'metehan' ? 'hilal_best_score' : `hilal_best_score_${commander}`
}

export function loadBestScore(commander: CommanderId): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = localStorage.getItem(storageKey(commander))
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) ? n : 0
}

/** Skoru mevcut en iyiyle karşılaştırır, yüksekse kaydeder. Güncel en iyiyi döndürür. */
export function saveBestScore(commander: CommanderId, score: number): number {
  const best = Math.max(score, loadBestScore(commander))
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(storageKey(commander), String(best))
  }
  return best
}
