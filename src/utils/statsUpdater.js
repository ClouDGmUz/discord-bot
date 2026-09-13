const storage = require('../config/storage');

async function updateGuildStats(guild) {
  if (!guild) return;

  const settings = storage.getGuildSettings(guild.id);
  if (!settings.stats || !settings.stats.enabled) return;

  const { totalChannelId, membersChannelId, botsChannelId } = settings.stats;
  if (!totalChannelId && !membersChannelId && !botsChannelId) return;

  try {
    // A'zolarni to'liq keshga olish
    await guild.members.fetch().catch(() => {});

    const total = guild.memberCount || guild.members.cache.size;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = Math.max(0, total - bots);

    // 1. Jami A'zolar
    if (totalChannelId) {
      const ch = guild.channels.cache.get(totalChannelId);
      if (ch) {
        const expectedName = `👥・Jami A'zolar: ${total}`;
        if (ch.name !== expectedName) {
          await ch.setName(expectedName).catch(() => {});
        }
      }
    }

    // 2. Oddiy A'zolar (Odamlar)
    if (membersChannelId) {
      const ch = guild.channels.cache.get(membersChannelId);
      if (ch) {
        const expectedName = `👤・A'zolar: ${humans}`;
        if (ch.name !== expectedName) {
          await ch.setName(expectedName).catch(() => {});
        }
      }
    }

    // 3. Botlar
    if (botsChannelId) {
      const ch = guild.channels.cache.get(botsChannelId);
      if (ch) {
        const expectedName = `🤖・Botlar: ${bots}`;
        if (ch.name !== expectedName) {
          await ch.setName(expectedName).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error(`[STATS YANGILASH XATOSI (${guild.name})]:`, err.message);
  }
}

module.exports = {
  updateGuildStats
};
