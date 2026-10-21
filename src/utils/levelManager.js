const { EmbedBuilder } = require('discord.js');
const storage = require('../config/storage');
const levelCurve = require('./levelCurve');
const log = require('./log');

// Rasm/stikersiz xabar XP olishi uchun kerakli minimal uzunlik
const MIN_CONTENT_LENGTH = 5;

// Har bir a'zoning oxirgi xabari (takroriy xabarlarga XP bermaslik uchun).
// key: `${guildId}_${userId}`, value: normallashtirilgan matn
const lastContent = new Map();

// Bir xil ierarxiya ogohlantirishini har xabarda takrorlamaslik uchun
const warnedRoles = new Set();

function isAssignable(role, guild) {
  if (role.editable) return true;
  const warnKey = `${guild.id}_${role.id}`;
  if (!warnedRoles.has(warnKey)) {
    warnedRoles.add(warnKey);
    log.warn(`Daraja mukofoti "${role.name}" (${guild.name}) berilmadi: bot roli undan pastda yoki "Manage Roles" ruxsati yo'q.`);
  }
  return false;
}

function normalizeContent(content) {
  return (content || '')
    .replace(/<a?:\w+:\d+>/g, 'e') // maxsus emoji - bitta belgi sifatida
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Xabar XP olishga loyiqmi: juda qisqa (rasm/stikersiz) yoki oldingi
 * xabarning aynan takrori bo'lsa - yo'q.
 */
function isXpEligible(message) {
  const text = normalizeContent(message.content);
  const hasMedia = message.attachments.size > 0 || message.stickers.size > 0;

  const key = `${message.guild.id}_${message.author.id}`;
  const previous = lastContent.get(key);
  lastContent.set(key, text);

  if (!hasMedia && text.length < MIN_CONTENT_LENGTH) return false;
  if (text && text === previous) return false;
  return true;
}

/**
 * A'zoning rollarini darajasiga moslaydi va yangi berilgan rollarni qaytaradi.
 * 'stack' rejimida qo'lga kiritilgan barcha mukofotlar beriladi, 'highest'
 * rejimida faqat eng yuqorisi qoladi. Darajadan yuqori mukofot rollari
 * (masalan qo'lda berilgan) odatda olib tashlanmaydi - faqat admin XP ni
 * kamaytirganda (removeAbove: true).
 * Rollar to'g'ri bo'lsa API ga murojaat qilinmaydi.
 */
async function syncLevelRoles(member, level, { removeAbove = false } = {}) {
  if (!member || member.user.bot) return [];

  const guild = member.guild;
  const { rewards, mode } = storage.getLevelRewards(guild.id);
  if (rewards.length === 0) return [];

  // Bot bera olmaydigan rollar (ierarxiya/ruxsat) hisobga olinmaydi - aks
  // holda 'highest' rejimida a'zo pastki rolni yo'qotib, yangisini olmasdi.
  const earned = rewards
    .filter(r => r.level <= level)
    .map(r => guild.roles.cache.get(r.roleId))
    .filter(role => role && isAssignable(role, guild));
  const keep = mode === 'highest' ? earned.slice(-1) : earned;
  const keepIds = new Set(keep.map(role => role.id));

  const toAdd = keep.filter(role => !member.roles.cache.has(role.id));
  const toRemove = earned.filter(role => !keepIds.has(role.id) && member.roles.cache.has(role.id));
  if (removeAbove) {
    for (const r of rewards) {
      if (r.level <= level || !member.roles.cache.has(r.roleId)) continue;
      const role = guild.roles.cache.get(r.roleId);
      if (role && isAssignable(role, guild)) toRemove.push(role);
    }
  }

  try {
    if (toAdd.length > 0) await member.roles.add(toAdd, `Cleva Leveling: ${level}-daraja mukofoti`);
    if (toRemove.length > 0) await member.roles.remove(toRemove, 'Cleva Leveling: daraja mukofoti yangilandi');
  } catch (err) {
    log.warn('Daraja mukofotini berishda xatolik:', err.message);
    return [];
  }

  return toAdd;
}

// ===================== SERVER A'ZOLARI (CHIQIB KETGANLARNI YASHIRISH) =====

const MEMBER_FETCH_INTERVAL_MS = 10 * 60 * 1000;
const lastMemberFetch = new Map(); // guildId -> vaqt (ms)

/**
 * Reyting uchun a'zo filtri: id => serverda bormi. A'zolar keshi to'liq
 * bo'lmasa bir marta yuklanadi (har server uchun 10 daqiqada ko'pi bilan 1 marta).
 * Yuklab bo'lmasa null qaytadi - filtrsiz ko'rsatish, haqiqiy a'zolarni
 * noto'g'ri yashirgandan yaxshiroq.
 */
async function getMemberFilter(guild) {
  const isMember = id => guild.members.cache.has(id);
  if (guild.members.cache.size >= guild.memberCount) return isMember;

  const last = lastMemberFetch.get(guild.id) || 0;
  if (Date.now() - last >= MEMBER_FETCH_INTERVAL_MS) {
    lastMemberFetch.set(guild.id, Date.now());
    try {
      await guild.members.fetch({ time: 15000 });
      return isMember;
    } catch (err) {
      log.warn(`A'zolarni yuklashda xatolik (${guild.name}):`, err.message);
      return null;
    }
  }

  // Yaqinda yuklangan: kesh deyarli to'liq (keyin qo'shilganlar guildMemberAdd orqali keladi)
  return guild.members.cache.size >= guild.memberCount * 0.95 ? isMember : null;
}

/**
 * Daraja ko'tarilganini e'lon qiladi: sozlangan kanalga, bo'lmasa
 * fallbackChannel ga (xabar yozilgan chat yoki ovozli xonaning chati).
 */
async function announceLevelUp(guild, user, fallbackChannel, result, newRoles) {
  const leveling = storage.getGuildSettings(guild.id).leveling;
  const targetChannel = leveling.channelId
    ? guild.channels.cache.get(leveling.channelId)
    : fallbackChannel;
  if (!targetChannel || !targetChannel.isTextBased()) return;

  let description = `Ajoyib faollik, ${user}! Siz **${result.newLevel}-darajaga** erishdingiz! 🚀`;
  if (newRoles.length > 0) {
    description += `\n\n🎁 **Yangi rol:** ${newRoles.map(role => `${role}`).join(', ')}`;
  }

  const levelEmbed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('🎉 Daraja Ko\'tarildi!')
    .setDescription(description)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `Cleva Leveling • Keyingi darajagacha: ${result.remainingXP} XP` })
    .setTimestamp();

  await targetChannel.send({ embeds: [levelEmbed] }).catch(() => {});
}

