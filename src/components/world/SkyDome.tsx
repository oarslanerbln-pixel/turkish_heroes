import { useEffect, useMemo } from 'react'
import { BackSide, ShaderMaterial, SphereGeometry } from 'three'
import type { SkyUniforms } from './skyUniforms'

// Gökyüzü: ufuktan tepeye renk geçişi, güneş diski ve çevresindeki parıltı.
//
// Taktik kamera 45° aşağı baktığı için oyun sırasında gökyüzü görünmez;
// savaş açılışında ve gün batımında kamera alçalınca görünür (FollowCamera).
// Ufuk rengi sisle aynı: uzak arazi gökyüzüne dikişsiz karışsın. Doku dosyası
// yok — PWA çevrimdışı çalışsın.

// w = 0 ile yalnızca kameranın dönüşü uygulanır: kubbe hep kameranın
// merkezinde, sonsuz uzakta. z = w derinliği uzak düzleme sabitler; önündeki
// her şey onu örter.
const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 view = viewMatrix * vec4(position, 0.0);
  gl_Position = projectionMatrix * vec4(view.xyz, 1.0);
  gl_Position.z = gl_Position.w;
}
`

const fragmentShader = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 dir = normalize(vDir);
  // Ufkun altı sis rengi: arazinin bittiği yerde boşluk görünmesin.
  float up = max(dir.y, 0.0);
  vec3 color = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.55, up), 0.6));
  float toSun = max(dot(dir, uSunDir), 0.0);
  // Geniş sıcak parıltı + keskin disk.
  color += uSunColor * (pow(toSun, 10.0) * 0.45 + smoothstep(0.9993, 0.9996, toSun) * 2.5);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function SkyDome({ uniforms }: { uniforms: SkyUniforms }) {
  const geometry = useMemo(() => new SphereGeometry(10, 32, 16), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        side: BackSide,
        depthWrite: false,
      }),
    [uniforms],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  // Kubbe kameraya göre çiziliyor; sınır küresi dünya konumunu bilmez.
  // Opaklardan sonra çizilir: taktik kamerada ekranın tamamı arazi, derinlik
  // testi her pikseli eler — görünmeyen gökyüzü için gölgelendirici çalışmaz.
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />
}
