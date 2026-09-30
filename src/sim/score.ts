// En iyi skor kalıcılığı — komutan başına ayrı: iki savaşın puan ölçeği farklı.

import type { CommanderId } from '../mechanics/scenario'

/** Metehan eski anahtarı korur: güncellemeden önceki rekorlar kaybolmasın. */
function storageKey(commander: CommanderId): string {
  return commander === 'metehan' ? 'hilal_best_score' : `hilal_best_score_${commander}`
}

export function loadBestScore(commander: CommanderId): number {
  try {
    const raw = localStorage.getItem(storageKey(commander))
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    // Erişilemeyen depolama (gizli sekme, engellenmiş çerezler, Node'un yolsuz localStorage'ı).
    return 0
  }
}

/** Skoru mevcut en iyiyle karşılaştırır, yüksekse kaydeder. Güncel en iyiyi döndürür. */
export function saveBestScore(commander: CommanderId, score: number): number {
  const best = Math.max(score, loadBestScore(commander))
  try {
    localStorage.setItem(storageKey(commander), String(best))
  } catch {
    // Gizli sekme: rekor bu oturumla sınırlı.
  }
  return best
}
