/**
 * Belirlenimci sözde-rastgele üreteç (mulberry32): aynı tohum her seferinde
 * aynı diziyi verir. Dünya süslemesi her yüklemede aynı görünsün, bot
 * testleri de tohumla tekrarlanabilsin diye.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** URL'den tohum: ?seed=1071 oyun testinde her ordu savaşını aynı dizilişle başlatır. */
export function parseSeed(search: string): number | null {
  const value = new URLSearchParams(search).get('seed')
  return value && /^\d{1,10}$/.test(value) ? Number(value) >>> 0 : null
}
