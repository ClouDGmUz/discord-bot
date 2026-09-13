require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const deployCommands = require('./deploy-commands');

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
        <title>Discord Bot Status</title>
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
          <h1>🤖 Discord Bot Tizimi</h1>
          <p>Holat: <strong>${status}</strong></p>
          <p>Bot nomi: <strong>${client.user ? client.user.tag : 'Yuklanmoqda...'}</strong></p>
          <p>Serverlar soni: <strong>${client.guilds?.cache.size || 0}</strong></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`🌐 Express web-server ${PORT}-portda ishga tushdi (Render.com uchun tayyor).`);
});

// 5. DISCORD GA ULANISH VA BUYRUQLARNI SINXRONLASH
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
