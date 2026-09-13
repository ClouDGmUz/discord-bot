# 🤖 Ko'p Funksiyali Discord Boti (discord.js v14)

Ushbu bot zamonaviy **discord.js v14** texnologiyasida yozilgan bo'lib, o'zida kuchli moderatsiya, log tizimi (audit log), moslashuvchan welcome xabarlari, server ma'lumotlari hamda **Render.com** bepul hostingida 24/7 uzluksiz ishlash imkoniyatini jamlagan.

---

## 📌 Mavjud Buyruqlar (Slash Commands)

### 🛡️ Moderatsiya
- `/give-role [user] [role]` — Foydalanuvchiga belgilangan rolni xavfsiz berish (ierarxiyani tekshiradi).
- `/remove-role-from [remove_role] [having_role]` — 1-tanlangan rolni 2-roli bor barcha foydalanuvchilardan bittada olib tashlash.
- `/mute [user] [duration] [reason]` — Foydalanuvchini vaqtinchalik ovozini o'chirish (Timeout). Misollar: `60s`, `10m`, `1h`, `7d`.
- `/unmute [user] [reason]` — Mute jazo muddatini bekor qilish.
- `/del-warn [user] [reason] [message_id]` — Qoidabuzar xabarini o'chiradi va unga rasmiy ogohlantirish (warn) yozadi (DM ham yuboradi).
- `/clear [count] [user]` — Chatdagi xabarlarni ommaviy tozalash (1 dan 100 tagacha).

### ⚙️ Server Sozlamalari
- `/set-log [channel] [disable]` — Serverdagi barcha hodisalar (xabar o'chishi/tahrirlanishi, a'zolar kirish/chiqishi, rollar o'zgarishi, ovozli kanallar) yoziladigan log kanalini belgilash.
- `/set-welcome [channel] [message] [status] [test]` — Yangi a'zolar kirganda xush kelibsiz xabarini sozlash. O'zgaruvchilar: `{user}`, `{username}`, `{server}`, `{memberCount}`. Sinov uchun `test: True` tugmasi mavjud.

### ℹ️ Umumiy va Ma'lumot
- `/avatar [type] [user]` — O'zingizning, boshqa a'zoning yoki butun serverning rasmi (Icon va Banner)ni eng yuqori **4096px HD** sifatda ko'rish va yuklab olish.
- `/roles` — Serverdagi barcha rollar va har bir roldagi a'zolar sonini ko'rsatadi.
- `/server-info` — Server haqida to'liq statistika (egasi, ochilgan sana, a'zolar/botlar, kanallar, boostlar).
- `/user-info [user]` — Foydalanuvchi profili, hisob ochilgan sana, serverga kirgan vaqti, rollari va jami warnlari.
- `/help` — Barcha buyruqlar ro'yxati va ulardan foydalanish qo'llanmasi.

---

## 🚀 1-BOSQICH: Discord Developer Portal da Bot Yaratish

