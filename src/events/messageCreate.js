const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../config/storage');
const logger = require('../utils/logger');

const LINK_REGEX = /(https?:\/\/[^\s]+)|(discord\.(gg|io|me|li)\/[^\s]+)|(discord\.com\/invite\/[^\s]+)/i;

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const guild = message.guild;
    const settings = storage.getGuildSettings(guild.id);

    // 1. ANTI-LINK VA ANTI-INVITE TEKSHIRUVI
    if (settings.antiLinkEnabled !== false) {
      const member = message.member;
      const isOwner = process.env.OWNER_ID && message.author.id === process.env.OWNER_ID.trim();
      const isStaff = member && (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)
      );

      if (!isOwner && !isStaff) {
        const match = message.content.match(LINK_REGEX);
        if (match) {
          try {
            await message.delete().catch(() => {});

            const warnMsg = await message.channel.send({
              content: `⚠️ ${message.author}, bu serverda begona havola va reklamalar yuborish taqiqlangan!`
            }).catch(() => null);

            if (warnMsg) {
              setTimeout(() => {
                warnMsg.delete().catch(() => {});
              }, 5000);
            }

            await logger.logAntiLink(message, match[0]);
            return; // Havola yuborgan foydalanuvchiga XP berilmaydi
          } catch (err) {
            console.error('Anti-link qayta ishlashda xatolik:', err.message);
          }
        }
      }
    }

    // 2. LEVEL & XP TIZIMI (Agar faollashtirilgan bo'lsa)
    if (settings.leveling && settings.leveling.enabled) {
      const xpResult = storage.addXP(guild.id, message.author.id);
      if (xpResult && xpResult.leveledUp) {
        const notifyChannelId = settings.leveling.channelId;
        const targetChannel = notifyChannelId ? guild.channels.cache.get(notifyChannelId) : message.channel;

        if (targetChannel && targetChannel.isTextBased()) {
          const levelEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🎉 Daraja Ko\'tarildi!')
            .setDescription(`Ajoyib faollik, ${message.author}! Siz **${xpResult.newLevel}-darajaga** erishdingiz! 🚀`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `Cleva Leveling • Keyingi darajagacha: ${xpResult.requiredXP} XP` })
            .setTimestamp();

          targetChannel.send({ embeds: [levelEmbed] }).catch(() => {});
        }
      }
    }
  }
};
