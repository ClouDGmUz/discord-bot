# Cleva — Optimizatsiya Auditi

**Sana:** 2026-yil 15-sentyabr
**Qamrov:** `src/` — 65 ta JS fayl, ~10 000 qator
**Stek:** Node.js 24, discord.js v14, Supabase (jsonb), Express, Render.com

Ushbu hujjatda botning ishlash tezligi bo'yicha topilgan barcha kamchiliklar,
ularning qaysilari tuzatilgani va nima qilish qolgani yozilgan.

---

## Umumiy natija

| Holat | Soni |
|---|---|
| ✅ Tuzatildi | 7 ta |
| ⬜ Qoldi | 10 ta |

**Tuzatilgan commitlar:**

| Commit | Nima qilindi |
|---|---|
| `632052e` | B3 + QW1 + QW8 — standart sozlamalar, diskka yozish, reyting hisobi |
| `2bbc069` | B2 — Supabase uchun navbat (write-behind queue) |
| `6f8d21c` | QW2 + QW3 — keraksiz tarmoq so'rovlarini to'xtatish |
| `30b5fa1` | B1 — issiq ma'lumotlarni alohida jadvallarga ajratish |

---

## ✅ TUZATILGAN

### QW1 — Har o'zgarishda butun baza diskka sinxron yozilardi 🔴

**Muammo.** `updateGuildSettings` har chaqirilganda `fs.writeFileSync` orqali
**barcha serverlar** ma'lumotini, chiroyli formatda (`null, 2`), **sinxron**
tarzda diskka yozardi. Bu 46 ta joydan chaqiriladi. Har bir chat xabari uchun
2 marta ishga tushardi (`addXP` + `updateMemberActivity`). 500 a'zoli serverda
bu har safar megabaytlab ma'lumotni qayta yozish va event loop ni to'xtatish
degani edi.

**Yechim.** Dirty-flag + 2 soniyalik kechikish (debounce), asinxron va atomar
yozish (`.tmp` → `rename`). Format ixchamlashtirildi. Yopilishda
(`SIGINT`/`SIGTERM`/`exit`) majburiy saqlash qo'shildi.

