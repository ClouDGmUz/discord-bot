module.exports = {
  name: 'guildCreate',
  async execute(guild) {
    const allowedGuildId = process.env.ALLOWED_GUILD_ID || process.env.GUILD_ID;

    // Agar maxsus server ID belgilangan bo'lsa va bu boshqa server bo'lsa
    if (allowedGuildId && allowedGuildId.trim() !== '') {
      if (guild.id !== allowedGuildId.trim()) {
        console.warn(`[XAVFSIZLIK] Bot ruxsatsiz serverga (${guild.name} | ${guild.id}) qo'shildi. Avtomatik chiqib ketilmoqda...`);
        try {
          await guild.leave();
        } catch (err) {
          console.error(`Serverdan chiqishda xatolik (${guild.name}):`, err.message);
        }
      }
    }
  }
};
