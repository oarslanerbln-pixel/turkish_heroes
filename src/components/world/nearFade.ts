import type { MeshStandardMaterial } from 'three'

// Kameraya yakın nesneyi noktalı (dither) inceltme.
//
// Taktik kamerada ordugah ekranın alt kenarına düşüyor ve HUD'un (hilal
// göstergesi, vuruş düğmesi) arkasını dolduruyordu. Saydamlık yerine piksel
// atlamak: sıralama sorunu yok, gölge de düşmeye devam eder.

/** 1 = inceltme açık; sinematik çekimde kamera kapatır (ordugah kadrajı çerçeveler). */
export const nearFadeStrength = { value: 1 }

/**
 * @param near Bu mesafenin (birim) altında tamamen görünmez.
 * @param far Bu mesafenin üstünde tamamen görünür.
 */
export function applyNearFade(material: MeshStandardMaterial, near: number, far: number): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNearFade = nearFadeStrength
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNearFade;')
      .replace(
        '#include <clipping_planes_fragment>',
        /* glsl */ `#include <clipping_planes_fragment>
  {
    float solid = smoothstep(${near.toFixed(1)}, ${far.toFixed(1)}, length(vViewPosition));
    // Serpiştirilmiş gradyan gürültüsü: düzenli ızgaradan daha az göze batar.
    float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (grain > mix(1.0, solid, uNearFade)) discard;
  }`,
      )
  }
  material.customProgramCacheKey = () => `nearFade:${near}:${far}`
}
