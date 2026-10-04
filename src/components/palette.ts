/**
 * Durum renkleri: sahnede ve HUD'da aynı anlamı taşıyanlar tek yerde (STIL.md §3).
 * hud.css'teki --ready bununla eşit tutulur.
 */

/** Düşmanın hamlesi: kama, hamle eden binici, hamledeki birliğin sancağı. */
export const CHARGE_COLOR = '#ff2a12'

/**
 * Hilal hazır. Eskiden kor turuncusuydu ve hamle kırmızısından ayırt
 * edilemiyordu (ΔE_OK 0,03). Turkuaz Selçuklu'nun rengi; renk körlüğünde de
 * kırmızıdan ayrı kalır (palette.test.ts).
 */
export const READY_COLOR = '#5ef2e0'

/** Hilal şarj oluyor. */
export const CHARGING_COLOR = '#ffd700'
