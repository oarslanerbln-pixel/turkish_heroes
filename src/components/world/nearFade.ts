import { type Material, MeshDepthMaterial, RGBADepthPacking, Vector3 } from 'three'

// Kameraya yakın nesneyi noktalı (dither) inceltme.
//
// Taktik kamerada ordugah ekranın alt kenarına düşüyor ve HUD'un (hilal
// göstergesi, vuruş düğmesi) arkasını dolduruyordu. Saydamlık yerine piksel
// atlamak: sıralama sorunu yok. Gölge de aynı ölçütle incelir: yalnız ana
// çizim incelince görünmeyen otağın gölgesi zeminde koyu bir leke bırakıyordu.
//
// Mesafe pikselin değil yapının: çadır ya da atlı bütün olarak incelir. Piksel
// başına ölçünce otağın yakın yarısı kayboluyor, uzak yarısı noktalı kalıyordu.

/** 1 = inceltme açık; sinematik çekimde kamera kapatır (ordugah kadrajı çerçeveler). */
export const nearFadeStrength = { value: 1 }
/** Ana kameranın dünya konumu (FollowCamera yazar): gölge pasosu da ona göre ölçer. */
export const nearFadeEye = { value: new Vector3() }

/**
 * @param near Bu mesafenin (birim) altında tamamen görünmez.
 * @param far Bu mesafenin üstünde tamamen görünür.
 * @param anchored Mesafe `fadeAnchor` köşe niteliğinden (birleşik geometride
 *   parçanın çapası); yoksa nesnenin ya da örneğin kökünden.
 */
export function applyNearFade(material: Material, near: number, far: number, anchored = false): void {
  if (anchored) material.defines = { ...material.defines, NEAR_FADE_ANCHOR: '' }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNearFade = nearFadeStrength
    shader.uniforms.uNearFadeEye = nearFadeEye
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
varying vec3 vNearFadeWorld;
#ifdef NEAR_FADE_ANCHOR
  attribute vec3 fadeAnchor;
#endif`,
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
  {
    #ifdef NEAR_FADE_ANCHOR
      vec4 anchor = vec4(fadeAnchor, 1.0);
    #else
      vec4 anchor = vec4(0.0, 0.0, 0.0, 1.0);
    #endif
    #ifdef USE_INSTANCING
      anchor = instanceMatrix * anchor;
    #endif
    vNearFadeWorld = (modelMatrix * anchor).xyz;
  }`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform float uNearFade;
uniform vec3 uNearFadeEye;
varying vec3 vNearFadeWorld;`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        /* glsl */ `#include <clipping_planes_fragment>
  {
    float solid = smoothstep(${near.toFixed(1)}, ${far.toFixed(1)}, distance(vNearFadeWorld, uNearFadeEye));
    // Serpiştirilmiş gradyan gürültüsü: düzenli ızgaradan daha az göze batar.
    // Gölge haritasında da aynı desen; yumuşak gölge süzgeci onu yarı saydam gölgeye çevirir.
    float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (grain > mix(1.0, solid, uNearFade)) discard;
  }`,
      )
  }
  material.customProgramCacheKey = () => `nearFade:${near}:${far}:${anchored}`
}

/** Gölge pasosu için aynı inceltmeyi yapan derinlik malzemesi (mesh.customDepthMaterial). */
export function nearFadeDepthMaterial(near: number, far: number, anchored = false): MeshDepthMaterial {
  const material = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
  applyNearFade(material, near, far, anchored)
  return material
}
