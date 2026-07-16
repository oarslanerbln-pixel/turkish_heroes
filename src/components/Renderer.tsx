import { useFrame } from '@react-three/fiber'

/**
 * Sahneyi açıkça çizer.
 *
 * Neden gerekli: React Three Fiber'da `useFrame`'e sıfırdan büyük bir öncelik
 * veren herhangi bir bileşen render döngüsünü devralmış sayılır ve R3F otomatik
 * çizimi bırakır (fiber kaynağında: `if (!state.internal.priority) gl.render(...)`).
 * Simülasyon sırasını sabitlemek için önceliklerden yararlanıyoruz (oyuncu 0 →
 * düşmanlar 1 → yönetmen 2), dolayısıyla çizimi kendimiz yapmak zorundayız.
 * Bu bileşen silinirse ekran simsiyah kalır: mantık çalışmaya, FPS sayacı dönmeye
 * devam eder, sadece hiçbir şey çizilmez — sessiz ve teşhisi zor bir hata.
 *
 * En yüksek öncelikte çalışır ki o karenin tüm güncellemeleri işlenmiş olsun.
 */
const RENDER_PRIORITY = 10

export function Renderer() {
  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera)
  }, RENDER_PRIORITY)

  return null
}
