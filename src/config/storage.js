const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const log = require('../utils/log');
const levelCurve = require('../utils/levelCurve');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'settings.json');
const TMP_FILE = `${DATA_FILE}.tmp`;

// Lokal faylga yozishni kechiktirish oynasi (ms).
// Har bir o'zgarishda emas, to'plangan holda bir marta yoziladi.
const FLUSH_DEBOUNCE_MS = Number(process.env.STORAGE_FLUSH_MS) || 2000;

// Supabase ga yozishni kechiktirish oynasi va xatolikda qayta urinish kechikishi (ms)
const SUPABASE_FLUSH_MS = Number(process.env.SUPABASE_FLUSH_MS) || 2000;
const SUPABASE_RETRY_BASE_MS = 1000;
const SUPABASE_RETRY_MAX_MS = 60000;
// Jarayon yopilayotganda navbatni bo'shatishga beriladigan maksimal vaqt
const SHUTDOWN_DRAIN_MS = Number(process.env.SUPABASE_DRAIN_MS) || 5000;

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
  hasRole: false,
  // Ovozli xonada ochiq sessiya boshlangan vaqt (ms). Deploy/restart dan
  // keyin tiklash uchun saqlanadi; xonadan chiqilganda null ga qaytadi.
  voiceSessionStart: null
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
    // Daraja mukofotlari: [{ level, roleId }], darajasi bo'yicha o'sish tartibida
    rewards: [],
    // 'stack' - barcha qo'lga kiritilgan rollar qoladi,
    // 'highest' - faqat eng yuqori mukofot roli qoladi
    rewardMode: 'stack',
    // Ovozli xonada o'tirgani uchun ham XP berilsinmi
    voiceXp: true,
    // XP ko'paytiruvchilari. 0 - umuman XP berilmaydi (no-XP rol/kanal).
    // roles/channels: { [id]: ko'paytiruvchi }, event: { multiplier, endsAt } yoki null
    multipliers: {
      roles: {},
      channels: {},
      event: null
    },
    // Daraja e'loni: mode 'auto' (sozlangan kanal, bo'lmasa joriy chat) | 'dm' | 'off';
    // message - shablon ({user} {username} {level} {server} {role}), null = standart;
    // every - har nechta darajada e'lon qilinadi (mukofot roli doim e'lon qilinadi)
    announce: {
      mode: 'auto',
      message: null,
      every: 1
    },
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

/**
 * Eski shakldagi ({ xp, level } - XP har darajada nolga tushadi) daraja
 * yozuvini yangi shaklga ({ totalXp, level }) o'tkazadi. Yangi yozuvlar
 * (totalXp mavjud) tegilmaydi. O'zgargan bo'lsa true qaytaradi.
 */
function migrateLevelUser(user) {
  if (!user || typeof user.totalXp === 'number') return false;
  user.totalXp = levelCurve.totalXpFromLegacy(user.level, user.xp);
  user.level = levelCurve.levelFromXp(user.totalXp);
  delete user.xp;
  return true;
}

function migrateGuildLevels(guildId, settings) {
  for (const [userId, user] of Object.entries(settings.leveling?.users || {})) {
    if (migrateLevelUser(user)) {
      scheduleLocalFlush();
      queueLevelWrite(guildId, userId);
    }
  }
}

function levelUser(settings, userId) {
  if (!settings.leveling.users[userId]) {
    settings.leveling.users[userId] = {
      totalXp: 0,
      level: levelCurve.MIN_LEVEL,
      messages: 0,
      voiceMinutes: 0,
      lastXp: 0
    };
  }
  return settings.leveling.users[userId];
}

const PERIODS = ['week', 'month'];

/**
 * Haftalik/oylik hisoblagichlarni oshiradi. Davr kaliti eskirgan bo'lsa
 * (yangi hafta/oy boshlangan) avval nolga tushiriladi.
 */
function bumpPeriods(userData, { xp = 0, messages = 0, voice = 0 }) {
  const keys = levelCurve.periodKeys();
  if (!userData.periods) userData.periods = {};
  for (const period of PERIODS) {
    let entry = userData.periods[period];
    if (!entry || entry.key !== keys[period]) {
      entry = { key: keys[period], xp: 0, messages: 0, voice: 0 };
      userData.periods[period] = entry;
    }
    entry.xp += xp;
    entry.messages += messages;
    entry.voice += voice;
  }
}

/** Joriy davrdagi hisoblagichlar (eskirgan bo'lsa nollar) */
function periodStats(userData, period, keys) {
  const entry = userData?.periods?.[period];
  return entry && entry.key === keys[period] ? entry : { xp: 0, messages: 0, voice: 0 };
}

/** Jami XP ni o'rnatadi, darajani yangilaydi va faqat shu foydalanuvchi qatorini yozadi */
function setTotalXp(guildId, userId, userData, totalXp) {
  const oldLevel = levelCurve.levelFromXp(userData.totalXp);
  userData.totalXp = Math.max(0, Math.floor(totalXp));

  const p = levelCurve.progress(userData.totalXp);
  userData.level = p.level;

  scheduleLocalFlush();
  queueLevelWrite(guildId, userId);

  return {
    leveledUp: p.level > oldLevel,
    oldLevel,
    newLevel: p.level,
    currentXP: p.xp,
    requiredXP: p.requiredXP,
    remainingXP: p.remainingXP,
    totalXp: p.totalXp
  };
}

