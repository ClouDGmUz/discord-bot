const { PermissionFlagsBits } = require('discord.js');
const storage = require('../config/storage');
const logger = require('../utils/logger');

const LINK_REGEX = /(https?:\/\/[^\s]+)|(discord\.(gg|io|me|li)\/[^\s]+)|(discord\.com\/invite\/[^\s]+)/i;

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const guild = message.guild;
    const settings = storage.getGuildSettings(guild.id);

    // Standart holatda Anti-Link yoqilgan (true)
    if (settings.antiLinkEnabled === false) return;

    // Admin yoki moderatorlarni tekshirish (ularga havola yuborishga ruxsat)
    const member = message.member;
    const isOwner = process.env.OWNER_ID && message.author.id === process.env.OWNER_ID.trim();
    const isStaff = member && (
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageMessages) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild)
    );

    if (isOwner || isStaff) return;

    // Xabarda havola bormi?
    const match = message.content.match(LINK_REGEX);
    if (match) {
      try {
        await message.delete().catch(() => {});

        // Foydalanuvchiga vaqtinchalik ogohlantirish (5 soniyada o'chadi)
        const warnMsg = await message.channel.send({
          content: `⚠️ ${message.author}, bu serverda begona havola va reklamalar yuborish taqiqlangan!`
        }).catch(() => null);

        if (warnMsg) {
          setTimeout(() => {
            warnMsg.delete().catch(() => {});
          }, 5000);
        }

        // Moderatsiya logiga yozish
        await logger.logAntiLink(message, match[0]);
      } catch (err) {
        console.error('Anti-link qayta ishlashda xatolik:', err.message);
      }
    }
  }
};
