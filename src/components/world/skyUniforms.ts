import { Color, Vector3 } from 'three'

/** Gökyüzü kubbesinin (SkyDome) renkleri; DayCycle her saat değişiminde yazar. */
export interface SkyUniforms {
  [name: string]: { value: Color | Vector3 }
  uZenith: { value: Color }
  /** Sis rengiyle aynı tutulur (DayCycle). */
  uHorizon: { value: Color }
  uSunColor: { value: Color }
  /** Güneş diskinin yönü (birim vektör). */
  uSunDir: { value: Vector3 }
}

export function createSkyUniforms(): SkyUniforms {
  return {
    uZenith: { value: new Color() },
    uHorizon: { value: new Color() },
    uSunColor: { value: new Color() },
    uSunDir: { value: new Vector3(0, 1, 0) },
  }
}
