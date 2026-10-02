import { useEffect } from 'react'
import { Ornament } from './Ornament'
import { CrescentIcon } from './icons'
import './hud.css'

export type CrashKind = 'crash' | 'gpu'

const TEXT: Record<CrashKind, { title: string; body: string }> = {
  crash: {
    title: 'BİR HATA OLDU',
    body: 'Oyun beklenmedik bir hatayla durdu. Yeniden yükleyince komutan seçimine dönersin; yıldızların ve açtığın komutanlar kayıtlı.',
  },
  gpu: {
    title: 'GÖRÜNTÜ KESİLDİ',
    body: 'Cihaz grafik belleğini geri aldı; savaş molada bekliyor. Görüntü birkaç saniyede kendiliğinden dönebilir. Dönmezse yeniden yükle: bu savaş yarıda kalır, yıldızların kayıtlı.',
  },
}

/**
 * Çökme ya da grafik bağlamı kaybı: oyuncu boş ekran yerine ne olduğunu ve
 * ne yapacağını görür. Açıkken oyunun klavye kısayolları susar (Esc molayı
 * kapatıp görüntüsüz savaşı sürdürmesin); odaktaki düğme yine çalışır.
 */
export function CrashScreen({ kind }: { kind: CrashKind }) {
  useEffect(() => {
    const swallow = (e: KeyboardEvent) => e.stopPropagation()
    window.addEventListener('keydown', swallow, true)
    return () => window.removeEventListener('keydown', swallow, true)
  }, [])

  const t = TEXT[kind]
  return (
    <div className="hud">
      <div className="screen is-crash" role="alertdialog" aria-labelledby="crash-title">
        <section className="pause-panel velvet">
          <div className="crest" aria-hidden="true">
            <CrescentIcon size={30} />
          </div>
          <div className="result-title is-defeat" id="crash-title">
            {t.title}
          </div>
          <Ornament width={220} />
          <p className="crash-text">{t.body}</p>
          <button className="primary-btn" onClick={() => window.location.reload()} autoFocus>
            YENİDEN YÜKLE
          </button>
        </section>
      </div>
    </div>
  )
}
