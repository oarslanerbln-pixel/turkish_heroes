import type { Vector3 } from 'three'
import { HILAL_CONFIG } from '../mechanics/hilalSystem'
import { HURT_CONFIG } from '../sim/hurt'
import type { World } from '../sim/world'

const STRIKE_SHAKE = 0.5
/** Yara sarsıntısı vuruşunkinin altında: oyuncunun kendi darbesi baskın kalsın. */
const HURT_SHAKE = 0.14

/** Salınım sıklığı (Hz). Vuruş ağır bir tepme, yara kısa bir sarsılma. */
const STRIKE_HZ = 7
const HURT_HZ = 11

/** Genlikler (dünya birimi): en sert vuruş anında, sonra karesiyle sönümlenir. */
function amplitudes(w: World): { strike: number; hurt: number } {
  const strike = w.strikeTimer / HILAL_CONFIG.strikeDuration
  const hurt = w.hurtTimer / HURT_CONFIG.shake
  return { strike: strike * strike * STRIKE_SHAKE, hurt: hurt * hurt * HURT_SHAKE }
}

/**
 * Bu karenin kamera kaydırması (STIL.md §9, K3). Yönsüz gürültü yerine:
 * vuruşta kamera yayın kapandığı yöne tepip sönerek geri salınır; yarada
 * dikey bir sarsılma. Zamanlayıcılardan türer, rastgele değildir.
 */
export function shakeOffset(w: World, reducedMotion: boolean, out: Vector3): Vector3 {
  out.set(0, 0, 0)
  if (reducedMotion) return out
  const { strike, hurt } = amplitudes(w)
  if (strike > 0) {
    const t = HILAL_CONFIG.strikeDuration - w.strikeTimer
    const k = strike * Math.sin(2 * Math.PI * STRIKE_HZ * t)
    // strikeFacing = atan2(dx, dz) düzeninde; birim vektörü (sin, cos).
    out.x += Math.sin(w.strikeFacing) * k
    out.z += Math.cos(w.strikeFacing) * k
    out.y -= Math.abs(k) * 0.3
  }
  if (hurt > 0) {
    const t = HURT_CONFIG.shake - w.hurtTimer
    out.y += hurt * Math.sin(2 * Math.PI * HURT_HZ * t)
  }
  return out
}
