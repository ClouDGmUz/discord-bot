const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'settings.json');

// Papka va fayl mavjudligini tekshirish va yaratish
function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readData() {
  try {
    ensureFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Baza o\'qishda xatolik:', err);
    return {};
  }
}

function writeData(data) {
  try {
    ensureFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Baza yozishda xatolik:', err);
    return false;
  }
}

module.exports = {
  getGuildSettings(guildId) {
    const data = readData();
    return (
      data[guildId] || {
        logChannelId: null,
        welcomeChannelId: null,
        welcomeMessage: 'Xush kelibsiz, {user}! Siz serverimizning {memberCount}-a\'zosisiz 🎉',
        welcomeEnabled: false,
        warns: {}
      }
    );
  },

  updateGuildSettings(guildId, newSettings) {
    const data = readData();
    const current = data[guildId] || {
      logChannelId: null,
      welcomeChannelId: null,
      welcomeMessage: 'Xush kelibsiz, {user}! Siz serverimizning {memberCount}-a\'zosisiz 🎉',
      welcomeEnabled: false,
      warns: {}
    };

    data[guildId] = {
      ...current,
      ...newSettings
    };

    writeData(data);
    return data[guildId];
  },

  addWarn(guildId, userId, reason, moderatorId) {
    const data = readData();
    if (!data[guildId]) {
      data[guildId] = {
        logChannelId: null,
        welcomeChannelId: null,
        welcomeMessage: 'Xush kelibsiz, {user}! Siz serverimizning {memberCount}-a\'zosisiz 🎉',
        welcomeEnabled: false,
        warns: {}
      };
    }
    if (!data[guildId].warns) data[guildId].warns = {};
    if (!data[guildId].warns[userId]) data[guildId].warns[userId] = [];

    const warnEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      reason,
      moderatorId,
      date: new Date().toISOString()
    };

    data[guildId].warns[userId].push(warnEntry);
    writeData(data);
    return {
      warn: warnEntry,
      totalWarns: data[guildId].warns[userId].length
    };
  },

  getUserWarns(guildId, userId) {
    const data = readData();
    if (!data[guildId] || !data[guildId].warns || !data[guildId].warns[userId]) {
      return [];
    }
    return data[guildId].warns[userId];
  }
};
