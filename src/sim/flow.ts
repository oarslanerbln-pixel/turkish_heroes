/**
 * Oyun akışı: hangi ekrandayız, simülasyon ilerliyor mu. Kare döngüsü, girdi
 * ve HUD bundan türetilir. Açılış ve sinematik modları çekimleriyle gelecek.
 *
 * - menu: başlangıç ekranı; arkada seçilen savaş donuk durur.
 * - playing: savaş sürüyor.
 * - paused: oyuncu durdurdu ya da uygulamadan çıktı; simülasyon tamamen donar.
 * - outcome: savaş bitti, sonuç ekranı.
 */
export type FlowMode = 'menu' | 'playing' | 'paused' | 'outcome'

const NEXT: Record<FlowMode, readonly FlowMode[]> = {
  menu: ['playing'],
  playing: ['paused', 'outcome', 'menu'],
  // YENİDEN ve yeni komutan da 'playing'e girer: savaş hemen başlar.
  paused: ['playing', 'menu'],
  outcome: ['playing', 'menu'],
}

/** Geçiş tanımlı mı? Tanımsız geçiş (ör. sonuçtan molaya) yok sayılır. */
export function canEnter(from: FlowMode, to: FlowMode): boolean {
  return NEXT[from].includes(to)
}