/** Faollik uchun XP qo'shadi */
function grantXp(guildId, userId, userData, earnedXP) {
  return { earnedXP, ...setTotalXp(guildId, userId, userData, (userData.totalXp || 0) + earnedXP) };
}

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
    migrateGuildLevels(guildId, settings);
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
    log.error('Lokal fayl o\'qishda xatolik:', err.message);
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
        log.error('Lokal fayl yozishda xatolik:', err.message);
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
    log.error('Yopilishda lokal fayl yozishda xatolik:', err.message);
  }
}

process.on('exit', flushLocalFileSync);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    // Avval bulutga yuborilmagan yozuvlarni tugatishga harakat qilamiz,
    // keyin lokal faylni saqlaymiz va chiqamiz.
    await drainSupabase(SHUTDOWN_DRAIN_MS);
    flushLocalFileSync();
    process.exit(0);
  });
}

// ===================== SUPABASE (WRITE-BEHIND NAVBAT) =====================

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

// ===================== JADVALLAR =====================
// guild_settings - sovuq konfiguratsiya (butun blob, kamdan-kam o'zgaradi)
// guild_levels / guild_activity / guild_warns - issiq ma'lumotlar.
// Ular alohida jadvalda bo'lgani uchun bitta XP yoki xabar hisoblagichi
// butun serverni emas, faqat o'z qatorini yozadi.
const TABLE_SETTINGS = 'guild_settings';
const TABLE_LEVELS = 'guild_levels';
const TABLE_ACTIVITY = 'guild_activity';
const TABLE_WARNS = 'guild_warns';

// Jadval mavjudligi init() da tekshiriladi. Yo'q bo'lsa (SQL hali
// ishlatilmagan) - o'sha ma'lumot eski usulda blobda saqlanadi.
const tableAvailable = {
  [TABLE_LEVELS]: false,
  [TABLE_ACTIVITY]: false,
  [TABLE_WARNS]: false
};

// guild_levels jadvali bor, lekin total_xp ustuni hali qo'shilmagan.
// Bunday holda eski qatorlar faqat o'qiladi (ko'chiriladi), yangi holat esa
// ustun qo'shilguncha blobda saqlanadi.
let legacyLevelsTable = false;

// guild_levels dagi ixtiyoriy ustunlar. Yo'q bo'lsa o'sha qiymat yozilmaydi
// (jadval rejimi buzilmaydi), faqat restartdan keyin nolga tushadi.
const levelOptionalColumns = {
  voice_minutes: false,
  periods: false
};

/**
 * guild_settings ga yoziladigan blob. Alohida jadvalga ko'chirilgan
 * bo'limlar blobdan chiqarib tashlanadi - shunda bitta XP tik butun
 * leveling.users lug'atini qayta yozmaydi.
 */
function settingsPayload(guildId) {
  const settings = memoryCache[guildId];
  if (!settings) return null;

  const payload = { ...settings };

  if (tableAvailable[TABLE_LEVELS]) {
    payload.leveling = { ...settings.leveling, users: {} };
  }
  if (tableAvailable[TABLE_ACTIVITY]) {
    payload.activeRole = { ...settings.activeRole, members: {} };
  }
  if (tableAvailable[TABLE_WARNS]) {
    payload.warns = {};
  }

  return payload;
}

function levelRow(guildId, userId) {
  const user = memoryCache[guildId]?.leveling?.users?.[userId];
  if (!user) return null;
  const p = levelCurve.progress(user.totalXp);
  const row = {
    guild_id: guildId,
    user_id: userId,
    total_xp: p.totalXp,
    // level va xp hisoblangan qiymatlar - o'qish qulayligi uchun saqlanadi
    xp: p.xp,
    level: p.level,
    messages: user.messages || 0,
    last_xp: user.lastXp || 0
  };
  if (levelOptionalColumns.voice_minutes) row.voice_minutes = user.voiceMinutes || 0;
  if (levelOptionalColumns.periods) row.periods = user.periods || {};
  return row;
}

function activityRow(guildId, userId) {
  const m = memoryCache[guildId]?.activeRole?.members?.[userId];
  if (!m) return null;
  return {
    guild_id: guildId,
    user_id: userId,
    today_voice_ms: m.todayVoiceMs || 0,
    voice_session_start: m.voiceSessionStart || null,
    today_messages: m.todayMessages || 0,
    activity_date: m.currentDate || null,
    last_active_date: m.lastActiveDate || null,
    has_role: Boolean(m.hasRole)
  };
}

function findWarn(guildId, warnId) {
  const warns = memoryCache[guildId]?.warns;
  if (!warns) return null;
  for (const [userId, list] of Object.entries(warns)) {
    const entry = list.find(w => w.id === warnId);
    if (entry) return { userId, entry };
  }
  return null;
}

function warnRow(guildId, warnId) {
  const found = findWarn(guildId, warnId);
  if (!found) return null;
  return {
    id: warnId,
    guild_id: guildId,
    user_id: found.userId,
    reason: found.entry.reason ?? null,
    moderator_id: found.entry.moderatorId ?? null,
    created_at: found.entry.date || new Date().toISOString()
  };
}

