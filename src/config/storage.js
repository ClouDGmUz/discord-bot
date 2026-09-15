const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'settings.json');
const TMP_FILE = `${DATA_FILE}.tmp`;

// Lokal faylga yozishni kechiktirish oynasi (ms).
// Har bir o'zgarishda emas, to'plangan holda bir marta yoziladi.
const FLUSH_DEBOUNCE_MS = Number(process.env.STORAGE_FLUSH_MS) || 2000;

// In-memory kesh
let memoryCache = {};
let supabaseStatus = {
  connected: false,
  message: 'Supabase sozlanmagan (Lokal rejim)',
  url: null
};

// ===================== STANDART SOZLAMALAR (YAGONA MANBA) =====================
// Yangi xossa qo'shish uchun faqat shu obyektni tahrirlash kifoya.
// applyDefaults() eski serverlarga yetishmayotgan xossalarni avtomatik to'ldiradi.

const DEFAULT_MEMBER_ACTIVITY = {
  todayVoiceMs: 0,
  todayMessages: 0,
  currentDate: null,
  lastActiveDate: null,
  hasRole: false
};

const DEFAULT_SETTINGS = {
  logChannelId: null,
  logCategoryId: null,
  logChannels: {
    messages: null,
    members: null,
    moderation: null,
    tickets: null,
    voice: null
  },
  welcomeChannelId: null,
  welcomeMessage: 'Xush kelibsiz, {user}! Siz serverimizning {memberCount}-a\'zosisiz 🎉',
  welcomeEnabled: false,
  ticketChannelId: null,
  ticketCategoryId: null,
  supportRoleId: null,
  ticketCounter: 0,
  autoRoleId: null,
  antiLinkEnabled: true,
  linkWhitelist: [],
  // Foydalanuvchi kaliti bo'yicha to'ldiriladigan lug'atlar bo'sh {} bo'lib qoladi -
  // applyDefaults ular ichiga kirmaydi (pastdagi isTemplateObject ga qarang).
  warns: {},
  stats: {
    enabled: false,
    categoryId: null,
    totalChannelId: null,
    membersChannelId: null,
    botsChannelId: null
  },
  tempVoice: {
    enabled: false,
    categoryId: null,
    channelId: null
  },
  leveling: {
    enabled: false,
    channelId: null,
    users: {}
  },
  mediaRoles: {
    enabled: false,
    roles: []
  },
  youtubeNotifier: {
    enabled: false,
    channelId: null,
    youtubeChannelId: null,
    youtubeChannelName: null,
    youtubeChannelUrl: null,
    pingRoleId: null,
    customMessage: null,
    lastVideoId: null
  },
  teamArchive: {
    fillChannelId: null,
    channelId: null,
    headRoleId: null,
    moderRoleId: null,
    pingRoleId: null,
    allowPublicView: true,
    members: {}
  },
  activeRole: {
    enabled: false,
    roleId: null,
    voiceMinutes: 45,
    messageCount: 20,
    mode: 'voice_or_messages',
    logChannelId: null,
    sendMessage: true,
    silent: false,
    members: {}
  }
};

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Bo'sh {} - bu foydalanuvchi kalitlari bilan to'ldiriladigan lug'at (warns, members, users).
// Uning ichiga kirib standart xossa qo'shish mumkin emas.
function isTemplateObject(value) {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

/**
 * Saqlangan obyektga yetishmayotgan standart xossalarni to'ldiradi (joyida, rekursiv).
 * Mavjud qiymatlar hech qachon ustiga yozilmaydi - faqat undefined/null bo'lganlari.
 */
function applyDefaults(target, defaults) {
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const current = target[key];

    if (current === undefined || current === null) {
      target[key] = isPlainObject(defaultValue) || Array.isArray(defaultValue)
        ? structuredClone(defaultValue)
        : defaultValue;
      continue;
    }

    if (Array.isArray(defaultValue)) {
      if (!Array.isArray(current)) target[key] = structuredClone(defaultValue);
      continue;
    }

    if (isTemplateObject(defaultValue)) {
      if (isPlainObject(current)) {
        applyDefaults(current, defaultValue);
      } else {
        target[key] = structuredClone(defaultValue);
      }
    }
  }
  return target;
}

