// En iyi skor kalıcılığı.

const STORAGE_KEY = 'hilal_best_score'

export function loadBestScore(): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = localStorage.getItem(STORAGE_KEY)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) ? n : 0
}

/** Skoru mevcut en iyiyle karşılaştırır, yüksekse kaydeder. Güncel en iyiyi döndürür. */
export function saveBestScore(score: number): number {
  const best = Math.max(score, loadBestScore())
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(best))
  }
  return best
}