// Yuborilishi kutilayotgan o'zgarishlar. Faqat kalitlar saqlanadi - yuborish
// paytida memoryCache dan eng oxirgi holat o'qiladi, shuning uchun bir kalit
// uchun 1000 ta o'zgarish 1 ta yozuvga birlashadi.
//
// settings  -> guild_settings jadvali (sovuq konfiguratsiya, butun blob)
// levels    -> guild_levels jadvali   (har foydalanuvchi uchun 1 qator)
// activity  -> guild_activity jadvali (har foydalanuvchi uchun 1 qator)
// warns     -> guild_warns jadvali    (har ogohlantirish uchun 1 qator)
//
// Issiq (har xabarda o'zgaradigan) ma'lumotlar endi butun serverni emas,
// faqat o'z qatorini yozadi.
//
// MUHIM: leveling.users, activeRole.members va warns endi blob bilan birga
// yozilmaydi. Ularni faqat mutator orqali o'zgartirish kerak (addXP,
// updateMemberActivity, addWarn, removeUserWarn, clearUserWarns).
// getGuildSettings() qaytargan obyektni to'g'ridan-to'g'ri o'zgartirish
// xotirada ishlaydi, lekin hech qayerga saqlanmaydi.
const pendingSettings = new Set();          // guildId
const pendingLevels = new Map();            // guildId -> Set(userId)
const pendingActivity = new Map();          // guildId -> Set(userId)
const pendingWarnUpserts = new Map();       // guildId -> Set(warnId)
const pendingWarnDeletes = new Map();       // guildId -> Set(warnId)

let syncing = false;
let syncTimer = null;
let retryDelayMs = SUPABASE_RETRY_BASE_MS;

function addToIndex(index, guildId, key) {
  let set = index.get(guildId);
  if (!set) {
    set = new Set();
    index.set(guildId, set);
  }
  set.add(key);
}

function indexSize(index) {
  let n = 0;
  for (const set of index.values()) n += set.size;
  return n;
}

function pendingCount() {
  return pendingSettings.size
    + indexSize(pendingLevels)
    + indexSize(pendingActivity)
    + indexSize(pendingWarnUpserts)
    + indexSize(pendingWarnDeletes);
}

function describeQueue() {
  const n = pendingCount();
  return n === 0 ? null : `${n} ta o'zgarish navbatda`;
}

function noteSupabaseFailure(reason) {
  supabaseStatus.connected = false;
  const queued = describeQueue();
  supabaseStatus.message = queued
    ? `Ulanish uzilgan, qayta urinilmoqda (${queued}): ${reason}`
    : `Ulanish uzilgan, qayta urinilmoqda: ${reason}`;
}

function noteSupabaseSuccess() {
  supabaseStatus.connected = true;
  supabaseStatus.message = 'Muvaffaqiyatli ulandi (Faol)';
  retryDelayMs = SUPABASE_RETRY_BASE_MS;
}

function warnSupabaseError(message) {
  if (message && message.includes('row-level security')) {
    if (!rlsWarningLogged) {
      rlsWarningLogged = true;
      log.warn('⚠️ [SUPABASE RLS XATOSI]: guild_settings jadvalida Row Level Security (RLS) yoqilgan.');
      log.warn('💡 TEZ YECHIM: Supabase -> SQL Editor ga kirib quyidagi 1 qator kodni ishga tushiring (Run):');
      log.warn('   ALTER TABLE guild_settings DISABLE ROW LEVEL SECURITY;');
      log.warn('   Yoki Render ENV dagi SUPABASE_KEY ga "service_role" secret kalitini kiriting.');
    }
  } else {
    log.warn('[SUPABASE SAQLASH XATOSI]:', message);
  }
}

// Bitta navbat turini yuborishga tayyorlash: kalitlarni olib, qatorlarni yasaydi.
// buildRow null qaytarsa (masalan foydalanuvchi o'chirilgan) qator tashlanadi.
function takeIndex(index) {
  const taken = [];
  for (const [guildId, keys] of index) {
    for (const key of keys) taken.push([guildId, key]);
  }
  index.clear();
  return taken;
}

function restoreIndex(index, taken) {
  for (const [guildId, key] of taken) addToIndex(index, guildId, key);
}

async function runWrite(fn) {
  try {
    const { error } = await fn();
    return error ? (error.message || 'noma\'lum xatolik') : null;
  } catch (err) {
    return err.message;
  }
}

/**
 * Navbatdagi barcha o'zgarishlarni jadval bo'yicha guruhlab yuboradi.
 * Xatolik bo'lsa ular navbatda qoladi va kechikish ikki barobar oshiriladi.
 * Yozish davomida qayta navbatga tushganlari keyingi aylanishda yuboriladi.
 */
