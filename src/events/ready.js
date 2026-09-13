const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`========================================`);
    console.log(`🤖 Cleva boti muvaffaqiyatli ishga tushdi: ${client.user.tag}`);
    console.log(`🌐 Serverlar soni: ${client.guilds.cache.size}`);
    console.log(`========================================`);

    // Bot holati (Presence)
    client.user.setPresence({
      activities: [{ name: '/help | Cleva Nazorati', type: ActivityType.Custom }],
      status: 'online'
    });
  }
};
