# 🤖 Cleva — Ko'p Funksiyali Discord Boti (discord.js v14)

**Cleva** zamonaviy **discord.js v14** texnologiyasida yozilgan bo'lib, o'zida kuchli moderatsiya, log tizimi (audit log), moslashuvchan welcome xabarlari, tugmali Ticket (yordam markazi) tizimi, e'lonlar, so'rovnomalar hamda **Render.com** bepul hostingida 24/7 uzluksiz ishlash imkoniyatini jamlagan.

---

## 📌 Barcha Buyruqlar (Slash Commands)

### 🛡️ Moderatsiya
- `/give-role [user] [role]` — Foydalanuvchiga belgilangan rolni xavfsiz berish (ierarxiyani tekshiradi).
- `/remove-role-from [remove_role] [having_role]` — 1-tanlangan rolni 2-roli bor barcha foydalanuvchilardan bittada olib tashlash.
- `/mute [user] [duration] [reason]` — Foydalanuvchini vaqtinchalik ovozini o'chirish (Timeout). Misollar: `60s`, `10m`, `1h`, `7d`.
- `/unmute [user] [reason]` — Mute jazo muddatini bekor qilish.
- `/del-warn [user] [reason] [message_id]` — Qoidabuzar xabarini o'chiradi va unga rasmiy ogohlantirish (warn) yozadi (DM ham yuboradi).
- `/clear [count] [user]` — Chatdagi xabarlarni ommaviy tozalash (1 dan 100 tagacha).

### ⚙️ Server Sozlamalari va Tizimlar
- `/set-log [channel] [disable]` — Serverdagi barcha hodisalar (xabar o'chishi/tahrirlanishi, a'zolar kirish/chiqishi, rollar o'zgarishi, ovozli kanallar) yoziladigan log kanalini belgilash.
- `/set-welcome [channel] [message] [status] [test]` — Yangi a'zolar kirganda xush kelibsiz xabarini sozlash. O'zgaruvchilar: `{user}`, `{username}`, `{server}`, `{memberCount}`. Sinov uchun `test: True` mavjud.
- `/set-ticket [channel] [category] [support_role]` — **Tugmali Ticket (Murojaat) tizimini sozlash.** Asosiy kanalga chiroyli tugmali panel chiqaradi, a'zo tugmani bossa belgilangan kategoriya ichida shaxsiy yopiq kanal ochiladi.

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

---

## ⏰ 24/7 Keep-Alive (UptimeRobot)

Render.com da botingiz uxlab qolmasligi uchun:
1. Render veb-manzilingizni nusxalang (masalan: `https://discord-bot-xxxx.onrender.com`).
2. [UptimeRobot.com](https://uptimerobot.com) da bepul monitor oching:
   - **Type:** `HTTP(s)`
   - **URL:** `https://discord-bot-xxxx.onrender.com`
   - **Interval:** `5 minutes`