async function flushSupabase() {
  if (syncing || !supabase || pendingCount() === 0) return;
  syncing = true;
  try {
    let failure = null;

    // 0. Jadval endi mavjud emas bo'lsa (init qayta tekshirgan bo'lishi mumkin),
    //    navbatdagi qatorlarni blob yozuviga aylantiramiz - aks holda ular
    //    hech qachon yuborilmay navbatda qolib ketardi.
    for (const [index, table] of [
      [pendingLevels, TABLE_LEVELS],
      [pendingActivity, TABLE_ACTIVITY],
      [pendingWarnUpserts, TABLE_WARNS],
      [pendingWarnDeletes, TABLE_WARNS]
    ]) {
      if (!tableAvailable[table] && index.size > 0) {
        for (const guildId of index.keys()) pendingSettings.add(guildId);
        index.clear();
      }
    }

    // 1. Sovuq konfiguratsiya (butun blob)
    const settingsIds = [...pendingSettings];
    pendingSettings.clear();
    if (settingsIds.length > 0) {
      const rows = settingsIds
        .filter(id => memoryCache[id])
        .map(id => ({ guild_id: id, data: settingsPayload(id) }));
      if (rows.length > 0) {
        failure = await runWrite(() => supabase.from(TABLE_SETTINGS).upsert(rows));
        if (failure) for (const id of settingsIds) pendingSettings.add(id);
      }
    }

    // 2. Issiq jadvallar (har foydalanuvchi uchun alohida qator)
    if (!failure && tableAvailable[TABLE_LEVELS]) {
      const taken = takeIndex(pendingLevels);
      const rows = taken.map(([g, u]) => levelRow(g, u)).filter(Boolean);
      if (rows.length > 0) {
        failure = await runWrite(() => supabase.from(TABLE_LEVELS).upsert(rows));
        if (failure) restoreIndex(pendingLevels, taken);
      }
    }

    if (!failure && tableAvailable[TABLE_ACTIVITY]) {
      const taken = takeIndex(pendingActivity);
      const rows = taken.map(([g, u]) => activityRow(g, u)).filter(Boolean);
      if (rows.length > 0) {
        failure = await runWrite(() => supabase.from(TABLE_ACTIVITY).upsert(rows));
        if (failure) restoreIndex(pendingActivity, taken);
      }
    }

    if (!failure && tableAvailable[TABLE_WARNS]) {
      const taken = takeIndex(pendingWarnUpserts);
      const rows = taken.map(([g, w]) => warnRow(g, w)).filter(Boolean);
      if (rows.length > 0) {
        failure = await runWrite(() => supabase.from(TABLE_WARNS).upsert(rows));
        if (failure) restoreIndex(pendingWarnUpserts, taken);
      }

      if (!failure) {
        const deletes = takeIndex(pendingWarnDeletes);
        const ids = deletes.map(([, w]) => w);
        if (ids.length > 0) {
          failure = await runWrite(() => supabase.from(TABLE_WARNS).delete().in('id', ids));
          if (failure) restoreIndex(pendingWarnDeletes, deletes);
        }
      }
    }

    if (failure) {
      warnSupabaseError(failure);
      noteSupabaseFailure(failure);
      retryDelayMs = Math.min(retryDelayMs * 2, SUPABASE_RETRY_MAX_MS);
      scheduleSupabaseFlush(retryDelayMs);
    } else {
      // Muvaffaqiyat - ulanish qayta tiklangan bo'lsa ham holatni yangilaymiz
      // (init() da bir marta xato bo'lgani butun jarayonni o'ldirmasligi kerak).
      noteSupabaseSuccess();
      if (pendingCount() > 0) scheduleSupabaseFlush(SUPABASE_FLUSH_MS);
    }
  } finally {
    syncing = false;
  }
}

function scheduleSupabaseFlush(delay = SUPABASE_FLUSH_MS) {
  if (!supabase || syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    flushSupabase();
  }, delay);
  if (typeof syncTimer.unref === 'function') syncTimer.unref();
}

// Quyidagilar mutatorlardan chaqiriladi - sinxron qaytadi, tarmoqni kutmaydi.

function queueSettingsWrite(guildId) {
  if (!supabase) return;
  pendingSettings.add(guildId);
  scheduleSupabaseFlush();
}

function queueLevelWrite(guildId, userId) {
  if (!supabase) return;
  // Jadval yo'q bo'lsa bu ma'lumot blobda qoladi (eski usul).
  if (!tableAvailable[TABLE_LEVELS]) return queueSettingsWrite(guildId);
  addToIndex(pendingLevels, guildId, userId);
  scheduleSupabaseFlush();
}

function queueActivityWrite(guildId, userId) {
  if (!supabase) return;
  if (!tableAvailable[TABLE_ACTIVITY]) return queueSettingsWrite(guildId);
  addToIndex(pendingActivity, guildId, userId);
  scheduleSupabaseFlush();
}

function queueWarnWrite(guildId, warnId) {
  if (!supabase) return;
  if (!tableAvailable[TABLE_WARNS]) return queueSettingsWrite(guildId);
  addToIndex(pendingWarnUpserts, guildId, warnId);
  scheduleSupabaseFlush();
}

function queueWarnDelete(guildId, warnIds) {
  if (!supabase) return;
  if (!tableAvailable[TABLE_WARNS]) return queueSettingsWrite(guildId);
  for (const id of warnIds) {
    // Hali yuborilmagan yangi warn o'chirilsa, uni yuborishning hojati yo'q.
    const upserts = pendingWarnUpserts.get(guildId);
    if (upserts) upserts.delete(id);
    addToIndex(pendingWarnDeletes, guildId, id);
  }
  scheduleSupabaseFlush();
}

// ===================== AJRATILGAN JADVALLAR: TEKSHIRISH/YUKLASH/KO'CHIRISH =====

/**
 * Har bir jadvalga 1 qatorlik so'rov yuborib mavjudligini aniqlaydi.
 * Jadval yo'q bo'lsa tableAvailable false bo'lib qoladi va o'sha ma'lumot
 * eski usulda blobda saqlanaveradi (ishlayotgan bot buzilmaydi).
 */
