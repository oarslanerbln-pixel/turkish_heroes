import { Color, InstancedBufferAttribute, type BufferGeometry, type Material, Vector3 } from 'three'

// Atlıların ortak ışık eki: güneş yönünden kenar ışığı ve vuruş parlaması.
//
// Kenar ışığı: siluetin güneşe dönük kenarı ışığın rengiyle parlar. Gün
// batımında güneş Bizans ordusunun ardında; ordu kızıl ufka karşı koyu bir
// kütleye dönüşüyordu, kenar ışığı her atlıyı zeminden ayırır. Gölgeye
// bakmaz: gerçek ışık değil, okunurluk için bir süs.
//
// Vuruş parlaması: düşen asker bir an beyaza döner. Kan yok; vuruşun
// "değdi" duygusu ışıktan gelir.

/** DayCycle gün saatiyle yazar. */
export const rimLight = {
  /** Güneşe doğru birim vektör (dünya). */
  uRimDir: { value: new Vector3(0, 1, 0) },
  /** Işık rengi × kenar gücü. */
  uRimColor: { value: new Color(0, 0, 0) },
}

/** Parlamanın süresi (sn, gerçek zaman: hitstop'ta da söner). */
export const FLASH_TIME = 0.08
/** Ton eşlemesinden sonra beyaz okunsun, bloom hafifçe tutsun. */
const FLASH_WHITE = 1.8

/**
 * Malzemeye kenar ışığı ekler; varsa önceki eki (nearFade) korur.
 * @param flash Örnek başına `aFlash` niteliği (0–1) okunur; bkz. flashAttribute.
 */
export function applyUnitShading(material: Material, flash = false): void {
  if (flash) material.defines = { ...material.defines, UNIT_FLASH: '' }
  const previous = material.onBeforeCompile
  const previousKey = material.customProgramCacheKey.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer)
    shader.uniforms.uRimDir = rimLight.uRimDir
    shader.uniforms.uRimColor = rimLight.uRimColor
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
#ifdef UNIT_FLASH
  attribute float aFlash;
  varying float vFlash;
#endif`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
#ifdef UNIT_FLASH
  vFlash = aFlash;
#endif`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform vec3 uRimDir;
uniform vec3 uRimColor;
#ifdef UNIT_FLASH
  varying float vFlash;
#endif`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `{
    // Görüşe dik yüzler (siluet) ve güneşe dönük olanlar parlar.
    vec3 toSun = normalize((viewMatrix * vec4(uRimDir, 0.0)).xyz);
    float edge = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
    outgoingLight += uRimColor * (edge * edge * saturate(dot(normal, toSun) + 0.2));
  }
#ifdef UNIT_FLASH
  outgoingLight = mix(outgoingLight, vec3(${FLASH_WHITE.toFixed(1)}), vFlash);
#endif
#include <opaque_fragment>`,
      )
  }
  material.customProgramCacheKey = () => `${previousKey()}|unit:${flash}`
}

/** Atın ve binicinin paylaştığı örnek başına parlama niteliği. */
export function flashAttribute(capacity: number, ...geometries: BufferGeometry[]): InstancedBufferAttribute {
  const attribute = new InstancedBufferAttribute(new Float32Array(capacity), 1)
  for (const g of geometries) g.setAttribute('aFlash', attribute)
  return attribute
}