// Qaysi serverlar ushbu jarayonda allaqachon tekshirilgani (har o'qishda qayta yugurmaslik uchun)
const normalizedGuilds = new Set();

function normalizeGuild(guildId) {
  let settings = memoryCache[guildId];

  if (!settings) {
    settings = structuredClone(DEFAULT_SETTINGS);
    memoryCache[guildId] = settings;
    normalizedGuilds.add(guildId);
    return settings;
  }

  if (!normalizedGuilds.has(guildId)) {
    applyDefaults(settings, DEFAULT_SETTINGS);
    normalizedGuilds.add(guildId);
  }

  return settings;
}

// ===================== LOKAL FAYL (KECHIKTIRILGAN, ATOMAR YOZISH) =====================

let dirty = false;
let writing = false;
let flushTimer = null;

function ensureDirSync() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalFileSync() {
  try {
    ensureDirSync();
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Lokal fayl o\'qishda xatolik:', err.message);
    return {};
  }
}

/**
 * Keshni diskka yozadi. Yozish davomida kelgan yangi o'zgarishlar
 * while tsikli orqali darhol qayta yoziladi (hech narsa yo'qolmaydi).
 */
async function flushLocalFile() {
  if (writing || !dirty) return;
  writing = true;
  try {
    while (dirty) {
      dirty = false;
      const snapshot = JSON.stringify(memoryCache);
      try {
        await fsp.mkdir(DATA_DIR, { recursive: true });
        await fsp.writeFile(TMP_FILE, snapshot, 'utf8');
        await fsp.rename(TMP_FILE, DATA_FILE);
      } catch (err) {
        dirty = true; // keyingi urinishda qayta yoziladi
        console.error('Lokal fayl yozishda xatolik:', err.message);
        break;
      }
    }
  } finally {
    writing = false;
  }
}

function scheduleLocalFlush() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLocalFile();
  }, FLUSH_DEBOUNCE_MS);
  // Timer jarayonni ochiq ushlab turmasin
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

// Jarayon to'xtaganda (Render deploy / SIGTERM) kutilayotgan yozuvni yo'qotmaslik
function flushLocalFileSync() {
  if (!dirty) return;
  try {
    ensureDirSync();
    fs.writeFileSync(TMP_FILE, JSON.stringify(memoryCache), 'utf8');
    fs.renameSync(TMP_FILE, DATA_FILE);
    dirty = false;
  } catch (err) {
    console.error('Yopilishda lokal fayl yozishda xatolik:', err.message);
  }
}

process.on('exit', flushLocalFileSync);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    flushLocalFileSync();
    process.exit(0);
  });
}

// ===================== SUPABASE =====================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    supabaseStatus.url = supabaseUrl;
  } catch (err) {
    supabaseStatus.message = `Supabase client yaratishda xato: ${err.message}`;
  }
}

let rlsWarningLogged = false;

// Supabase ga orqa fonda asinxron saqlash
async function syncToSupabase(guildId, data) {
  if (!supabase || !supabaseStatus.connected) return;
  try {
    const { error } = await supabase
      .from('guild_settings')
      .upsert({ guild_id: guildId, data: data });

    if (error) {
      if (error.message && error.message.includes('row-level security')) {
        if (!rlsWarningLogged) {
          rlsWarningLogged = true;
          console.warn('⚠️ [SUPABASE RLS XATOSI]: guild_settings jadvalida Row Level Security (RLS) yoqilgan.');
          console.warn('💡 TEZ YECHIM: Supabase -> SQL Editor ga kirib quyidagi 1 qator kodni ishga tushiring (Run):');
          console.warn('   ALTER TABLE guild_settings DISABLE ROW LEVEL SECURITY;');
          console.warn('   Yoki Render ENV dagi SUPABASE_KEY ga "service_role" secret kalitini kiriting.');
        }
      } else {
        console.warn('[SUPABASE SAQLASH XATOSI]:', error.message);
      }
    }
  } catch (err) {
    console.warn('[SUPABASE EXCEPTION]:', err.message);
  }
}