async function probeSplitTables() {
  legacyLevelsTable = false;
  await Promise.all(Object.keys(tableAvailable).map(async (table) => {
    try {
      // guild_levels faqat total_xp ustuni bilan to'liq ishlatiladi
      const columns = table === TABLE_LEVELS ? 'guild_id, total_xp' : 'guild_id';
      const { error } = await supabase.from(table).select(columns).limit(1);
      tableAvailable[table] = !error;

      if (error && table === TABLE_LEVELS) {
        const { error: baseError } = await supabase.from(table).select('guild_id').limit(1);
        legacyLevelsTable = !baseError;
      }
      if (!error && table === TABLE_LEVELS) {
        await Promise.all(Object.keys(levelOptionalColumns).map(async (column) => {
          const { error: columnError } = await supabase.from(table).select(column).limit(1);
          levelOptionalColumns[column] = !columnError;
        }));
      }
    } catch {
      tableAvailable[table] = false;
    }
  }));
}

function describeSplitTables() {
  const on = Object.entries(tableAvailable).filter(([, v]) => v).map(([k]) => k);
  return on.length === 0 ? 'yo\'q (blob rejimi)' : on.join(', ');
}

/**
 * Mavjud jadvallardan barcha qatorlarni o'qib memoryCache ga joylaydi.
 * Xotiradagi shakl o'zgarmaydi - shuning uchun barcha o'qish funksiyalari
 * va chaqiruvchi kodlar aynan avvalgidek ishlayveradi.
 */
async function loadSplitTables() {
  const parts = [];

  if (tableAvailable[TABLE_LEVELS] || legacyLevelsTable) {
    const { data, error } = await supabase.from(TABLE_LEVELS).select('*');
    if (!error && data) {
      for (const r of data) {
        const g = normalizeGuild(r.guild_id);
        const isLegacy = r.total_xp === null || r.total_xp === undefined;
        const user = {
          totalXp: isLegacy
            ? levelCurve.totalXpFromLegacy(r.level, r.xp)
            : Number(r.total_xp) || 0,
          messages: r.messages || 0,
          voiceMinutes: Number(r.voice_minutes) || 0,
          periods: r.periods || {},
          lastXp: Number(r.last_xp) || 0
        };
        user.level = levelCurve.levelFromXp(user.totalXp);

        // Eski qator va blobda allaqachon ko'chirilgan yozuv bo'lsa, XP faqat
        // o'sadi - kattasi yangiroq.
        const existing = g.leveling.users[r.user_id];
        if (isLegacy && existing && (existing.totalXp || 0) >= user.totalXp) continue;

        g.leveling.users[r.user_id] = user;
        if (isLegacy) queueLevelWrite(r.guild_id, r.user_id);
      }
      parts.push(`${data.length} ta daraja yozuvi`);
    }
  }

  if (tableAvailable[TABLE_ACTIVITY]) {
    const { data, error } = await supabase.from(TABLE_ACTIVITY).select('*');
    if (!error && data) {
      for (const r of data) {
        const g = normalizeGuild(r.guild_id);
        g.activeRole.members[r.user_id] = {
          todayVoiceMs: Number(r.today_voice_ms) || 0,
          voiceSessionStart: r.voice_session_start ? Number(r.voice_session_start) : null,
          todayMessages: r.today_messages || 0,
          currentDate: r.activity_date || null,
          lastActiveDate: r.last_active_date || null,
          hasRole: Boolean(r.has_role)
        };
      }
      parts.push(`${data.length} ta faollik yozuvi`);
    }
  }

  if (tableAvailable[TABLE_WARNS]) {
    const { data, error } = await supabase.from(TABLE_WARNS).select('*');
    if (!error && data) {
      for (const r of data) {
        const g = normalizeGuild(r.guild_id);
        if (!g.warns[r.user_id]) g.warns[r.user_id] = [];
        g.warns[r.user_id].push({
          id: r.id,
          reason: r.reason,
          moderatorId: r.moderator_id,
          date: r.created_at
        });
      }
      // Ogohlantirishlar vaqt bo'yicha tartiblanishi kerak
      for (const guild of Object.values(memoryCache)) {
        for (const list of Object.values(guild.warns || {})) {
          list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        }
      }
      parts.push(`${data.length} ta ogohlantirish`);
    }
  }

  return parts.length ? `Yuklandi: ${parts.join(', ')}` : null;
}

/**
 * Blobda qolgan (eski deploylardan kelgan) issiq ma'lumotlarni yangi
 * jadvallarga navbatga qo'yadi. Xotiradagi nusxa allaqachon to'g'ri -
 * faqat yozib qo'yish kerak. Idempotent: ko'chirilgach blob bo'shaydi.
 */
