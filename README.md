# 🤖 Cleva — Ko'p Funksiyali Discord Boti (discord.js v14)

**Cleva** zamonaviy **discord.js v14** texnologiyasida yozilgan bo'lib, o'zida kuchli moderatsiya, log tizimi (audit log), moslashuvchan welcome xabarlari, tugmali Ticket (yordam markazi) tizimi, e'lonlar, so'rovnomalar hamda **Render.com** bepul hostingida 24/7 uzluksiz ishlash imkoniyatini jamlagan.

---

## 📌 Barcha Buyruqlar (Slash Commands)

### 🛡️ Moderatsiya va Xavfsizlik
- `/give-role [user] [role]` — Foydalanuvchiga belgilangan rolni xavfsiz berish (ierarxiyani tekshiradi).
- `/remove-role-from [remove_role] [having_role]` — 1-tanlangan rolni 2-roli bor barcha foydalanuvchilardan bittada olib tashlash.
- `/mute [user] [duration] [reason]` — Foydalanuvchini vaqtinchalik ovozini o'chirish (Timeout: `60s`, `10m`, `1h`, `7d`).
- `/unmute [user] [reason]` — Mute jazo muddatini bekor qilish.
- `/del-warn [user] [reason] [message_id]` — Qoidabuzar xabarini o'chiradi va ogohlantirish (warn) yozadi (DM yuboradi).
- `/warns [list | remove | clear]` — Ogohlantirishlar ro'yxatini ko'rish, bitta warnni o'chirish yoki hammasini tozalash.
- `/lock [channel] [reason]` — Kanalni oddiy a'zolar uchun yozishdan vaqtincha qulflaydi (Lockdown).
- `/unlock [channel]` — Qulflangan kanalni qayta ochadi.
- `/clear [count] [user]` — Chatdagi xabarlarni ommaviy tozalash (1 dan 100 tagacha).

### ⚙️ Server Sozlamalari va Tizimlar
- `/set-log category:[category] [disable]` — **Kategoriyalangan Log Tizimi:** Kategoriya ichida avtomat 5 ta yopiq kanal ochadi (`#xabar-loglari`, `#azo-loglari`, `#moderatsiya-loglari`, `#ticket-loglari`, `#ovozli-loglar`).
- `/set-ticket [channel] [category] [support_role]` — **Tugmali Ticket Tizimi:** Murojaat va rol olish anketalari markazi. Yopilganda transcript saqlanadi.
- `/set-autorole [role] [disable]` — **Auto-Role:** Yangi kirgan har bir a'zoga ushbu rolni avtomat biriktiradi.
- `/set-antilink [status]` — **Anti-Link:** Reklama va begona Discord havolalarini avtomat o'chirib jazolash (Standart holatda yoqilgan).
- `/set-welcome [channel] [message] [status] [test]` — Yangi a'zolar uchun xush kelibsiz xabari (`{user}`, `{username}`, `{server}`, `{memberCount}`).

### 📢 E'lonlar va So'rovnomalar
- `/say [message] [channel]` — Bot nomidan istalgan kanalda oddiy matnli xabar yuborish.
- `/embed [title] [description] [color] [image] [thumbnail] [footer] [channel]` — Bot nomidan chiroyli ramkali, rangli va rasmli rasmiy e'lon chiqarish.
- `/poll [question] [option1] [option2] [option3..5]` — 2 dan 5 tagacha variantli ovoz berish so'rovnomasi. Foydalanuvchilar emojilar orqali ovoz berishadi.

### ℹ️ Umumiy va Ma'lumot
- `/avatar [type] [user]` — O'zingizning, boshqa a'zoning yoki butun serverning rasmi (Icon va Banner)ni eng yuqori **4096px HD** sifatda ko'rish va yuklab olish.
- `/roles` — Serverdagi barcha rollar va har bir roldagi a'zolar sonini ko'rsatadi.
- `/server-info` — Server haqida to'liq statistika (egasi, ochilgan sana, a'zolar/botlar, kanallar, boostlar).
- `/user-info [user]` — Foydalanuvchi profili, hisob ochilgan sana, serverga kirgan vaqti, rollari va jami warnlari.
- `/help` — **Mukammal interaktiv qo'llanma.** Dropdown menyu orqali barcha buyruqlar va ularning vazifalarini toifalar bo'yicha ko'rish mumkin.

