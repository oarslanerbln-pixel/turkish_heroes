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

## 2. Durum (30 Eylül 2026 itibarıyla)

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
| 7 | Post-processing / atmosfer: ~~ACES filmic tone mapping (native `gl.toneMapping`)~~ (faz 9'da ölçüldü: EffectComposer renderer ton eşlemesini kapatıyor, ayar hiç etki etmiyordu — kaldırıldı, görünüm aynı), Bloom (mipmapBlur, threshold 0.55/intensity 0.7), sis + arkaplan aynı ton (#3a2211), Vignette, hafif Noise. `Renderer.tsx` kaldırıldı — `EffectComposer` aynı `renderPriority` yuvasına oturup çizimi devraldı. | ✅ |
| 8 | Cila + sağlamlaştırma: başlangıç ekranı (3 adımda taktik + BAŞLA; simülasyon `world.started` ile donuk bekliyor), HUD sadeleştirme (debug istatistikleri yalnızca dev'de, dokunmatikte can çubuğu/joystick çakışması giderildi, safe-area), dalga bannerı, WebAudio ile sentezlenmiş ses (dosya yok) + sessize alma + titreşim, hilal ikonu ve eksik PWA PNG'leri (192/512/maskable/apple-touch), vendor chunk bölme, vitest (29 test: mekanik + headless denge), şablon artıkları ve lint uyarıları temizlendi. | ✅ |
| 9 | Performans: 3 grafik kademesi (`src/perf/quality.ts`: DPR üst sınırı, MSAA, gölge haritası, bloom, noise) + drei `PerformanceMonitor` ile FPS'e göre otomatik kademe (salınımda 4 değişimden sonra düşükte kilit); dokunmatik ortadan, masaüstü yüksekten başlar. Menü ve sonuç ekranında çizim durur (`frameloop="demand"`). EffectComposer MSAA varsayılanı 8 → kademeye göre 4/2/0; Canvas'ın boşa çalışan MSAA'sı kapatıldı. `calcFacing` 24× hızlandı (300 → 12,5 µs; simülasyon karesi 288 → 34 µs). Gerçek cihaz testi için `?perf` (FPS + kademe) ve `?quality=low\|medium\|high`. | ✅ |
| 10 | Görsel temel ("10 bin €'luk oyun" hissi; tasarım belgesindeki Faz A): low-poly bozkır arazisi (arena düz, dışı tepeler; gürültüyle köşe renkleri), sınırda balbal taşları, rüzgârda salınan çimen (kademeye bağlı, düşükte kapalı), kapsüller yerine at üstünde süvari (dörtnal sallanması, ölünce devrilip gömülme), Metehan'a turkuaz binici + tuğ + zemin halkası, vuruşta 40–70 ms hitstop ve altın kıvılcımlar, dalga arasında 1,5 sn mola (son düşenlerin devrilişi yarıda kalmasın), Cinzel başlık yazı tipi (paketle, çevrimdışı) + Selçuklu yıldızı süslemesi, HUD kontrastı. Hiç harici model/doku yok. | ✅ |
| 11 | İkinci komutan prototipi — Alp Arslan, Malazgirt 1071 (tasarım belgesindeki Faz B). Senaryo katmanı: yönetmen artık komutandan bağımsız, Metehan'ın dalgaları ve Malazgirt aynı arayüzü (`sim/scenarios.ts`) uyguluyor. Ordu dört birlik + imparator (`mechanics/corps.ts`, saf ve testli): taciz birliğin düzenini düşürür ve ilerleyişini yavaşlatır (gündüz tabanı 0,6), dibinde oyalanmak 0,6 sn uyarılı hamleye kışkırtır, gün batımında ordu döner (dönüşün ortasında disiplin 0), yıpranmış artçı çekilir, merkez de yıprandıysa imparator korumasız kalır. Vuruş birliğin yalnızca düzeni bozulmuş kısmını düşürür (bütçe = alive × (1 − disiplin)) ve gündüz tüm orduyu toparlar: hilali akşama saklamak ödüllenir. İmparator esir → ordu teslim, 3 yıldız. Başlangıçta komutan seçimi, gün çizgisi, duyurular, birlik düzen çubukları, ordugah, gün ışığı döngüsü (`DayCycle`), yıldızlı sonuç ekranı, `?tune` canlı ayar paneli, `?commander=alp-arslan`. Bot ölçütleri (`corps.test.ts`): pasif kaybeder; güvenli tacizci 1 yıldız + can %100; kışkırtıcı 8 tohumun 6'sında 3 yıldız; açgözlü < kışkırtıcı; simülasyon karesi < 100 µs. | ✅ prototip |
| 12 | Malazgirt dikey kesiti (belgedeki Faz C, ilk dilim): oyuncu başına bir kez gösterilen bağlamsal ipuçları (ilk taciz, ilk hamle, ilk gün batımı; `sim/progress.ts`), ilk savaşta hamle hasarı yarıya, ilk hamlede ve her gün batımında kısa ağır çekim (`world.slowmo`, `simDelta` üzerinden), duyuru kuyruğu (gün batımında üç duyuru üst üste yazılıyordu), hamle kaması (uyarıdaki askerden oyuncuya kırmızı zemin kaması), ok yağmuru (taciz şiddetiyle orantılı, kademeye bağlı), yeni sesler (ok vızıltısı, imparator borusu), komutan kilidi (Alp Arslan, Metehan zaferiyle açılır; prototipte oynamış olanın kilidi kapanmaz; `?commander` atlar). | ✅ |
| 13 | Faz C, ikinci dilim — bozkır havası: dörtnal süvarilerin ardında toz bulutu (hızla orantılı, oyuncu ve tüm düşmanlar; kademeye bağlı, düşükte kapalı), bozkır rüzgârı (tek esinti fonksiyonu `world/wind.ts` çimeni, tozu ve sesi birlikte sürer: esinti cephesi rüzgâr yönünde ilerler, çimen eğilir, sert esintide yerde toz perdesi kalkar), ambiyans (rüzgâr uğultusu + ıslık, savaşla başlayan drone + kös; kös hilal enerjisiyle 1,5 → 0,75 sn'ye hızlanır, gerilimde ara vuruş), vuruşta müzik ve rüzgâr kısılır (düşen payıyla daha derin) ve ~0,5 sn'de geri gelir, sekme gizlenince ses askıya alınır. Node 25'te kırılan `progress.test.ts` düzeldi: rekor okuma/yazma erişilemeyen `localStorage`'a (gizli sekme) dayanıklı. | ✅ |
| 14 | Olay takibi (yerel, bağımlılıksız): savaş başına tek özet — sonuç ve yenilgi nedeni (can / ordugah), oyun süresi, vuruş başına düşen (ve o an sahadaki), ret sayıları (neden başına), dalga temizlenme anları, Malazgirt olayları (taciz, hamle, gün batımı…), komutan başına kaçıncı deneme (Kapı B'nin "ikinci kez oynadı mı" sorusu). Özetler localStorage'da (son 40); savaş sürerken sayfa kapanırsa sonraki açılışta "yarıda bırakıldı" sayılır. `?telemetry` ayıklamayı kalıcı açar: olaylar konsola, sonuç ekranında VERİYİ KOPYALA düğmesi (telefondaki testin verisi panoya). Uzak servis `addSink` ile bağlanır. Aynı gün: production adresi faz 0'daydı (Vercel production dalı eski; tüm deploy'lar giriş korumalı Preview'a gidiyordu) — son sürüm production'a alındı. | ✅ |

**Kanıt disiplini:** Her denge kararı headless simülasyon taramasıyla
(iyi/orta/kötü bot) ölçülmüş, her görsel/etkileşim hatası gerçek tarayıcıda
ekran görüntüsüyle doğrulanmış. Faz 6-7'de de aynı disiplinle devam edildi
(CDP touch event'leriyle joystick sürüklenip oyuncunun hareketi doğrulandı;
bloom önce aşırı değerle teşhis edilip sonra dengeli değere çekildi). Bu
disipline devam edin.

## 3. Sonraki öncelikler

| Öncelik | İş | Not |
|---|---|---|
| P0 | Vercel production dalı | turkish-heroes.vercel.app 30 Eylül'e kadar faz 0'ı sunuyordu; `vercel promote` ile 04eed60'a alındı ama kalıcı çözüm değil. Vercel → Settings → Environments → Production → Branch Tracking: `claude/hilal-game-mvp-hp0ge5`. Yapılmazsa her merge'den sonra `vercel promote <preview-url>` gerekir. |
| P0 | PWA gerçek cihaz doğrulaması | Manifest ikonları faz 8'de eklendi (önceden manifest var olmayan PNG'lere işaret ediyordu). Ana ekrana ekleme ve sesin iOS'ta açılması hâlâ gerçek cihazda test edilmedi. |
| P1 | Gerçek telefonda performans ölçümü | Faz 9'da uyarlamalı kalite ve ölçüm araçları geldi; ölçümler SwiftShader (yazılım GPU) vekiliyle yapıldı — sıralama güvenilir, mutlak değerler değil. Orta seviye bir Android'de `?perf` ile FPS'e ve yerleşilen kademeye bakın; gerekirse `QUALITY` eşiklerini ayarlayın. 120 Hz ekranlarda 60 FPS sınırı ancak ısınma görülürse eklenmeli (90 Hz'de takılma yaratır). |
| P0 | Alp Arslan oyun testi (Kapı B) | Tasarım belgesi: https://claude.ai/code/artifact/3cfcab6d-1bf9-4b66-819f-82c771cbb291. Kapı: prototipi gönüllü olarak ikinci kez oynamak istiyor musun? "Metehan'ın aynısı" deniyorsa hamle ve akşam dönüşü güçlendirilir ya da II. Kılıçarslan'a geçilir. Dengeyi `?tune` ile oynarken ayarlayın; kalıcı değer `corps.test.ts`'ten geçmeli. Faz C'nin görsel/işitsel dilimleri faz 12–13'te geldi; kalan: gerçek cihazda oyun testi (ambiyansın gerçek hoparlörde dinlenmesi ve iOS'ta arka plandan dönünce sesin sürmesi dahil). |
| P2 | Gerçek Metehan modeli | Faz 10'da ilkel şekillerden süvari geldi (`src/characters/riderGeometry.ts`); gerçek model hâlâ dışarıdan gelmeli (Meshy/Tripo + Mixamo; ya da Hugging Face connector'ı üzerinden Hunyuan3D/TRELLIS gibi Space'ler — iskelet/animasyon için yine Mixamo). |
| P2 | Oyuncu verisiyle denge | Olay takibi faz 14'te yerel olarak geldi. Kalan: uzak servis (PostHog; `addSink` + `VITE_` ortam değişkeninde anahtar, istemci SDK'sız HTTP yakalama yeterli) ve oyuncu izni / KVKK metni. Soft launch öncesi şart. O zamana kadar oyun testinin verisi `?telemetry` → VERİYİ KOPYALA ile alınır. |

**Önerilen araçlar (araştırıldı, faz 9):** Hugging Face (3D/görsel üretim
Space'leri), Splice (telifsiz ses/müzik örnekleri), PostHog (oynanış
analitiği), Sentry (gerçek cihaz hataları, WebGL bağlam kaybı), Figma (kurulu,
yeniden bağlanmalı — HUD/menü tasarımı). Skill'ler: `mobile-game-dev`,
`psikoloji-bilimleri` (akış/motivasyon), Anthropic `design` eklentisi.

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
- `src/mechanics/` — oyun mantığı (enemySim, hilalSystem, combat, waves, corps, scenario, types)
- `src/sim/` — dünya durumu + skor kalıcılığı
- `src/components/` — R3F sahne bileşenleri. Çizim `EffectComposer`
  (`renderPriority`) üzerinden; `Renderer.tsx` kaldırıldı, aynı önceliğe
  EffectComposer oturdu. Öncelik sırası: oyuncu 0 → düşman 1 → yönetmen 2 →
  görseller 3 → kamera 5 → sarsıntı 6 → EffectComposer/çizim 10.
- `src/hooks/` — girdi: `useKeyboard` (masaüstü), `useTouchControls.ts`
  (dokunmatik, aynı ref-tabanlı arayüz; bileşeni `components/TouchJoystick.tsx`),
  `useStrikeInput` (Space vuruş, menülerde Space/Enter)
- `src/audio/sfx.ts` — sentezlenmiş efektler. AudioContext BAŞLA tıklamasında
  açılır (tarayıcı kuralı); efektler GameDirector'dan tetiklenir. Sekme
  gizlenince context askıya alınır.
- `src/audio/ambience.ts` — rüzgâr + müzik ayrı bir veriyolunda (bus → duck →
  master); `duck()` yalnızca onu kısar, vuruş efekti tam duyulur. Kös ses
  saatine göre planlanır (100 ms'lik zamanlayıcı, 0,3 sn ileri bakış), kare
  hızından bağımsız. `setBattleMusic` her kare yönetmenden; müziği savaş
  durumu açar/kapatır.
- Rüzgâr (`world/wind.ts`): `windGust(t, x, z)` JS'te, `GUST_GLSL` aynı
  sabitlerden üretilen GLSL eşi — çimen shader'ı, `DustTrails` ve `SteppeWind`
  (sesi ~10 Hz'de besler) aynı esintiyi görür. Sabit değişirse ikisi birlikte
  değişir; testli.
- `DustTrails`: tek örneklenmiş mesh (+1 draw call), 512'lik havuz, yumuşak
  alfa dokulu düzlemler; bulutlar kameraya, perdeler yere bakar. Düşük
  kademede bileşen hiç kurulmaz.
- HUD: `HilalEnergyHUD` + `StartScreen` + `OutcomeScreen`, stil `hud.css`.
- Testler: `src/mechanics/*.test.ts`, `src/perf/*.test.ts` (`npm test`).
  `balance.test.ts` mekaniğin iki sözünü sabitler: durmak enerji vermez,
  kiting kuşatmayı kurar.
- Performans (`src/perf/quality.ts`): sahne hafif (~29 draw call); maliyet
  piksel doldurmada. Kademeler yalnızca DPR/MSAA/gölge/bloom/noise çevirir.
  MSAA oturum boyunca sabit (EffectComposer'ı yeniden kurdurmak eskisini
  dispose etmiyor). DPR değişince composer tamponları kendiliğinden küçülüyor
  (Canvas yeniden render → R3F boyutu yeniden yazıyor; ölçüldü). Ton eşlemesi
  yok (renderer'dakini EffectComposer kapatıyor); gerçek ACES istenirse efekt
  zincirine `<ToneMapping>` eklenmeli — görünümü değiştirir, sanat kararı.
- Kare ölçümü: `?perf` ile üretimde FPS paneli; `__world`/`__gl`/`__scene` yalnızca dev.
- Dünya (`src/components/world/`): `terrainShape.ts` saf fonksiyonlar (yükseklik,
  renk, gürültü; testli — arena r ≤ 34'te yükseklik tam sıfır, birimler y = 0'da
  yürür). Arazi ızgarası ve çimen sayısı kademeye bağlı. Gökyüzü yok: kamera 45°
  aşağı bakıyor, ufuk görünmüyor; derinliği sis veriyor.
- Süvari (`src/characters/riderGeometry.ts`): ilkel şekiller köşe rengiyle
  boyanıp birleştiriliyor. Düşmanda at ve binici iki örneklenmiş mesh (aynı
  matris); binicinin beyaz parçaları disiplin rengini `instanceColor` ile alır.
- Hitstop: `world.hitstop` > 0 iken `simDelta()` sıfır döner; oyuncu, düşman,
  yönetmen ve kıvılcımlar aynı kuralı kullanır. Düşenlerin konumu
  `world.fxKills` ile efekte aktarılır (`executeStrike`'ın isteğe bağlı parametresi).
- Faz 10 maliyeti (SwiftShader vekili, telefon 844×390): yüksek 683 → 960 ms,
  orta 417 → 513 ms, düşük 63 → 77 ms/kare. Gerçek GPU'da köşe maliyeti çok daha
  düşük olmalı; `?perf` ile doğrulanmalı.
- Senaryolar (faz 11): `mechanics/scenario.ts` komutan tanımları ve örnekleme
  kapasitesi (tüm senaryoların en kalabalığı); `sim/scenarios.ts` `Scenario`
  arayüzü (düşman hareketi, kuşatılabilirlik, düşme filtresi, vuruş sonrası,
  akış, sonuç, zafer bonusu). Yönetmen ortak döngüyü yürütür, senaryo
  kurallarını sorar. `world.commander` + `world.battle` (Malazgirt durumu).
  Rekor komutan başına (`hilal_best_score` Metehan için korundu).
- Malazgirt (`mechanics/corps.ts`): `stepBattle` saf; olaylar `battle.events`
  ile yönetmene (duyuru + ses). Asker görevi (düzen / uyarı / hamle)
  `battle.mode` dizisinde. Kuşatılabilirlik en savunmasız birlikten
  (`calcSiegeState`'in birlik alt kümesi). `executeStrike`/`countInCrescent`
  isteğe bağlı `FallFilter` alır (Malazgirt'te birlik bütçesi); korunan
  (`guarded`) asker yaya kapılmaz ve nişanı çekmez. Arena geometrisi
  değişmedi (r 29): ordu 28 birim yürür (−14 → ordugah 14).
- Bot döngüsü `mechanics/battleBots.ts` (yönetmenin savaş kolunu izler;
  oyun kodu içe aktarmaz). Botların hareketi hedefe çekim + başka
  birliklerden itilme; hamleden kaçış tehditlerin tam tersine.
- Faz 11 maliyeti (SwiftShader, telefon): Malazgirt orta 471 ms (Metehan
  411), düşük 78 ms (70); draw call 34 → 48 (düzen çubukları + ordugah).
- Olay takibi (`src/telemetry/`): `summary.ts` saf (olay türleri + özete işleme, testli), `track.ts` çalışma zamanı. Olaylar yönetmenden (savaş başı/sonu, vuruş, ret) ve senaryolardan (dalga temizlendi, savaş olayları) gelir. Savaş başlangıcı ayrı bir çağrı değil: yönetmen oyun sürerken etkin savaş yoksa açar. Saat gerçek zamanlı ve yönetmenin 0,1 sn'lik kare sınırını kullanır (hitstop/ağır çekimden etkilenmez, sekme gizliyken işlemez). Veri cihazdan çıkmaz.
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