module.exports = {
  getSupabaseStatus() {
    return supabaseStatus;
  },

  // Bot ishga tushganda bazani yuklash va natijani konsolga chiqarish
  async init() {
    // 1. Lokal fayldan o'qish
    memoryCache = readLocalFileSync();
    normalizedGuilds.clear();

    // 2. Agar Supabase parametrlari kiritilmagan bo'lsa
    if (!supabase) {
      supabaseStatus.connected = false;
      supabaseStatus.message = 'SUPABASE_URL yoki SUPABASE_KEY kiritilmagan (Lokal rejim)';
      console.log('====================================================');
      console.log('🗄️ SUPABASE BAZASI HOLATI:');
      console.log('❌ ULANMADI: SUPABASE_URL yoki SUPABASE_KEY kiritilmagan!');
      console.log('⚠️ Bot vaqtinchalik lokal xotira (JSON) rejimida ishlamoqda.');
      console.log('💡 Render ENV ga kalitlarni kiritsangiz, sozlamalar abadiy saqlanadi.');
      console.log('====================================================');
      for (const guildId of Object.keys(memoryCache)) normalizeGuild(guildId);
      return;
    }

    // 3. Supabase ga ulanishni tekshirish va ma'lumotlarni tortib olish
    try {
      console.log('⏳ Supabase ga ulanilmoqda va ma\'lumotlar tekshirilmoqda...');
      const { data, error } = await supabase
        .from('guild_settings')
        .select('guild_id, data');

      if (error) {
        supabaseStatus.connected = false;
        supabaseStatus.message = `Xatolik: ${error.message}`;
        console.log('====================================================');
        console.log('🗄️ SUPABASE BAZASI HOLATI:');
        console.log(`⚠️ ULANISHDA XATOLIK: ${error.message}`);
        console.log('💡 Iltimos, Supabase SQL Editor da jadval yaratilganini tekshiring:');
        console.log('   CREATE TABLE guild_settings (guild_id TEXT PRIMARY KEY, data JSONB);');
        console.log('====================================================');
      } else {
        supabaseStatus.connected = true;
        supabaseStatus.message = 'Muvaffaqiyatli ulandi (Faol)';
        const count = data ? data.length : 0;

        if (data && data.length > 0) {
          data.forEach(row => {
            if (row.guild_id && row.data) {
              memoryCache[row.guild_id] = row.data;
            }
          });
          scheduleLocalFlush();
        }

        console.log('====================================================');
        console.log('🗄️ SUPABASE BAZASI HOLATI:');
        console.log('✅ ULANDI: Supabase bulutli bazasiga muvaffaqiyatli ulandi!');
        console.log(`🔗 Manzil: ${supabaseUrl}`);
        console.log(`📊 Saqlangan serverlar soni: ${count} ta`);
        console.log('🔒 Deploy bo\'lganda ham sozlamalar va ticketlar saqlanadi.');
        console.log('====================================================');
      }
    } catch (err) {
      supabaseStatus.connected = false;
      supabaseStatus.message = `Ulanish istisnosi: ${err.message}`;
      console.log('====================================================');
      console.log('🗄️ SUPABASE BAZASI HOLATI:');
      console.log(`❌ KUTILMAGAN XATOLIK: ${err.message}`);
      console.log('====================================================');
    }

    // 4. Barcha yuklangan serverlarni bir marta standartlar bilan to'ldirish
    for (const guildId of Object.keys(memoryCache)) normalizeGuild(guildId);
    await flushLocalFile();
  },

  getGuildSettings(guildId) {
    return normalizeGuild(guildId);
  },

  updateGuildSettings(guildId, newSettings) {
    const current = normalizeGuild(guildId);
    memoryCache[guildId] = {
      ...current,
      ...newSettings
    };

    scheduleLocalFlush();
    syncToSupabase(guildId, memoryCache[guildId]);

    return memoryCache[guildId];
  },

  addWarn(guildId, userId, reason, moderatorId) {
    const guildSettings = normalizeGuild(guildId);
    if (!guildSettings.warns[userId]) guildSettings.warns[userId] = [];

    const warnEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
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
    const guildSettings = normalizeGuild(guildId);
    return guildSettings.warns[userId] || [];
  },

  removeUserWarn(guildId, userId, warnId) {
    const guildSettings = normalizeGuild(guildId);
    if (!guildSettings.warns[userId]) return false;

    const index = guildSettings.warns[userId].findIndex(w => w.id === warnId);
    if (index === -1) return false;

    const removed = guildSettings.warns[userId].splice(index, 1)[0];
    this.updateGuildSettings(guildId, { warns: guildSettings.warns });
    return removed;
  },

  clearUserWarns(guildId, userId) {
    const guildSettings = normalizeGuild(guildId);
    if (!guildSettings.warns[userId]) return 0;

    const count = guildSettings.warns[userId].length;
    guildSettings.warns[userId] = [];
    this.updateGuildSettings(guildId, { warns: guildSettings.warns });
    return count;
  },

  incrementTicketCounter(guildId) {
    const guildSettings = normalizeGuild(guildId);
    guildSettings.ticketCounter = (guildSettings.ticketCounter || 0) + 1;
    this.updateGuildSettings(guildId, { ticketCounter: guildSettings.ticketCounter });
    return guildSettings.ticketCounter;
  },

  addXP(guildId, userId) {
    const settings = normalizeGuild(guildId);
    if (!settings.leveling.enabled) return null;

    if (!settings.leveling.users[userId]) {
      settings.leveling.users[userId] = {
        xp: 0,
        level: 1,
        messages: 0,
        lastXp: 0
      };
    }

    const userData = settings.leveling.users[userId];
    const now = Date.now();

    // 60 soniyalik anti-spam cooldown (bir minutda 1 marta XP)
    if (now - (userData.lastXp || 0) < 60000) {
      userData.messages = (userData.messages || 0) + 1;
      return null;
    }

    // 15 dan 25 gacha tasodifiy XP
    const earnedXP = Math.floor(Math.random() * 11) + 15;
    userData.xp = (userData.xp || 0) + earnedXP;
    userData.messages = (userData.messages || 0) + 1;
    userData.lastXp = now;

    // Kerakli XP formulasi: level * 100
    let requiredXP = (userData.level || 1) * 100;
    let leveledUp = false;
    const oldLevel = userData.level || 1;

    while (userData.xp >= requiredXP) {
      userData.xp -= requiredXP;
      userData.level = (userData.level || 1) + 1;
      leveledUp = true;
      requiredXP = userData.level * 100;
    }

    this.updateGuildSettings(guildId, { leveling: settings.leveling });

    return {
      leveledUp,
      oldLevel,
      newLevel: userData.level,
      currentXP: userData.xp,
      requiredXP
    };
  },

  getUserLevel(guildId, userId) {
    const settings = normalizeGuild(guildId);
    const enabled = Boolean(settings.leveling.enabled);
    const userData = settings.leveling.users[userId];

    if (!userData) {
      return {
        level: 1,
        xp: 0,
        requiredXP: 100,
        messages: 0,
        rank: 1,
        enabled
      };
    }

    const level = userData.level || 1;
    const xp = userData.xp || 0;
    const requiredXP = level * 100;

    // O'rinni bitta o'tishda hisoblash (butun ro'yxatni saralamasdan)
    let ahead = 0;
    for (const [id, data] of Object.entries(settings.leveling.users)) {
      if (id === userId) continue;
      const otherLevel = data.level || 1;
      const otherXp = data.xp || 0;
      if (otherLevel > level || (otherLevel === level && otherXp > xp)) ahead++;
    }

    return {
      level,
      xp,
      requiredXP,
      messages: userData.messages || 0,
      rank: ahead + 1,
      enabled
    };
  },

  getLeaderboard(guildId, limit = 10) {
    const settings = normalizeGuild(guildId);
    const enabled = Boolean(settings.leveling.enabled);

    const allUsers = Object.entries(settings.leveling.users)
      .map(([id, data]) => ({
        id,
        level: data.level || 1,
        xp: data.xp || 0,
        messages: data.messages || 0
      }))
      .sort((a, b) => b.level - a.level || b.xp - a.xp)
      .slice(0, limit);

    return {
      list: allUsers,
      enabled
    };
  },

  // ===================== MEGA TEAM ARXIVI METODLARI =====================
  setTeamArchiveSettings(guildId, newSettings) {
    const settings = normalizeGuild(guildId);
    settings.teamArchive = {
      ...settings.teamArchive,
      ...newSettings
    };
    this.updateGuildSettings(guildId, { teamArchive: settings.teamArchive });
    return settings.teamArchive;
  },

  saveTeamMember(guildId, userId, memberData) {
    const settings = normalizeGuild(guildId);

    settings.teamArchive.members[userId] = {
      ...(settings.teamArchive.members[userId] || {}),
      ...memberData,
      updatedAt: new Date().toISOString()
    };

    this.updateGuildSettings(guildId, { teamArchive: settings.teamArchive });
    return settings.teamArchive.members[userId];
  },

  getTeamMember(guildId, userId) {
    return normalizeGuild(guildId).teamArchive.members[userId] || null;
  },

  getAllTeamMembers(guildId) {
    return normalizeGuild(guildId).teamArchive.members;
  },

  removeTeamMember(guildId, userId) {
    const settings = normalizeGuild(guildId);
    const removed = settings.teamArchive.members[userId];
    if (!removed) return false;

    delete settings.teamArchive.members[userId];
    this.updateGuildSettings(guildId, { teamArchive: settings.teamArchive });
    return removed;
  },

  // ===================== KUNLIK FAOLLIK ROLI METODLARI =====================
  getActiveRoleSettings(guildId) {
    const activeRole = normalizeGuild(guildId).activeRole;

    // sendMessage <-> silent mos kelishini ta'minlash (eski yozuvlar uchun)
    if (activeRole.sendMessage === undefined) {
      activeRole.sendMessage = activeRole.silent !== undefined ? !activeRole.silent : true;
    }
    if (activeRole.silent === undefined) {
      activeRole.silent = !activeRole.sendMessage;
    }

    return activeRole;
  },

  updateActiveRoleSettings(guildId, newSettings) {
    const settings = normalizeGuild(guildId);
    settings.activeRole = {
      ...settings.activeRole,
      ...newSettings
    };
    if (settings.activeRole.sendMessage !== undefined && newSettings.silent === undefined) {
      settings.activeRole.silent = !settings.activeRole.sendMessage;
    } else if (settings.activeRole.silent !== undefined && newSettings.sendMessage === undefined) {
      settings.activeRole.sendMessage = !settings.activeRole.silent;
    }
    this.updateGuildSettings(guildId, { activeRole: settings.activeRole });
    return settings.activeRole;
  },

  getMemberActivity(guildId, userId) {
    const members = normalizeGuild(guildId).activeRole.members;
    // O'qish paytida yozuv yaratilmaydi - faqat nusxa qaytariladi
    return members[userId] || structuredClone(DEFAULT_MEMBER_ACTIVITY);
  },

  updateMemberActivity(guildId, userId, data) {
    const settings = normalizeGuild(guildId);
    const members = settings.activeRole.members;

    members[userId] = {
      ...(members[userId] || DEFAULT_MEMBER_ACTIVITY),
      ...data
    };

    this.updateGuildSettings(guildId, { activeRole: settings.activeRole });
    return members[userId];
  },

  getAllActiveMembers(guildId) {
    return normalizeGuild(guildId).activeRole.members;
  }
};