**Natija (500 a'zoli server, 2000 ta yangilanish):**

```
Eski:  9964.5 ms   (har yozuv ~4982 mikrosekund, event loop bloklanadi)
Yangi:     1.6 ms   (har yozuv ~1 mikrosekund)
```

`src/config/storage.js` · commit `632052e`

---

### QW2 — Log kanali yo'q bo'lsa ham audit log so'rovlari yuborilardi

**Muammo.** `logMessageDelete` avval 800 ms kutardi va 2 tagacha
`fetchAuditLogs` so'rovi yuborardi — **keyin** `sendLog` ichida log kanali
umuman sozlanmaganini bilardi. Ya'ni log yoqilmagan serverda ham har
o'chirilgan xabar uchun 800 ms + 2 ta REST so'rov behuda ketardi.

**Yechim.** `getLogChannelId()` funksiyasi ajratildi — u faqat sozlamalarni
o'qiydi, tarmoqqa chiqmaydi. `logMessageDelete` shu bilan boshlanadi va kanal
yo'q bo'lsa darhol qaytadi. Log sozlangan holatda so'rovlar soni o'zgarmadi.

`src/utils/logger.js` · commit `6f8d21c`

---

### QW3 — Har ovozli harakatda butun a'zolar ro'yxati tortib olinardi 🔴

**Muammo.** `updateGuildStats` har safar `guild.members.fetch()` (serverdagi
**hamma** a'zo) va `guild.fetch()` chaqirardi. Bu funksiya esa
`voiceStateUpdate` dan **har bir kanal almashuvida** ishga tushardi, ustiga
10 daqiqalik interval va a'zo kirish/chiqishlarida ham. Kanal nomini
o'zgartirish allaqachon 5 daqiqaga cheklangani uchun bu trafikning deyarli
hammasi behuda edi.

**Yechim.**
- Har server uchun 5 daqiqalik to'xtatgich — **tarmoqqa chiqishdan oldin** ishlaydi.
- A'zolar ro'yxati faqat bot/booster/odam hisoblagichi kerak bo'lsa **va** kesh
  to'liq bo'lmasa tortiladi.
- `guild.fetch()` faqat "jami" yoki "onlayn" hisoblagichi sozlangan bo'lsa.

Faqat ovoz hisoblagichi yoqilgan serverda endi **0 ta REST so'rov** ketadi.

`src/utils/statsUpdater.js` · commit `6f8d21c`

---

### QW8 — `/rank` butun jadvalni saralardi

**Muammo.** `getUserLevel` bitta odamning o'rnini bilish uchun serverdagi
barcha foydalanuvchini massivga yig'ib saralar edi — O(n log n).

**Yechim.** Bitta o'tishda (O(n)) sanash, ortiqcha massiv yaratmasdan.
Natija eski usul bilan bir xil ekani testda tekshirildi.

`src/config/storage.js` · commit `632052e`

---

### QW10 — `substr` eskirgan

`addWarn` dagi ID yaratishda `.substr()` ishlatilgandi → `.slice()` ga
almashtirildi.

`src/config/storage.js` · commit `632052e`

---

### B3 — Standart sozlamalar 5 joyda takrorlanardi (va bir joyda xato edi) 🔴

**Muammo.** `getGuildSettings` ichida ~145 qatorlik `if (!x) x = {...}`
"migratsiya narvoni" bor edi va u **har o'qishda** ishga tushardi (har xabar,
har log, har tugma bosilishi). Standart qiymatlar takrorlanardi:

- `activeRole` — **5 marta** yozilgan
- `teamArchive` — **4 marta** yozilgan

Va ular allaqachon bir-biridan farq qila boshlagan edi:

```js
// storage.js:511 — 7 ta kalit
{ fillChannelId, channelId, headRoleId, moderRoleId, pingRoleId, allowPublicView, members }
// storage.js:524 (saveTeamMember) — atigi 4 ta kalit
{ channelId, headRoleId, moderRoleId, members }
```

**Bu haqiqiy xato edi:** agar serverning `teamArchive` bo'limi birinchi marta
`saveTeamMember` orqali yaratilsa, unda `fillChannelId`, `pingRoleId` va
`allowPublicView` umuman bo'lmasdi.

**Yechim.**
- Bitta `DEFAULT_SETTINGS` obyekti — yangi xossa qo'shish uchun faqat shu yer
  tahrirlanadi.
- `applyDefaults()` rekursiv to'ldiradi va **har server uchun bir marta**
  ishlaydi (har o'qishda emas).
- Foydalanuvchi kaliti bilan to'ldiriladigan lug'atlar (`warns`,
  `leveling.users`, `teamArchive.members`, `activeRole.members`) bo'sh `{}`
  deb belgilandi — ichiga kirilmaydi, soxta yozuv qo'shilmaydi.
- Tekshiruv qattiqlashtirildi: eski kod `if (!x)` ishlatardi, yangisi faqat
  `undefined`/`null` ni to'ldiradi — shuning uchun ataylab qo'yilgan
  `false` yoki `0` endi hech qachon standart qiymatga qaytmaydi.

`src/config/storage.js` · commit `632052e`

---

### B2 — Supabase ga yozuvlar "yuborib-unutilardi" 🔴

**Muammo.** Uchta jiddiy kamchilik:

1. `updateGuildSettings` har o'zgarishda `await` siz upsert yuborardi — har
   xabar uchun bitta tarmoq so'rovi.
2. Xatolik bo'lsa faqat `console.warn` chiqardi — ma'lumot keyingi deployda
   yo'qolardi.
3. Eng yomoni:
   ```js
   if (!supabase || !supabaseStatus.connected) return;
   ```
   `connected` faqat `init()` da bir marta o'rnatilardi. Boot paytida bitta
   vaqtinchalik uzilish bo'lsa — **butun jarayon davomida saqlash o'chib
   qolardi**, Render da esa lokal fayl deployda o'chib ketadi.

**Yechim.** Write-behind navbat:
- Kutayotgan server ID lari `Set` da to'planadi, 2 soniyalik kechikish bilan
  yuboriladi. Bir serverga 500 ta o'zgarish → **1 ta** so'rov. Bir nechta
  server → **1 ta** umumiy so'rov.
- Xatolikda qayta navbatga qo'yiladi, kechikish 1s → 2s → ... → 60s gacha
  oshadi.
- Muvaffaqiyatli yozuv holatni tiklaydi — yomon `init()` endi saqlashni
  butunlay o'chirib qo'ymaydi.
- `getSupabaseStatus()` ga `.pending` qo'shildi, `/health` sahifasi buni
  allaqachon ko'rsatadi.
- `SIGINT`/`SIGTERM` da navbat bo'shatiladi (5 soniya, `SUPABASE_DRAIN_MS`).

`updateGuildSettings` sinxron qolgani uchun **hech bir chaqiruvchi kod
o'zgartirilmadi**.

`src/config/storage.js` · commit `2bbc069`

---

### B1 — Hamma narsa bitta jsonb blobda edi 🔴

**Muammo.** Har server uchun bitta qator: `guild_settings(guild_id, data jsonb)`.
Sozlamalar, warnlar, XP, kunlik faollik, team arxivi — hammasi bitta obyektda.
Demak bitta odam XP olsa, **butun server** qayta yozilardi: barcha warnlar,
barcha boshqa a'zolarning darajasi, team arxivi. Bir necha yuz a'zoli serverda
bu har chat xabari uchun katta yuk.

**Yechim.** Issiq (tez-tez o'zgaradigan) bo'limlar alohida jadvallarga
chiqarildi:

| Jadval | Mazmuni |
|---|---|
| `guild_levels` | Har a'zo uchun 1 qator (xp, level, messages) |
| `guild_activity` | Har a'zo uchun 1 qator (kunlik ovoz/xabar hisobi) |
| `guild_warns` | Har ogohlantirish uchun 1 qator |
| `guild_settings` | Faqat sovuq konfiguratsiya |

**Muhim qaror:** xotiradagi shakl **atayin o'zgartirilmadi**. Shuning uchun
o'qish hamon `memoryCache` dan O(1) va **birorta chaqiruvchi kod
o'zgartirilmadi**. Faqat yozish "donadorligi" o'zgardi — endi XP tik bitta
kichik qator yozadi.

**Ko'chirish avtomatik.** `init()` jadvallardan o'qib xotiraga joylaydi,
blobda qolgan eski ma'lumotni navbatga qo'yadi va blobni ularsiz qayta yozadi.
Takroran ishga tushirsa ham xavfsiz (idempotent).

**Jadvallar majburiy emas.** `init()` har birini tekshiradi; README dagi SQL
ishga tushirilmagan bo'lsa, o'sha ma'lumot eski usulda blobda saqlanaveradi va
bot qaysi rejimda ekani konsolda hamda `/health` da ko'rinadi
(`getSupabaseStatus().splitTables`).

> ⚠️ **Yangi qoida.** Issiq ma'lumotni endi faqat storage mutatorlari orqali
> o'zgartirish kerak (`addXP`, `updateMemberActivity`, `addWarn`,
> `removeUserWarn`, `clearUserWarns`). `getGuildSettings()` qaytargan obyektni
> to'g'ridan-to'g'ri o'zgartirish xotirada ishlaydi, lekin **saqlanmaydi**.
> Hozirgi kodda hech qayerda bunday qilinmagan (tekshirildi).

**Kerakli SQL:** README.md, "Supabase Bazasini Ulash" bo'limi, 3-qadam.

`src/config/storage.js`, `README.md` · commit `30b5fa1`

---

## ⬜ QOLGAN ISHLAR

### QW4 — `ephemeral: true` eskirgan (53 ta joy)

discord.js v14.14+ da eskirgan deb belgilangan. Kodning o'zida
`MessageFlags` allaqachon 59 ta joyda ishlatilgan — ya'ni migratsiya yarim
qolgan. Mexanik almashtirish:

```js
{ ephemeral: true }  →  { flags: MessageFlags.Ephemeral }
```

**Qiyinligi:** oson. Ogohlantirishlar konsolni to'ldirishini to'xtatadi.

---

### QW5 — `dynamic: true` eskirgan (30 ta joy)

`displayAvatarURL({ dynamic: true })` — v14 da bu parametr hech narsa
qilmaydi (animatsiya standart holatda yoqilgan). Olib tashlash kerak.

**Qiyinligi:** oson.

---

### QW6 — Issiq funksiyalar ichida `require()`

`interactionCreate.js:69,74,79,84,89` — har tugma bosilganda 5 ta `require`.
`messageCreate.js:134` — har xabarda. `voiceStateUpdate.js:91` — har ovozli
harakatda.

Require keshdan olinadi, shuning uchun arzon, lekin bepul emas — va bu
bog'liqliklar grafigini yashiradi. Ehtimol aylanma bog'liqlikdan qochish uchun
qilingan (`tempVoiceManager.js:343` da ham shunday). Avval o'sha aylanma
bog'liqlikni topib uzish, keyin hammasini fayl boshiga ko'chirish kerak.

**Qiyinligi:** o'rtacha (avval aylanma bog'liqlikni tekshirish kerak).

---

### QW7 — `messageCreate` da ruxsatlar 2 marta hisoblanadi

`messageCreate.js:18` va `:55` — bir xil `isOwner` / `isStaff` hisobi, shu
jumladan `process.env.OWNER_ID.trim()` har xabarda 2 marta.

**Yechim:** bir marta hisoblash, `OWNER_ID` ni modul yuklanganda keshlash.

**Qiyinligi:** oson.

---

### QW9 — Intervallar bir vaqtda hamma serverga uriladi

`ready.js:48` (10 daq), `ready.js:62` (15 daq),
`youtubeNotifier.js:257` (5 daq) — hammasi bir tikda barcha serverlarni
aylanib chiqadi.

**Yechim:** har server uchun kichik siljish (jitter) yoki cheklangan
parallellik bilan navbatma-navbat ishlov berish.

**Qiyinligi:** oson.

---

### QW11 — `index.js` ichida 260 qator HTML

`index.js` 346 qator, shundan ~260 tasi `/`, `/guide`, `/terms`, `/privacy`
sahifalarining HTML shablonlari. Har so'rovda qaytadan yig'iladi.

**Yechim:** alohida fayllarga chiqarish, boot paytida bir marta yig'ib
keshlash. Shu bilan birga `compression` middleware qo'shish (sahifa ~15 KB).

**Qiyinligi:** oson, lekin ko'p qator ko'chiriladi.

---

### B4 — Ovozli sessiyalar deployda yo'qoladi

`activityTracker.js:6` — `voiceSessions` Map faqat xotirada. Render har
deployda uni o'chiradi, shuning uchun ayni paytda ovozli xonada o'tirgan
odamning vaqti yo'qoladi va kunlik hisobi kam chiqadi. Bundan tashqari a'zo
serverdan chiqsa yozuv tozalanmaydi — sekin "oqish" (leak).

**Nega to'xtab turgan edi:** sessiya boshlanish vaqtini saqlash kerak edi,
saqlash esa blobga borardi (B1).

**Endi ochiq.** B1 tugagani uchun yo'l ochildi.

**Taklif etilgan yechim:** a'zo kirganda `guild_activity` qatoriga
`voice_session_start` yozish; `ready` da `guild.voiceStates.cache` bilan
solishtirib tugallanmagan sessiyalarni tiklash yoki yopish.

**Qiyinligi:** o'rtacha. Yangi ustun kerak.

---

### B5 — Buyruqlar uchun umumiy qatlam yo'q

Buyruqlar oddiy `{ data, execute }` obyektlari (`index.js:32-47`). Cooldown
yo'q, umumiy ruxsat tekshiruvi yo'q, metrika yo'q.
`interactionCreate.js:48-64` dagi try/catch — yagona umumiy joy.

**Yechim:** `index.js` da yuklash paytida `command.execute` ni o'rab olish
(cooldown → ruxsat → vaqt o'lchash → xatolik). Buyruqlarning o'zi
o'zgarmaydi.

**Qiyinligi:** o'rtacha.

---

### B6 — 105 ta `console.*`, darajali logger yo'q

Ovozini o'chirib bo'lmaydi, prod uchun daraja qo'yib bo'lmaydi, strukturali
log yo'q.

**Nega to'xtab turgan:** konsol chiqishi ayni paytda Render paneli uchun
interfeys vazifasini ham bajaradi (`storage.init()` dagi `====` ramkalari).

**Yechim:** `LOG_LEVEL` ni hisobga oladigan yupqa
`log.{debug,info,warn,error}` o'ramchisi + har doim chiqadigan
`log.banner()`. Keyin almashtirish mexanik.

**Qiyinligi:** oson (o'ramchi yozilgach).

---

## 🔒 Xavfsizlik eslatmalari (optimizatsiyaga aloqasi yo'q)

### 1. `service_role` kaliti va o'chirilgan RLS

`storage.js:17` `SUPABASE_SERVICE_ROLE_KEY` ni qabul qiladi, RLS xatosi
ishlovchisi esa operatorga to'g'ridan-to'g'ri
`ALTER TABLE guild_settings DISABLE ROW LEVEL SECURITY;` qilishni yoki
`service_role` kalitiga o'tishni maslahat beradi. README ham shuni takrorlaydi.

`service_role` RLS ni butunlay chetlab o'tadi — ishonchli backend uchun bu
normal, lekin ENV o'zgaruvchisi sizib chiqsa, bu **butun bazaga to'liq
kirish** degani. RLS ni o'chirish esa himoyaning yana bir qatlamini olib
tashlaydi.

Bu ogohlantirish xabarining standart maslahati emas, **ongli qaror** bo'lishi
kerak.

### 2. PRIVACY.md va cross-server logging bir-biriga zid

`PRIVACY.md` da log ma'lumotlari "tashqi serverlarga berilmaydi" deyilgan.
Ammo cross-server logging imkoniyati (`logger.js:24-26`, `:32-37`) loglarni
ataylab **ikkinchi Discord serveriga** uzatadi.

Matn va amaldagi xatti-harakat mos kelmaydi — biri tuzatilishi kerak.

---

## 🧪 Tekshiruv haqida

Har bir tuzatish uchun test to'plami yozildi va bajarildi:

| To'plam | Tekshiruvlar | Natija |
|---|---|---|
| `test-storage` | 17 ta | ✅ |
| `test-supabase-queue` | 13 ta | ✅ |
| `test-qw23` | 15 ta | ✅ |
| `test-b1` | 19 ta | ✅ |

> ⚠️ **Muhim cheklov.** Loyihada `node_modules` o'rnatilmagan, shuning uchun
> barcha testlar **soxta (stub)** `discord.js` va **soxta** Supabase mijozi
> bilan ishlatildi. Mantiq, yozish donadorligi, migratsiya va zaxira
> rejimlari tekshirildi — lekin haqiqiy Postgres yoki haqiqiy Discord
> gateway bilan **hech narsa sinovdan o'tkazilmadi**.
>
> Deploydan oldin `npm install` qilib, alohida (test) Supabase loyihasiga
> ulanib botni ishga tushirish kerak. Ayniqsa README dagi SQL ustun turlari
> mijoz yuborayotgan qiymatlarga mos kelishini tekshirish lozim:
> `last_xp` va `today_voice_ms` — `bigint`, sanalar — `text`.

Testlar vaqtinchalik papkada (scratchpad) yozilgan va repoga qo'shilmagan.
Doimiy saqlash kerak bo'lsa — `test/` papkasiga ko'chirish mumkin.

---

## Tavsiya etilgan keyingi tartib

1. **QW4 + QW5 + QW10** — mexanik, xavfsiz, konsolni tozalaydi.
2. **QW7 + QW9** — kichik, issiq yo'lda foyda beradi.
3. **B4** — B1 tugagani uchun endi ochiq; foydalanuvchiga ko'rinadigan xato.
4. **B6** → **B5** — avval logger, keyin buyruq qatlami.
5. **QW11 + QW6** — tozalash ishlari.
