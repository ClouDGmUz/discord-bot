const { ActivityType, Routes } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    const inviteLink = process.env.SERVER_INVITE_URL || 'https://discord.gg/fwVyfrtP4h';

    console.log(`========================================`);
    console.log(`🤖 Cleva boti muvaffaqiyatli ishga tushdi: ${client.user.tag}`);
    console.log(`🌐 Serverlar soni: ${client.guilds.cache.size}`);
    console.log(`🔗 Asosiy server havolasi: ${inviteLink}`);
    console.log(`========================================`);

    // 1. Bot statusi (Presence - ismning pastida ko'rinadi)
    client.user.setPresence({
      activities: [
        {
          name: 'custom',
          type: ActivityType.Custom,
          state: `🔗 Serverimiz: ${inviteLink}`
        }
      ],
      status: 'online'
    });

    // 2. Botning rasmiy profil tavsifini (About Me / Bio) avtomatik yangilash
    try {
      await client.rest.patch(Routes.currentApplication(), {
        body: {
          description: `🤖 Cleva — Server nazorati, moderatsiya, ticket tizimi va ko'p funksiyali yordamchi bot!\n\n👑 Bizning rasmiy serverimizga qo'shiling:\n👉 ${inviteLink}`
        }
      }).catch(err => {
        console.log('Bio yangilash (ixtiyoriy):', err.message);
      });
    } catch (e) {
      // Ignorlash
    }
  }
};
