import { CRESCENT } from '../mechanics/hilalSystem'

/**
 * ringGeometry argümanlarını hilal yayına göre üretir.
 *
 * Açı düzeni kritik: geometri yerel XY'de theta=0'da +X'ten başlar; mesh
 * rotation.x=-PI/2 ile yatırılınca yerel (cosθ, sinθ) dünyada (cosθ, -sinθ)
 * olur. Yani dünya +z yönü yerel theta=-PI/2'ye denk gelir. Yay bu yüzden
 * -PI/2 etrafında kuruluyor; ardından grubun rotation.y = facing değeri onu
 * kümeye çeviriyor.
 *
 * Bu düzen isInCrescent()'in atan2(dx, dz) hesabıyla birebir uyuşmak zorunda:
 * uyuşmazsa oyuncu gördüğü yere vurmaz ve hata sessizdir — ekranda yay doğru
 * görünür, sadece yanlış düşmanlar ölür.
 */
export function crescentArgs(
  inner: number,
  outer: number,
): [number, number, number, number, number, number] {
  return [
    inner,
    outer,
    64, // thetaSegments — yay pürüzsüz görünsün
    1,
    -Math.PI / 2 - CRESCENT.halfAngle,
    CRESCENT.halfAngle * 2,
  ]
}