/** messageCreate dan chaqiriladi (tizim yoqilgan bo'lsa) */
async function handleMessageXp(message) {
  const result = storage.addXP(message.guild.id, message.author.id, {
    eligible: isXpEligible(message)
  });
  if (!result) return;

  // Har XP da tekshiriladi: keyin qo'shilgan mukofotlar ham a'zo keyingi
  // safar XP olganda beriladi (rollar to'g'ri bo'lsa hech narsa qilinmaydi).
  const newRoles = await syncLevelRoles(message.member, result.newLevel);

  if (result.leveledUp) await announceLevelUp(message.guild, message.author, message.channel, result, newRoles);
}

/** Serverga qayta qo'shilgan a'zoga daraja rollarini qaytaradi */
async function restoreLevelRoles(member) {
  const settings = storage.getGuildSettings(member.guild.id);
  const leveling = settings.leveling;
  if (!leveling.enabled) return;

  // Tekshiruv (verify) yoqilgan bo'lsa, mukofot rollari tekshiruvni chetlab
  // o'tmasligi kerak - ular a'zo keyingi XP olganda beriladi.
  const verification = settings.verification;
  if (verification?.enabled && verification.roleId && !member.roles.cache.has(verification.roleId)) return;

  const totalXp = leveling.users[member.id]?.totalXp || 0;
  if (totalXp <= 0) return;

  await syncLevelRoles(member, levelCurve.levelFromXp(totalXp));
}

// ===================== OVOZLI XONA XP SI =====================

const VOICE_TICK_MS = 60 * 1000;

/**
 * Ovozdagi a'zo shu daqiqa uchun XP olishga loyiqmi: AFK xonada emas,
 * mikrofoni va quloqchini yoqiq (o'zi ham, server ham o'chirmagan) va
 * xonada o'zidan tashqari kamida yana bitta odam (bot emas) bor.
 */
function isVoiceXpEligible(state, humansInChannel) {
  if (!state.channelId || !state.member || state.member.user.bot) return false;
  if (state.channelId === state.guild.afkChannelId) return false;
  if (state.mute || state.deaf || state.suppress) return false;
  return humansInChannel >= 2;
}

async function awardVoiceXpForGuild(guild) {
  const leveling = storage.getGuildSettings(guild.id).leveling;
  if (!leveling.enabled || leveling.voiceXp === false) return;

  const states = [...guild.voiceStates.cache.values()].filter(s => s.channelId);
  if (states.length < 2) return;

  const humansPerChannel = new Map();
  for (const state of states) {
    if (state.member && !state.member.user.bot) {
      humansPerChannel.set(state.channelId, (humansPerChannel.get(state.channelId) || 0) + 1);
    }
  }

  for (const state of states) {
    if (!isVoiceXpEligible(state, humansPerChannel.get(state.channelId) || 0)) continue;

    const result = storage.addVoiceXP(guild.id, state.id);
    if (!result) continue;

    // Bitta a'zodagi xatolik qolganlarning XP siga to'sqinlik qilmasin
    try {
      const newRoles = await syncLevelRoles(state.member, result.newLevel);
      if (result.leveledUp) {
        await announceLevelUp(guild, state.member.user, state.channel, result, newRoles);
      }
    } catch (err) {
      log.warn('Ovozli XP: daraja mukofoti/e\'lonida xatolik:', err.message);
    }
  }
}

/**
 * Har daqiqada ovozdagi a'zolarga XP beradi. Sessiya oxirida emas, har
 * daqiqada hisoblanadi: restart/deploy da ko'pi bilan 1 daqiqa yo'qoladi va
 * a'zo ovozda o'tirgan holda daraja ko'tarishi mumkin.
 */
function startVoiceXpTicker(client) {
  const tick = async () => {
    for (const guild of client.guilds.cache.values()) {
      await awardVoiceXpForGuild(guild).catch(err => {
        log.error('[VOICE XP ERROR]:', err.message);
      });
    }
  };
  const timer = setInterval(tick, VOICE_TICK_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = {
  isXpEligible,
  syncLevelRoles,
  handleMessageXp,
  restoreLevelRoles,
  getMemberFilter,
  isVoiceXpEligible,
  awardVoiceXpForGuild,
  startVoiceXpTicker
};
