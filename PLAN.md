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

**Kanıt disiplini:** Her denge kararı headless simülasyon taramasıyla
(iyi/orta/kötü bot) ölçülmüş, her görsel/etkileşim hatası gerçek tarayıcıda
ekran görüntüsüyle doğrulanmış. Bu disipline devam edin.

## 3. KRİTİK AÇIK — sıradaki öncelik

**Oyun şu an sadece klavyeyle oynanıyor (`useKeyboard.ts` + `useStrikeInput.ts`).
Dokunmatik kontrol yok.** Projenin tüm önermesi "mobilde tek elle oynanabilen
PWA" — bu olmadan ürün tanımlanan ürün değil. Bu, bir sonraki oturumun
**tek önceliği** olmalı:

- Sol alt: sanal joystick (hareket) — `nipplejs` veya custom touch handler
- Sağ alt: dokun = nişan yönü + vuruş tetikleme (mevcut SPACE mantığına bağlan)
- `useKeyboard`/`useStrikeInput` ile aynı arayüzü paylaşan bir `useTouchControls`
  hook'u yazılmalı ki `GameDirector` iki girdi kaynağını da şeffaf kullansın
- Masaüstünde klavye, dokunmatik cihazda joystick — otomatik algılama

## 4. Sonraki öncelikler (P0 sonrası sıra)

| Öncelik | İş | Not |
|---|---|---|
| P0 | Dokunmatik kontrol | §3, bkz. yukarı |
| P0 | PWA gerçek cihaz doğrulaması | `public/`'ta sadece favicon.svg + icons.svg var, 192/512 PNG manifest ikonu yok. Ana ekrana ekleme hiç test edilmedi. |
| P1 | Post-processing / atmosfer | Bloom, ACES tone mapping, toz. Ucuz + yüksek etki — tasarım felsefesinin özü. |
| P2 | Gerçek Metehan modeli | `src/characters/metehan/` hâlâ boş. Asset dışarıdan gelmeli (Meshy/Tripo + Mixamo) — Claude 3D model üretemez. |
| P2 | Mobil performans denetimi | Dokunmatik kontrol bittikten sonra gerçek orta seviye telefonda FPS/draw-call ölçümü. |

## 5. Teknoloji Yığını (gerçek, package.json'dan)

```
Vite 8 + React 19 + TypeScript
@react-three/fiber 9 + @react-three/drei 10
three r185
zustand 5
vite-plugin-pwa 1
oxlint (lint)
```

## 6. Mimari Notlar

- Simülasyon Zustand dışında tutuluyor (`src/sim/world.ts`) — 60Hz React
  re-render'ı önlemek için. HUD'a ~12Hz throttle ile özet aktarılıyor.
- `src/mechanics/` — oyun mantığı (enemySim, hilalSystem, combat, waves, types)
- `src/sim/` — dünya durumu + skor kalıcılığı
- `src/components/` — R3F sahne bileşenleri + Renderer (manuel çizim, çünkü
  useFrame priority render'ı devralıyor)
- `src/hooks/` — girdi (şu an sadece klavye)
- Karakter mesh'i geldiğinde: `src/characters/metehan/`

## 7. Token Stratejisi / Model Yönlendirme

- Rutin iş (UI, hook'lar, scaffold) → Sonnet 5
- Karmaşık oyun mantığı / denge / gerçek blocker → Opus 4.8
- Her fazdan sonra headless doğrulama + gerçek tarayıcı ekran görüntüsü
  şart — bu proje bu disiplinle kazandı, gevşetmeyin.
- Her faz sonunda commit + push. PLAN.md'yi güncel tutun — v1 unutulup
  gitti, bir daha olmasın.

---

*Bu dosya 20 Temmuz 2026'da, repoda hiç PLAN.md olmadığı fark edilince
gerçek commit geçmişinden yeniden oluşturuldu.*