1. [Discord Developer Portal](https://discord.com/developers/applications) sahifasiga kiring.
2. **New Application** tugmasini bosing va botingizga nom bering.
3. Chap menyudan **Bot** bo'limiga o'ting:
   - **Reset Token** tugmasini bosib bot tokenini nusxalab oling (Bu `DISCORD_TOKEN`).
   - ⚠️ **JUDA MUHIM (Privileged Gateway Intents):** Sal pastga tushib, quyidagi 3 ta intetni YOQING (Checkmark qo'ying):
     - ✅ **Presence Intent**
     - ✅ **Server Members Intent** *(A'zolar kirishi, rollar va moderatsiya uchun shart)*
     - ✅ **Message Content Intent** *(Xabarlar o'chirilishi va tahrirlanishi logi uchun shart)*
   - **Save Changes** tugmasini bosing.
4. Chap menyudan **OAuth2 -> URL Generator** bo'limiga o'ting:
   - **Scopes:** `bot` va `applications.commands` ni belgilang.
   - **Bot Permissions:** `Administrator` (yoki kerakli barcha moderatsiya ruxsatlarini) belgilang.
   - Pastda hosil bo'lgan havolani (URL) ochib, botni o'zingizning serveringizga taklif qiling.
5. Chap menyudan **General Information** bo'limiga o'tib, **Application ID** ni nusxalab oling (Bu `CLIENT_ID`).

---

## 💻 2-BOSQICH: Lokal Kompyuterda Ishga Tushirish (Ixtiyoriy)

1. Loyiha papkasida `.env` faylini yarating (yoki `.env.example` dan nusxa oling):
   ```env
   DISCORD_TOKEN=sizning_bot_tokeningiz
   CLIENT_ID=sizning_application_id
   GUILD_ID=sinov_serveri_id_ixtiyoriy
   PORT=3000
   ```
2. Bog'liqliklarni o'rnating:
   ```bash
   npm install
   ```
3. Botni ishga tushiring:
   ```bash
   npm start
   ```

---

## 🐙 3-BOSQICH: GitHub'ga Yuklash

Ushbu loyihani shaxsiy GitHub repozitoriyangizga yuklash uchun quyidagi buyruqlarni terminalda bajaring:

1. Gitni ishga tushirish:
   ```bash
   git init
   git add .
   git commit -m "Discord bot - to'liq tayyor"
   git branch -M main
   ```
2. [GitHub](https://github.com/new) da yangi repozitoriy oching (masalan, `discord-bot`).
3. GitHub repozitoriyangiz havolasini ulab, yuklang:
   ```bash
   git remote add origin https://github.com/USERNAME/discord-bot.git
   git push -u origin main
   ```
   *(Eslatma: `.gitignore` sababli `.env` va `node_modules` avtomatik tarzda yuklanmaydi, tokeningiz xavfsiz qoladi).*

---

## ☁️ 4-BOSQICH: Render.com ga Joylashtirish (Deploy)

1. [Render.com](https://render.com) ga kiring va GitHub orqali ro'yxatdan o'ting / kiring.
2. Bosh sahifada **New +** tugmasini bosing va **Web Service** ni tanlang.
3. Yangi yuklagan `discord-bot` repozitoriyangizni topib, **Connect** ni bosing.
4. Quyidagi parametrlarni kiriting:
   - **Name:** istalgan nom (masalan: `my-discord-bot`)
   - **Region:** Frankfurt yoki eng yaqin hudud
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` ($0/month)
5. **Environment Variables** (Muhit o'zgaruvchilari) bo'limini oching va quyidagilarni kiriting:
   - `DISCORD_TOKEN` = Sizning bot tokeningiz
   - `CLIENT_ID` = Sizning bot Application ID ingiz
   - `PORT` = `3000` (yoki Render beradigan standart port)
   - `AUTO_DEPLOY` = `true` (buyruqlarni o'zi avtomat Discordga kiritadi)
6. **Create Web Service** tugmasini bosing.
   - Render avtomatik ravishda kodni oladi, `npm install` qiladi va `node src/index.js` ni ishga tushiradi.
   - 1-2 daqiqadan so'ng konsolda botingiz muvaffaqiyatli ishga tushgani ko'rinadi!

---

## ⏰ 5-BOSQICH: Botni 24/7 Uxlamaydigan Qilish (Keep-Alive)

Render.com ning bepul web-servislari 15 daqiqa tashrif bo'lmasa uxlab qoladi. Buni oldini olish va botni **24/7 onlayn** ushlab turish uchun:

1. Render boshqaruv panelida botingizning havolasini nusxalab oling (masalan: `https://my-discord-bot.onrender.com`).
2. [UptimeRobot](https://uptimerobot.com) saytiga bepul ro'yxatdan o'ting.
3. **Add New Monitor** tugmasini bosing:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Discord Bot`
   - **URL (or IP):** `https://my-discord-bot.onrender.com`
   - **Monitoring Interval:** `5 minutes` (har 5 daqiqada)
4. **Create Monitor** tugmasini bosing.

🎉 **Bo'ldi!** UptimeRobot har 5 daqiqada botingizning Express veb-serveriga so'rov yuborib turadi va Render servisi hech qachon uxlamasdan 24/7 ishlab turadi!