function migrateBlobToSplitTables() {
  if (!supabase) return;
  let moved = 0;

  for (const [guildId, settings] of Object.entries(memoryCache)) {
    if (tableAvailable[TABLE_LEVELS]) {
      for (const userId of Object.keys(settings.leveling?.users || {})) {
        queueLevelWrite(guildId, userId);
        moved++;
      }
    }
    if (tableAvailable[TABLE_ACTIVITY]) {
      for (const userId of Object.keys(settings.activeRole?.members || {})) {
        queueActivityWrite(guildId, userId);
        moved++;
      }
    }
    if (tableAvailable[TABLE_WARNS]) {
      for (const list of Object.values(settings.warns || {})) {
        for (const w of list) {
          queueWarnWrite(guildId, w.id);
          moved++;
        }
      }
    }
    // Blobdan issiq bo'limlarni tozalab qayta yozamiz
    if (moved > 0) queueSettingsWrite(guildId);
  }

  if (moved > 0) {
    log.banner(`🔄 ${moved} ta issiq yozuv blobdan ajratilgan jadvallarga ko'chirilmoqda...`);
  }
}

/**
 * Jarayon yopilishidan oldin navbatni bo'shatishga urinish.
 * Belgilangan vaqtdan oshsa, qolgani lokal faylda saqlanib qoladi.
 */
async function drainSupabase(timeoutMs) {
  if (!supabase || (pendingCount() === 0 && !syncing)) return;

  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  const deadline = Date.now() + timeoutMs;
  while ((pendingCount() > 0 || syncing) && Date.now() < deadline) {
    // flushSupabase xatolik bo'lsa yangi timer qo'yadi - drain o'zi
    // boshqarayotgani uchun uni bekor qilamiz.
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    await flushSupabase();
    if (pendingCount() > 0) {
      // Xatolik bo'ldi - qisqa kutib qayta urinamiz (deadline gacha)
      await new Promise(r => setTimeout(r, 250));
    }
  }

  if (pendingCount() > 0) {
    log.warn(`⚠️ Yopilishda ${pendingCount()} ta o'zgarish bulutga yuborilmadi (lokal faylda saqlandi).`);
  }
}

