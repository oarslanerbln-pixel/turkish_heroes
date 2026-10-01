import { useState } from 'react'
import { getConsent, remoteConfigured, setConsent, type Consent } from '../telemetry/remote'

/**
 * Veri paylaşımı rızası, sonuç ekranında: soru, verinin ne olduğu en açık
 * anda — az önce biten savaş. Cevap gelene kadar hiçbir şey gönderilmez (bkz.
 * telemetry/remote.ts); cevaptan sonra tek satır kalır, tek dokunuşla döner.
 */
export function DataConsent() {
  const [consent, setLocal] = useState<Consent>(getConsent)
  if (!remoteConfigured) return null

  const choose = (c: 'yes' | 'no') => {
    setConsent(c)
    setLocal(c)
  }

  if (consent === null) {
    return (
      <div className="consent" role="group" aria-label="Veri paylaşımı">
        <span>
          Dengeyi iyileştirmek için savaşların anonim özeti gönderilsin mi?{' '}
          <a href="/gizlilik.html" target="_blank" rel="noopener">
            Ne gönderiliyor?
          </a>
        </span>
        <button onClick={() => choose('yes')}>EVET</button>
        <button onClick={() => choose('no')}>HAYIR</button>
      </div>
    )
  }
  return (
    <button
      className="consent-toggle"
      aria-pressed={consent === 'yes'}
      onClick={() => choose(consent === 'yes' ? 'no' : 'yes')}
    >
      Anonim savaş verisi: <b>{consent === 'yes' ? 'AÇIK' : 'KAPALI'}</b>
    </button>
  )
}
