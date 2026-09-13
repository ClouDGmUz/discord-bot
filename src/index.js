require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const deployCommands = require('./deploy-commands');
const storage = require('./config/storage');

// 1. DISCORD BOT CLIENTINI SOZLASH
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Yangi a'zo va rollar uchun (Developer Portal da yoqilishi shart)
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Xabar loglari uchun (Developer Portal da yoqilishi shart)
    GatewayIntentBits.GuildVoiceStates, // Ovozli kanal loglari
    GatewayIntentBits.GuildModeration // Ban va jazo loglari
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.User
  ]
});

client.commands = new Collection();

// 2. BUYRUQLARNI YUKLASH (Commands Loader)
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;

  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`[BUYRUQ YUKLANDI] /${command.data.name}`);
    }
  }
}

// 3. HODISALARNI YUKLASH (Events Loader)
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`[HODISA YUKLANDI] ${event.name}`);
}

// 4. RENDER.COM UCHUN EXPRESS WEB SERVER (24/7 Keep-Alive & Health Check)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  const status = client.isReady() ? 'Faol (Online)' : 'Ishga tushmoqda...';
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cleva - Discord Bot Status</title>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem 3rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; border: 1px solid #334155; }
          .badge { display: inline-block; padding: 0.4rem 1rem; border-radius: 9999px; background: #22c55e; color: #022c22; font-weight: bold; margin-bottom: 1rem; }
          h1 { margin: 0 0 0.5rem; color: #38bdf8; }
          p { color: #94a3b8; margin: 0.5rem 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">● 24/7 SERVER ONLINE</div>
          <h1>🤖 Cleva — Discord Bot Tizimi</h1>
          <p>Holat: <strong>${status}</strong></p>
          <p>Bot nomi: <strong>${client.user ? client.user.tag : 'Cleva'}</strong></p>
          <p>Serverlar soni: <strong>${client.guilds?.cache.size || 0}</strong></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', bot: 'Cleva', uptime: process.uptime() });
});

app.get('/terms', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Terms of Service - Cleva Discord Bot</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; padding: 2rem; max-width: 800px; margin: 0 auto; }
          h1 { color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
          h2 { color: #818cf8; margin-top: 1.5rem; }
          a { color: #38bdf8; text-decoration: none; }
          .card { background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #334155; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Terms of Service (Foydalanish Shartlari) — Cleva</h1>
          <p><em>Oxirgi yangilanish: 2026-yil 13-sentyabr</em></p>
          <h2>1. Xizmatdan foydalanish</h2>
          <p>Cleva Discord boti server boshqaruvi, moderatsiya, ticket tizimi va a'zolar qulayligi uchun xizmat qiladi. Botdan noqonuniy harakatlar, spam tarqatish yoki Discord qoidalarini buzish maqsadida foydalanish taqiqlanadi.</p>
          <h2>2. Mas'uliyat</h2>
          <p>Server ma'murlari Cleva botiga taqdim etgan huquq va ruxsatlar doirasida amalga oshirilgan harakatlar uchun to'liq javobgardirlar.</p>
          <h2>3. Xizmat kafolatlari</h2>
          <p>Cleva boti "bor holatida" (as-is) taqdim etiladi. Uzilishlar yoki hosting cheklovlari uchun dasturchilar moddiy javobgar emas.</p>
          <p><a href="/">← Bosh sahifaga qaytish</a> | <a href="/privacy">Privacy Policy</a></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Privacy Policy - Cleva Discord Bot</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; padding: 2rem; max-width: 800px; margin: 0 auto; }
          h1 { color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
          h2 { color: #818cf8; margin-top: 1.5rem; }
          a { color: #38bdf8; text-decoration: none; }
          .card { background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #334155; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Privacy Policy (Maxfiylik Siyosati)</h1>
          <p><em>Oxirgi yangilanish: 2026-yil 13-sentyabr</em></p>
          <h2>1. Saqlanadigan ma'lumotlar</h2>
          <p>Bot faqat o'z funksiyalari uchun kerakli ma'lumotlarni saqlaydi: Server ID, log va welcome kanallari ID si, welcome xabari shabloni hamda moderatsiya ogohlantirishlari (Warns).</p>
          <h2>2. Ma'lumotlar xavfsizligi</h2>
          <p>Shaxsiy ma'lumotlar uchinchi shaxslarga sotilmaydi, berilmaydi yoki noqonuniy maqsadlarda foydalanilmaydi.</p>
          <h2>3. Ma'lumotlarni o'chirish</h2>
          <p>Botni serverdan chiqarish orqali foydalanishni to'xtatishingiz mumkin. Ma'lumotlarni to'liq tozalash uchun dasturchiga murojaat qilish yetarli.</p>
          <p><a href="/">← Bosh sahifaga qaytish</a> | <a href="/terms">Terms of Service</a></p>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Express web-server ${PORT}-portda ishga tushdi (Render.com uchun tayyor).`);
});

// 5. BAZANI TIKLASH VA DISCORD GA ULANISH
async function startBot() {
  await storage.init();

  const token = process.env.DISCORD_TOKEN;

  if (!token || token === 'your_bot_token_here') {
    console.warn('⚠️ DIQQAT: .env faylida DISCORD_TOKEN belgilanmagan! Bot ulanmadi, lekin Web Server faol turibdi.');
  } else {
    // Buyruqlarni avtomatik ro'yxatdan o'tkazish
    if (process.env.AUTO_DEPLOY !== 'false') {
      deployCommands().catch(err => console.error('Avto-deploy xatosi:', err));
    }

    client.login(token).catch(err => {
      console.error('❌ Bot tizimga kira olmadi (Login Error):', err.message);
    });
  }
}

startBot();