module.exports = {
  getSupabaseStatus() {
    return {
      ...supabaseStatus,
      pending: pendingCount(),
      splitTables: {
        levels: tableAvailable[TABLE_LEVELS],
        activity: tableAvailable[TABLE_ACTIVITY],
        warns: tableAvailable[TABLE_WARNS]
      }
    };
  },

  // Test va yopilish uchun: navbatni darhol bo'shatish
  flushPendingWrites(timeoutMs = SHUTDOWN_DRAIN_MS) {
    return drainSupabase(timeoutMs);
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
      log.banner('====================================================');
      log.banner('🗄️ SUPABASE BAZASI HOLATI:');
      log.banner('❌ ULANMADI: SUPABASE_URL yoki SUPABASE_KEY kiritilmagan!');
      log.banner('⚠️ Bot vaqtinchalik lokal xotira (JSON) rejimida ishlamoqda.');
      log.banner('💡 Render ENV ga kalitlarni kiritsangiz, sozlamalar abadiy saqlanadi.');
      log.banner('====================================================');
      for (const guildId of Object.keys(memoryCache)) normalizeGuild(guildId);
      return;
    }

    // 3. Supabase ga ulanishni tekshirish va ma'lumotlarni tortib olish
    try {
      log.banner('⏳ Supabase ga ulanilmoqda va ma\'lumotlar tekshirilmoqda...');
      const { data, error } = await supabase
        .from('guild_settings')
        .select('guild_id, data');

      if (error) {
        supabaseStatus.connected = false;
        supabaseStatus.message = `Xatolik: ${error.message}`;
        log.banner('====================================================');
        log.banner('🗄️ SUPABASE BAZASI HOLATI:');
        log.banner(`⚠️ ULANISHDA XATOLIK: ${error.message}`);
        log.banner('💡 Iltimos, Supabase SQL Editor da jadval yaratilganini tekshiring:');
        log.banner('   CREATE TABLE guild_settings (guild_id TEXT PRIMARY KEY, data JSONB);');
        log.banner('====================================================');
      } else {
        noteSupabaseSuccess();
        const count = data ? data.length : 0;

        if (data && data.length > 0) {
          data.forEach(row => {
            if (row.guild_id && row.data) {
              memoryCache[row.guild_id] = row.data;
            }
          });
          scheduleLocalFlush();
        }

        // 3.1. Ajratilgan jadvallarni tekshirish va yuklash
        await probeSplitTables();
        const loaded = await loadSplitTables();

        log.banner('====================================================');
        log.banner('🗄️ SUPABASE BAZASI HOLATI:');
        log.banner('✅ ULANDI: Supabase bulutli bazasiga muvaffaqiyatli ulandi!');
        log.banner(`🔗 Manzil: ${supabaseUrl}`);
        log.banner(`📊 Saqlangan serverlar soni: ${count} ta`);
        log.banner(`📇 Ajratilgan jadvallar: ${describeSplitTables()}`);
        if (loaded) log.banner(`   ${loaded}`);
        log.banner('🔒 Deploy bo\'lganda ham sozlamalar va ticketlar saqlanadi.');
        log.banner('====================================================');

        if (legacyLevelsTable) {
          log.warn('💡 guild_levels jadvalida total_xp ustuni yo\'q - daraja ma\'lumotlari vaqtincha blobda saqlanmoqda.');
          log.warn('   Supabase SQL Editor da ishga tushiring:');
          log.warn('   ALTER TABLE guild_levels ADD COLUMN IF NOT EXISTS total_xp bigint;');
        }
        const missingLevelColumns = Object.keys(levelOptionalColumns).filter(c => !levelOptionalColumns[c]);
        if (tableAvailable[TABLE_LEVELS] && missingLevelColumns.length > 0) {
          log.warn(`💡 guild_levels jadvalida ${missingLevelColumns.join(', ')} ustuni yo'q - bu qiymat restartdan keyin saqlanmaydi.`);
          if (!levelOptionalColumns.voice_minutes) log.warn('   ALTER TABLE guild_levels ADD COLUMN IF NOT EXISTS voice_minutes integer not null default 0;');
          if (!levelOptionalColumns.periods) log.warn('   ALTER TABLE guild_levels ADD COLUMN IF NOT EXISTS periods jsonb;');
        }
        if (!tableAvailable[TABLE_LEVELS] || !tableAvailable[TABLE_ACTIVITY] || !tableAvailable[TABLE_WARNS]) {
          log.warn('💡 Issiq ma\'lumotlar hali guild_settings blobida saqlanmoqda.');
          log.warn('   Tezlik uchun README dagi "Ajratilgan jadvallar" SQL bloki ishga tushirilsin.');
        }
      }
    } catch (err) {
      supabaseStatus.connected = false;
      supabaseStatus.message = `Ulanish istisnosi: ${err.message}`;
      log.banner('====================================================');
      log.banner('🗄️ SUPABASE BAZASI HOLATI:');
      log.banner(`❌ KUTILMAGAN XATOLIK: ${err.message}`);
      log.banner('====================================================');
    }

    // 4. Barcha yuklangan serverlarni bir marta standartlar bilan to'ldirish
    for (const guildId of Object.keys(memoryCache)) normalizeGuild(guildId);

    // 5. Blobda qolgan issiq ma'lumotlarni yangi jadvallarga ko'chirish
    migrateBlobToSplitTables();

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
    queueSettingsWrite(guildId);

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
    // Butun serverni emas, faqat shu bitta ogohlantirishni yozamiz
    scheduleLocalFlush();
    queueWarnWrite(guildId, warnEntry.id);

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
    scheduleLocalFlush();
    queueWarnDelete(guildId, [removed.id]);
    return removed;
  },

  clearUserWarns(guildId, userId) {
    const guildSettings = normalizeGuild(guildId);
    if (!guildSettings.warns[userId]) return 0;

    const count = guildSettings.warns[userId].length;
    const removedIds = guildSettings.warns[userId].map(w => w.id);
    guildSettings.warns[userId] = [];
    scheduleLocalFlush();
    queueWarnDelete(guildId, removedIds);
    return count;
  },

  incrementTicketCounter(guildId) {
    const guildSettings = normalizeGuild(guildId);
    guildSettings.ticketCounter = (guildSettings.ticketCounter || 0) + 1;
    this.updateGuildSettings(guildId, { ticketCounter: guildSettings.ticketCounter });
    return guildSettings.ticketCounter;
  },

  /**
   * Xabar uchun XP beradi. eligible=false bo'lsa (spam filtridan o'tmagan
   * xabar) faqat xabar hisoblagichi oshadi. XP berilmasa null qaytaradi.
   */
  addXP(guildId, userId, { eligible = true, multiplier = 1 } = {}) {
    const settings = normalizeGuild(guildId);
    if (!settings.leveling.enabled) return null;

    const userData = levelUser(settings, userId);
    const now = Date.now();
    userData.messages = (userData.messages || 0) + 1;
    bumpPeriods(userData, { messages: 1 });

    if (!eligible || multiplier <= 0) return null;

    // Anti-spam cooldown (bir daqiqada 1 marta XP)
    const { min, max, cooldownMs } = levelCurve.MESSAGE_XP;
    if (now - (userData.lastXp || 0) < cooldownMs) return null;

    userData.lastXp = now;
    const earnedXP = Math.round((Math.floor(Math.random() * (max - min + 1)) + min) * multiplier);
    bumpPeriods(userData, { xp: earnedXP });
    return grantXp(guildId, userId, userData, earnedXP);
  },

  /** Ovozli xonada o'tkazilgan 1 daqiqa uchun XP beradi */
  addVoiceXP(guildId, userId, { multiplier = 1 } = {}) {
    const settings = normalizeGuild(guildId);
    if (!settings.leveling.enabled || settings.leveling.voiceXp === false) return null;
    if (multiplier <= 0) return null;

    const userData = levelUser(settings, userId);
    const earnedXP = Math.round(levelCurve.VOICE_XP.perMinute * multiplier);
    userData.voiceMinutes = (userData.voiceMinutes || 0) + 1;
    bumpPeriods(userData, { xp: earnedXP, voice: 1 });
    return grantXp(guildId, userId, userData, earnedXP);
  },

  /** leveling sozlamalarining bir qismini yangilaydi (users dan tashqari) */
  updateLevelingSettings(guildId, patch) {
    const leveling = normalizeGuild(guildId).leveling;
    this.updateGuildSettings(guildId, { leveling: { ...leveling, ...patch } });
    return normalizeGuild(guildId).leveling;
  },

  /**
   * isMember berilsa (id => boolean), serverdan chiqib ketganlar o'rinni
   * hisoblashda e'tiborga olinmaydi.
   */
  getUserLevel(guildId, userId, { isMember = null } = {}) {
    const settings = normalizeGuild(guildId);
    const enabled = Boolean(settings.leveling.enabled);
    const userData = settings.leveling.users[userId];
    const totalXp = userData?.totalXp || 0;
    const p = levelCurve.progress(totalXp);

    // O'rinni bitta o'tishda hisoblash (butun ro'yxatni saralamasdan).
    // Hali XP to'plamagan a'zo reytingda yo'q (rank: null).
    let rank = null;
    if (totalXp > 0) {
      let ahead = 0;
      for (const [id, data] of Object.entries(settings.leveling.users)) {
        if (id === userId || (data.totalXp || 0) <= totalXp) continue;
        if (isMember && !isMember(id)) continue;
        ahead++;
      }
      rank = ahead + 1;
    }

    return {
      level: p.level,
      xp: p.xp,
      requiredXP: p.requiredXP,
      remainingXP: p.remainingXP,
      totalXp,
      messages: userData?.messages || 0,
      voiceMinutes: userData?.voiceMinutes || 0,
      rank,
      enabled
    };
  },

  /**
   * To'liq saralangan reyting (sahifalash chaqiruvchida).
   * period: 'all' | 'month' | 'week'; type: 'xp' | 'messages' | 'voice'.
   * Har bir yozuvda value - tanlangan ko'rsatkich qiymati.
   */
  getLeaderboard(guildId, { period = 'all', type = 'xp', isMember = null } = {}) {
    const settings = normalizeGuild(guildId);
    const enabled = Boolean(settings.leveling.enabled);
    const keys = levelCurve.periodKeys();

    const valueOf = (data) => {
      if (period === 'all') {
        if (type === 'messages') return data.messages || 0;
        if (type === 'voice') return data.voiceMinutes || 0;
        return data.totalXp || 0;
      }
      const stats = periodStats(data, period, keys);
      return type === 'messages' ? stats.messages : type === 'voice' ? stats.voice : stats.xp;
    };

    const list = Object.entries(settings.leveling.users)
      .filter(([id]) => !isMember || isMember(id))
      .map(([id, data]) => ({
        id,
        value: valueOf(data),
        level: levelCurve.levelFromXp(data.totalXp),
        totalXp: data.totalXp || 0
      }))
      .filter(entry => entry.value > 0)
      .sort((a, b) => b.value - a.value || b.totalXp - a.totalXp);

    return { list, enabled };
  },

  /**
   * Admin XP o'zgartirishi. op: 'give' | 'remove' | 'set' (amount - jami XP).
   * Haftalik/oylik reytingga ta'sir qilmaydi - ular faqat faollikni ko'rsatadi.
   */
  adjustXP(guildId, userId, op, amount) {
    const settings = normalizeGuild(guildId);
    const userData = levelUser(settings, userId);
    const current = userData.totalXp || 0;
    const target = op === 'give' ? current + amount : op === 'remove' ? current - amount : amount;
    return setTotalXp(guildId, userId, userData, target);
  },

  /** Bitta a'zoning XP, hisoblagich va davrlarini nolga tushiradi */
  resetUserLevel(guildId, userId) {
    const settings = normalizeGuild(guildId);
    const userData = settings.leveling.users[userId];
    if (!userData) return false;
    Object.assign(userData, { messages: 0, voiceMinutes: 0, periods: {} });
    setTotalXp(guildId, userId, userData, 0);
    return true;
  },

  /** Serverdagi barcha a'zolarning darajasini nolga tushiradi. Soni qaytadi. */
  resetAllLevels(guildId) {
    const settings = normalizeGuild(guildId);
    let count = 0;
    for (const userId of Object.keys(settings.leveling.users)) {
      if (this.resetUserLevel(guildId, userId)) count++;
    }
    return count;
  },

  getLevelRewards(guildId) {
    const leveling = normalizeGuild(guildId).leveling;
    return {
      rewards: leveling.rewards,
      mode: leveling.rewardMode === 'highest' ? 'highest' : 'stack'
    };
  },

  /** Darajaga rol mukofotini biriktiradi. Bir daraja - bir rol, bir rol - bir daraja. */
  setLevelReward(guildId, level, roleId) {
    const leveling = normalizeGuild(guildId).leveling;
    const rewards = leveling.rewards
      .filter(r => r.level !== level && r.roleId !== roleId)
      .concat({ level, roleId })
      .sort((a, b) => a.level - b.level);
    this.updateGuildSettings(guildId, { leveling: { ...leveling, rewards } });
    return rewards;
  },

  /** Mukofotni daraja yoki rol bo'yicha o'chiradi. O'chirilganini qaytaradi (yoki null). */
  removeLevelReward(guildId, { level = null, roleId = null }) {
    const leveling = normalizeGuild(guildId).leveling;
    const removed = leveling.rewards.find(r => r.level === level || r.roleId === roleId) || null;
    if (!removed) return null;
    const rewards = leveling.rewards.filter(r => r !== removed);
    this.updateGuildSettings(guildId, { leveling: { ...leveling, rewards } });
    return removed;
  },

  setLevelRewardMode(guildId, mode) {
    const leveling = normalizeGuild(guildId).leveling;
    this.updateGuildSettings(guildId, { leveling: { ...leveling, rewardMode: mode } });
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

    // Faqat shu a'zoning qatori yoziladi
    scheduleLocalFlush();
    queueActivityWrite(guildId, userId);
    return members[userId];
  },

  getAllActiveMembers(guildId) {
    return normalizeGuild(guildId).activeRole.members;
  }
};
