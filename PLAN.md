# HİLAL — Türk Kahramanları 3D Oyunu
### Proje Planı v2 — Gerçek Duruma Göre Güncellendi

> Bu dosya oyunun tek doğruluk kaynağıdır (source of truth). Claude Code'da
> her session'ın başında bunu okut. v1 hiç commit edilmemişti; bu dosya
> gerçekte yapılmış işi ve bundan sonraki öncelikleri belgeliyor.

---

## 1. Vizyon

Türk askeri tarihinin komutanlarını, gerçek tarihi taktiklerini oyun
mekaniğine dönüştürerek oynatan, mobilde çalışan 3D PWA. MVP: Metehan'ın
hilal (kuşatma) taktiği — sahte ricat → disiplin çöküşü → kümelenme → vuruş.

## 2. Durum (16-20 Temmuz 2026 itibarıyla)

**Tamamlanan (commit geçmişinden doğrulanmış):**

| Faz | İş | Durum |
|---|---|---|
| 0 | Scaffold: Vite + R3F + Zustand + vite-plugin-pwa (React 19, Three r185) | ✅ |
| 2 | Hilal çekirdek mekaniği: `enemySim.ts` (disiplin tabanlı sürü AI), `hilalSystem.ts` (kuşatılabilirlik = sıkışıklık × (1-disiplin)) | ✅ |
| 3 | Kayıp koşulu, temas hasarı, denge (headless simülasyonla ölçülmüş: chaseSpeed, energyFillRate) | ✅ |
| 4 | Vuruş artık daire değil hilal şeklinde yay; FollowCamera (OrbitControls kaldırıldı); otomatik nişan; hayatta kalanların disiplini sıfırlanıyor | ✅ |
| — | Bug fix'ler: SPACE'in sessizce iptali, kamera sert geçişi, vuruş reddinde geri bildirim yokluğu, son düşman softlock'u, siyah ekran (R3F priority render) | ✅ |
| 5 | Dalga sistemi (3 dalga: 16→26→38 düşman, can devrediliyor), skor + localStorage rekor | ✅ |
| 6 | Dokunmatik kontrol: sol alt analog joystick (`useTouchControls.tsx`, `useKeyboard` ile simetrik arayüz), sağ altta büyük VUR düğmesi. Nişan zaten otomatikmiş (`calcFacing`), bu yüzden ayrı bir nişan kontrolüne gerek çıkmadı — kapsam buna göre daraltıldı. | ✅ |
| 7 | Post-processing / atmosfer: ACES filmic tone mapping (native `gl.toneMapping`), Bloom (mipmapBlur, threshold 0.55/intensity 0.7), sis + arkaplan aynı ton (#3a2211), Vignette, hafif Noise. `Renderer.tsx` kaldırıldı — `EffectComposer` aynı `renderPriority` yuvasına oturup çizimi devraldı. | ✅ |

**Kanıt disiplini:** Her denge kararı headless simülasyon taramasıyla
(iyi/orta/kötü bot) ölçülmüş, her görsel/etkileşim hatası gerçek tarayıcıda
ekran görüntüsüyle doğrulanmış. Faz 6-7'de de aynı disiplinle devam edildi
(CDP touch event'leriyle joystick sürüklenip oyuncunun hareketi doğrulandı;
bloom önce aşırı değerle teşhis edilip sonra dengeli değere çekildi). Bu
disipline devam edin.

## 3. Sonraki öncelikler

| Öncelik | İş | Not |
|---|---|---|
| P0 | PWA gerçek cihaz doğrulaması | `public/`'ta sadece favicon.svg + icons.svg var, 192/512 PNG manifest ikonu yok. Ana ekrana ekleme hiç test edilmedi. |
| P1 | Mobil performans denetimi | Faz 7'de eklenen bloom/vignette/noise'in gerçek orta seviye telefonda FPS/draw-call maliyeti hiç ölçülmedi — bu artık P2'den P1'e yükseldi çünkü şu an ölçülmemiş bir maliyet var. |
| P2 | Gerçek Metehan modeli | `src/characters/metehan/` hâlâ boş, placeholder capsule kullanılıyor. Asset dışarıdan gelmeli (Meshy/Tripo + Mixamo) — Claude 3D model üretemez. |

## 4. Teknoloji Yığını (gerçek, package.json'dan)

```
Vite 8 + React 19 + TypeScript
@react-three/fiber 9 + @react-three/drei 10
@react-three/postprocessing 3 + postprocessing
three r185
zustand 5
vite-plugin-pwa 1
oxlint (lint)
```

## 5. Mimari Notlar

- Simülasyon Zustand dışında tutuluyor (`src/sim/world.ts`) — 60Hz React
  re-render'ı önlemek için. HUD'a ~12Hz throttle ile özet aktarılıyor.
- `src/mechanics/` — oyun mantığı (enemySim, hilalSystem, combat, waves, types)
- `src/sim/` — dünya durumu + skor kalıcılığı
- `src/components/` — R3F sahne bileşenleri. Çizim `EffectComposer`
  (`renderPriority`) üzerinden; `Renderer.tsx` kaldırıldı, aynı önceliğe
  EffectComposer oturdu. Öncelik sırası: oyuncu 0 → düşman 1 → yönetmen 2 →
  görseller 3 → kamera 5 → sarsıntı 6 → EffectComposer/çizim 10.
- `src/hooks/` — girdi: `useKeyboard` (masaüstü), `useTouchControls.tsx`
  (dokunmatik, aynı ref-tabanlı arayüz), `useStrikeInput` (SPACE)
- Karakter mesh'i geldiğinde: `src/characters/metehan/`

## 6. Token Stratejisi / Model Yönlendirme

- Rutin iş (UI, hook'lar, scaffold) → Sonnet 5
- Karmaşık oyun mantığı / denge / gerçek blocker → Opus 4.8
- Her fazdan sonra headless doğrulama + gerçek tarayıcı ekran görüntüsü
  şart — bu proje bu disiplinle kazandı, gevşetmeyin.
- Her faz sonunda commit + push. PLAN.md'yi güncel tutun — v1 unutulup
  gitti, bir daha olmasın.

---

*Bu dosya 20 Temmuz 2026'da, repoda hiç PLAN.md olmadığı fark edilince
gerçek commit geçmişinden yeniden oluşturuldu. Faz 6-7 (dokunmatik kontrol,
post-processing) tamamlandıktan sonra aynı gün içinde güncellendi.*
