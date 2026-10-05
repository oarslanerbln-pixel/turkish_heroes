# HİLAL

Türk komutanlarının hilal (kuşatma) taktiğini oynatan, tarayıcıda ve telefonda
çalışan 3D taktik oyunu: Metehan (MÖ 209), Alp Arslan — Malazgirt (1071),
II. Kılıçarslan — Miryokefalon (1176). Kurulabilir bir PWA'dır ve çevrimdışı da çalışır.

**Taktik:** Kaçıyormuş gibi yap → peşine düşen düşmanın düzeni bozulur →
düzensiz küme sıkışır → hilal enerjisi dolar → yayı kapat.

## Kontroller

| | Masaüstü | Dokunmatik |
|---|---|---|
| Hareket | WASD / oklar | Sol alttaki joystick |
| Vuruş | Space | Sağ alttaki düğme |
| Kol emri (Malazgirt: pusu → taciz → hücum) | Q sol kol / E sağ kol | Vuruş düğmesinin üstündeki düğmeler |
| Yolu kes (Miryokefalon, savaş başına bir kez) | R | Kol düğmelerinin üstündeki KAYA YIĞINI |
| Başla / Yeniden | Space veya Enter / Enter | Ekrandaki düğme |
| Mola / Devam | Esc veya P / Enter | Sağ üstteki düğme |

## Geliştirme

```bash
npm install
npm run dev      # geliştirme sunucusu (FPS paneli ve denge verisi açık)
npm test         # mekanik, headless denge (olasılıksal botlar) ve savaş karnesi testleri
npm run lint
npm run build    # tip kontrolü + üretim derlemesi (dist/)
npm run preview  # üretim derlemesini yerelde sun
```

## Performans testi (gerçek cihaz)

Grafik kalitesi FPS'e göre kendini ayarlar (düşük / orta / yüksek). Telefonda
ölçmek için adrese parametre ekleyin:

- `?perf` — FPS paneli ve o anki kalite kademesi
- `?quality=low` (veya `medium`, `high`) — kademeyi sabitler, uyarlamayı kapatır
- `?telemetry` — oynanış kaydını görünür yapar (kalıcı; `?telemetry=0` kapatır):
  sonuç ekranındaki VERİYİ KOPYALA savaş özetlerini panoya alır. Veri cihazdan çıkmaz.

Mimari, fazların durumu ve sonraki adımlar için: [PLAN.md](./PLAN.md).
Önerilen tasarım maddeleri (mantık, eğlence, klas, grafik) için: [TASARIM.md](./TASARIM.md).
