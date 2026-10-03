import { useFrame } from '@react-three/fiber'
import { world } from '../sim/world'

// Olay kuyruğu karenin en sonunda boşalır: kamera (5), sarsıntı (6) ve kameraya
// bakan görseller (7) okuduktan sonra, çizimden (10) önce.
const FLUSH_PRIORITY = 9

export function EventFlush() {
  useFrame(() => {
    world.events.length = 0
  }, FLUSH_PRIORITY)
  return null
}
