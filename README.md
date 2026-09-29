# HİLAL

Metehan'ın hilal (kuşatma) taktiğini oynatan, tarayıcıda ve telefonda çalışan
3D taktik oyunu. Kurulabilir bir PWA'dır ve çevrimdışı da çalışır.

**Taktik:** Kaçıyormuş gibi yap → peşine düşen düşmanın düzeni bozulur →
düzensiz küme sıkışır → hilal enerjisi dolar → yayı kapat.

## Kontroller

| | Masaüstü | Dokunmatik |
|---|---|---|
| Hareket | WASD / oklar | Sol alttaki joystick |
| Vuruş | Space | Sağ alttaki düğme |
| Başla / Yeniden | Space veya Enter / Enter | Ekrandaki düğme |

## Geliştirme

```bash
npm install
npm run dev      # geliştirme sunucusu (FPS paneli ve denge verisi açık)
npm test         # mekanik + headless denge testleri
npm run lint
npm run build    # tip kontrolü + üretim derlemesi (dist/)
npm run preview  # üretim derlemesini yerelde sun
```

Mimari, fazların durumu ve sonraki adımlar için: [PLAN.md](./PLAN.md).
