import { DataTexture, LinearFilter, MeshBasicMaterial, type Object3D, PlaneGeometry } from 'three'

// Temas gölgesi: her atlının altında yumuşak, koyu bir leke.
//
// Güneş gölgesi öğlende atın yanına, gün batımında metrelerce öteye düşer;
// toynakların altı aydınlık kalınca süvari zeminde süzülüyor gibi duruyordu.
// Leke atlıyı yere basar. Her birlik tek örnekli (instanced) çizim; geometri,
// malzeme ve doku bütün birliklerde ortak, hiç atılmaz (birkaç kB).

/** Atlı lekesinin eni ve boyu (birim): at 0,5 × 1,25, baş öne uzanır. */
const WIDTH = 1.15
const LENGTH = 2.2
/** Lekenin merkezi gövdeden biraz öne: boyun ve baş da gölge yapar. */
const FORWARD = 0.12
/** Zeminin hemen üstü; polygonOffset ile birlikte titreşmez. */
const LIFT = 0.03
const OPACITY = 0.42
const TEXTURE_SIZE = 32

let geometry: PlaneGeometry | null = null
let material: MeshBasicMaterial | null = null

export function contactShadowGeometry(): PlaneGeometry {
  if (!geometry) {
    geometry = new PlaneGeometry(1, 1)
    geometry.rotateX(-Math.PI / 2)
    geometry.translate(0, LIFT, FORWARD)
  }
  return geometry
}

export function contactShadowMaterial(): MeshBasicMaterial {
  if (!material) {
    material = new MeshBasicMaterial({
      color: 0x000000,
      alphaMap: falloffTexture(),
      transparent: true,
      opacity: OPACITY,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    })
  }
  return material
}

/** Tek atlının lekesi için ölçek (örnekli olmayan çizim). */
export const CONTACT_SHADOW_SCALE: [number, number, number] = [WIDTH, 1, LENGTH]
/** Saydam çizimler arasında önce: toz, ok ve oyuncu halkası lekenin üstüne düşer. */
export const CONTACT_SHADOW_ORDER = -1

/**
 * Lekeyi atlının altına yerleştirir (`target.matrix` yazılır).
 * @param y Zemin yüksekliği: dörtnal zıplaması değil.
 * @param size 1 = tam leke; düşen asker gömülürken küçülür.
 */
export function placeContactShadow(target: Object3D, x: number, y: number, z: number, heading: number, size = 1): void {
  target.position.set(x, y, z)
  target.rotation.set(0, heading, 0)
  target.scale.set(WIDTH * size, 1, LENGTH * size)
  target.updateMatrix()
}

/** Merkezde koyu, kenara doğru sıfıra inen yuvarlak düşüş (alphaMap yeşil kanalı okur). */
function falloffTexture(): DataTexture {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  for (let j = 0; j < TEXTURE_SIZE; j++) {
    for (let i = 0; i < TEXTURE_SIZE; i++) {
      const u = ((i + 0.5) / TEXTURE_SIZE) * 2 - 1
      const v = ((j + 0.5) / TEXTURE_SIZE) * 2 - 1
      const fade = Math.max(0, 1 - (u * u + v * v))
      const k = (j * TEXTURE_SIZE + i) * 4
      data[k] = data[k + 1] = data[k + 2] = Math.round(fade * fade * 255)
      data[k + 3] = 255
    }
  }
  const texture = new DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE)
  // DataTexture varsayılanı en yakın piksel: leke basamaklı görünürdü.
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}
