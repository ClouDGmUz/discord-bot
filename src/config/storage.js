const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'settings.json');

// In-memory kesh
let memoryCache = {};

// Supabase mijozini sozlash
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('🔌 Supabase mijozi ulandi.');
  } catch (err) {
    console.error('Supabase ulanish xatosi:', err.message);
  }
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readLocalFile() {
  try {
    ensureFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Lokal fayl o\'qishda xatolik:', err);
    return {};
  }
}

function writeLocalFile(data) {
  try {
    ensureFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Lokal fayl yozishda xatolik:', err);
    return false;
  }
}

// Supabase ga orqa fonda asinxron saqlash
async function syncToSupabase(guildId, data) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('guild_settings')
      .upsert({ guild_id: guildId, data: data });

    if (error) {
      console.warn('[SUPABASE SAQLASH XATOSI]:', error.message);
    }
  } catch (err) {
    console.warn('[SUPABASE EXCEPTION]:', err.message);
  }
}

module.exports = {
  // Bot ishga tushganda bazani yuklash
  async init() {
    // 1. Lokal fayldan o'qish
    memoryCache = readLocalFile();

    // 2. Agar Supabase bo'lsa, bulutdan barcha ma'lumotlarni tortib olish
    if (supabase) {
      try {
        console.log('⏳ Supabase dan sozlamalar yuklanmoqda...');
        const { data, error } = await supabase
          .from('guild_settings')
          .select('guild_id, data');

        if (error) {
          console.warn('⚠️ Supabase dan o\'qishda xatolik (Jadval yaratilganmi?):', error.message);
        } else if (data && data.length > 0) {
          data.forEach(row => {
            if (row.guild_id && row.data) {
              memoryCache[row.guild_id] = row.data;
            }
          });
          writeLocalFile(memoryCache);
          console.log(`✅ Supabase dan ${data.length} ta server sozlamalari muvaffaqiyatli tiklandi!`);
        } else {
          console.log('ℹ️ Supabase da hozircha saqlangan ma\'lumotlar yo\'q.');
        }
      } catch (err) {
        console.error('Supabase yuklashda xatolik:', err.message);
      }
    }
  },

  getGuildSettings(guildId) {
    if (!memoryCache[guildId]) {
      memoryCache[guildId] = {
        logChannelId: null,
        welcomeChannelId: null,
        welcomeMessage: 'Xush kelibsiz, {user}! Siz serverimizning {memberCount}-a\'zosisiz 🎉',
        welcomeEnabled: false,
        ticketChannelId: null,
        ticketCategoryId: null,
        supportRoleId: null,
        ticketCounter: 0,
        warns: {}
      };
    }
    return memoryCache[guildId];
  },

  updateGuildSettings(guildId, newSettings) {
    const current = this.getGuildSettings(guildId);
    memoryCache[guildId] = {
      ...current,
      ...newSettings
    };

    writeLocalFile(memoryCache);
    syncToSupabase(guildId, memoryCache[guildId]);

    return memoryCache[guildId];
  },

  addWarn(guildId, userId, reason, moderatorId) {
    const guildSettings = this.getGuildSettings(guildId);
    if (!guildSettings.warns) guildSettings.warns = {};
    if (!guildSettings.warns[userId]) guildSettings.warns[userId] = [];

    const warnEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      reason,
      moderatorId,
      date: new Date().toISOString()
    };

    guildSettings.warns[userId].push(warnEntry);
    this.updateGuildSettings(guildId, { warns: guildSettings.warns });

    return {
      warn: warnEntry,
      totalWarns: guildSettings.warns[userId].length
    };
  },

  getUserWarns(guildId, userId) {
    const guildSettings = this.getGuildSettings(guildId);
    if (!guildSettings.warns || !guildSettings.warns[userId]) {
      return [];
    }
    return guildSettings.warns[userId];
  },

  incrementTicketCounter(guildId) {
    const guildSettings = this.getGuildSettings(guildId);
    guildSettings.ticketCounter = (guildSettings.ticketCounter || 0) + 1;
    this.updateGuildSettings(guildId, { ticketCounter: guildSettings.ticketCounter });
    return guildSettings.ticketCounter;
  }
};