---

## 🔒 Xavfsizlik: Yagona Server va Asosiy Admin Rejimi

Bot boshqa begona serverlarda ishlamasligi va faqat sizning serveringizga xizmat qilishi uchun ikkita maxsus muhit o'zgaruvchisi kiritilgan:
1. **`ALLOWED_GUILD_ID`** — Botingiz ishlaydigan asosiy server ID si.
   - Bot faqat shu serverdagi buyruqlarga javob beradi.
   - Agar kimdir botni boshqa serverga qo'shsa, bot ushbu ruxsatsiz serverdan **darhol avtomatik chiqib ketadi (`guild.leave()`)**.
   - Slash buyruqlar to'g'ridan-to'g'ri ushbu serverga sinxronlanadi (1 soatlik global kutilishsiz bir zumda ishlaydi).
2. **`OWNER_ID`** — Asosiy adminning (sizning) shaxsiy Discord hisobingiz ID si.

---

## ☁️ Render.com da Environment Variables (ENV)

Render.com boshqaruv panelida **Environment Variables** bo'limiga quyidagilarni kiritasiz:

| Key (Kalit) | Qiymat misoli (Value) | Izoh |
|---|---|---|
| `DISCORD_TOKEN` | `MTE5OT...` | Bot tokeni (Developer Portal -> Bot -> Reset Token) |
| `CLIENT_ID` | `123456789012345678` | Bot Application ID si |
| `ALLOWED_GUILD_ID` | `987654321098765432` | **Botingiz ishlaydigan asosiy serveringiz ID si** |
| `OWNER_ID` | `876543210987654321` | **Sizning shaxsiy Discord hisobingiz ID si** |
| `PORT` | `3000` | Veb-server porti |
| `AUTO_DEPLOY` | `true` | Buyruqlarni avtomat ro'yxatdan o'tkazish |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase Project URL (Sozlamalar esdan chiqmasligi uchun) |
| `SUPABASE_KEY` | `eyJh...` | Supabase Anon / Service API Key |
| `SERVER_INVITE_URL` | `https://discord.gg/fwVyfrtP4h` | Server taklif havolasi (Bot statusi va /help tugmasi uchun) |

---

## 🗄️ Supabase Bazasini Ulash (Deployda Sozlamalar O'chmasligi Uchun)

Render.com har safar yangi deploy bo'lganda server diskini tozalaydi. Barcha sozlamalar (ticketlar, log kanallari, warnlar) abadiy saqlanib turishi uchun:

1. [Supabase.com](https://supabase.com) ga kiring va bepul yangi loyiha (New Project) oching.
2. Chap menyudan **SQL Editor** bo'limiga o'ting va quyidagi 1 qatorlik kodni ishga tushiring (**Run**):
   ```sql
   create table if not exists guild_settings (
     guild_id text primary key,
     data jsonb
   );
   ```
3. **Project Settings -> API** bo'limidan:
   - **Project URL** ni oling (`SUPABASE_URL`)
   - **Project API Keys (anon public)** ni oling (`SUPABASE_KEY`)
4. Ularni Render.com da **Environment Variables** ga qo'shing. Bo'ldi! Endi har qanday deployda ham hamma sozlamalar to'liq saqlanib qoladi.

---

## ⏰ 24/7 Keep-Alive (UptimeRobot)

Render.com da botingiz uxlab qolmasligi uchun:
1. Render veb-manzilingizni nusxalang (masalan: `https://discord-bot-xxxx.onrender.com`).
2. [UptimeRobot.com](https://uptimerobot.com) da bepul monitor oching:
   - **Type:** `HTTP(s)`
   - **URL:** `https://discord-bot-xxxx.onrender.com`
   - **Interval:** `5 minutes`
