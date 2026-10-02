// Savaş özetlerinin uzak kaydı (Supabase, battle_summaries tablosu). İki şart:
// derlemede VITE_TELEMETRY_URL + VITE_TELEMETRY_KEY tanımlı olmalı ve oyuncu
// sonuç ekranında açıkça EVET demiş olmalı. Biri eksikse hiçbir şey gönderilmez; yerel
// kayıt (track.ts) bundan bağımsız sürer. Modül yüklenince sink'i bağlar.
//
// Soru bir savaşın sonunda sorulduğu için EVET o savaşı da kapsar; daha önce
// cevapsız biten savaşları kapsamaz. Geçen açılışta yarıda kalan savaş yalnızca
// rıza zaten varsa, açılışta gider. Bu kurallar değişirse public/gizlilik.html de
// değişmeli.
//
// Anahtar yayımlanabilir (publishable) anahtardır: tabloya yalnızca ekleme
// izni var, okuma yok (bkz. RLS politikası).

import type { BattleSummary } from './summary'
import { abandonedOnLoad, addSink } from './track'
import { PLAYTEST_BUILD } from '../playtest'

const URL = import.meta.env.VITE_TELEMETRY_URL as string | undefined
const KEY = import.meta.env.VITE_TELEMETRY_KEY as string | undefined
const CONSENT_KEY = 'hilal_consent'

export type Consent = 'yes' | 'no' | null

/**
 * Uzak kayıt bu derlemede tanımlı mı; değilse rıza da sorulmaz. Oyun testi
 * derlemesi hiç göndermez: kilidi ve dengeyi değiştiren savaşlar gerçek
 * oyuncuların verisine karışmasın. Geliştirmede anahtarları kendisi tanımlayan
 * gönderebilir; boru hattını denemenin tek yolu bu.
 */
export const remoteConfigured = !!URL && !!KEY && !PLAYTEST_BUILD

let consent: Consent = null
try {
  const v = localStorage.getItem(CONSENT_KEY)
  if (v === 'yes' || v === 'no') consent = v
} catch {
  // Depolama yok: soru her açılışta yeniden sorulur.
}

export function getConsent(): Consent {
  return consent
}

/**
 * Rıza yokken biten son savaş. Soru yalnızca sonuç ekranında çıktığı için EVET
 * geldiğinde bu, ekranı açık olan savaştır; o ekrandaki EVET, savaş bittiğinde
 * rıza 'no' olsa da onu kapsar.
 */
let lastUnsent: BattleSummary | null = null

export function setConsent(c: 'yes' | 'no'): void {
  consent = c
  try {
    localStorage.setItem(CONSENT_KEY, c)
  } catch {
    // Cevap bu oturumla sınırlı kalır.
  }
  if (c === 'yes' && lastUnsent) {
    send(lastUnsent)
    // Aynı ekranda KAPALI → AÇIK savaşı ikinci kez göndermesin.
    lastUnsent = null
  }
}

/** Oyuncunun sınırsız büyütebileceği listelerin üst sınırı (tablo 32 KB'ı reddeder). */
const LIST_CAP = 120

/**
 * Sunucuya giden özet. commander/outcome/stars zaten ayrı sütunlarda;
 * startedAt gitmez, sunucunun created_at'i yeter (cihaz saati cihazda kalır).
 * session sayfa yüklemesi başına rastgeledir, kalıcı bir kimlik değildir:
 * yalnızca aynı oturumdaki denemeleri birbirine bağlar (tavsiye bir sonrakinde
 * işe yaradı mı).
 */
function toPayload(s: BattleSummary): Partial<BattleSummary> {
  const { commander: _c, outcome: _o, stars: _s, startedAt: _t, ...rest } = s
  return {
    ...rest,
    // Vuruş, mola ve emir sayısı oyuncunun elinde; dalga, bozgun ve olaylar senaryoyla sınırlı.
    strikes: s.strikes.slice(0, LIST_CAP),
    pauses: s.pauses.slice(0, LIST_CAP),
    orders: s.orders.slice(0, LIST_CAP),
  }
}

function send(s: BattleSummary): void {
  void fetch(`${URL}/rest/v1/battle_summaries`, {
    method: 'POST',
    // Sonuç ekranından hemen sonra sekme kapansa da istek tamamlansın.
    keepalive: true,
    headers: { apikey: KEY!, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      commander: s.commander,
      outcome: s.outcome,
      stars: s.stars,
      summary: toPayload(s),
    }),
  }).catch(() => {
    // Çevrimdışı ya da sunucu kapalı: özet yerel kayıtta zaten duruyor.
  })
}

if (remoteConfigured) {
  if (consent === 'yes' && abandonedOnLoad) send(abandonedOnLoad)
  addSink((e, s) => {
    if (e.type !== 'battle_end') return
    if (consent === 'yes') send(s)
    else lastUnsent = s
  })
}
