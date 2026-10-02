// Oyun testi anahtarları (?tune, ?commander=) dengeyi ve kilidi değiştirir; yalnız
// geliştirmede ve `npm run build:playtest` derlemesinde okunur. Ortam değişkeni
// yerine derleme modu: üretim, promote edilen önizlemeden çıktığı için
// önizlemeye konan bir değişken üretime de taşınırdı; Vercel'in derlemesi ise
// her zaman 'production' modundadır.
//
// ?perf, ?quality ve ?telemetry üretimde açık kalır: oyunu değiştirmezler ve
// gerçek telefonda ölçüm için gerekirler.

/** `vite build --mode playtest` ile kurulmuş, dağıtılabilir oyun testi derlemesi. */
export const PLAYTEST_BUILD = import.meta.env.MODE === 'playtest'

export const PLAYTEST = import.meta.env.DEV || PLAYTEST_BUILD
