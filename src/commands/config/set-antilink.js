const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');
const { DEFAULT_WHITELIST, normalizeDomainOrInvite } = require('../../utils/linkFilter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-antilink')
    .setDescription('Anti-Link filtri va ruxsat berilgan domenlar (Whitelist) sozlamalari')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addBooleanOption(option =>
      option.setName('status')
        .setDescription('Anti-Link tizimi holati (True = Yoqilgan, False = O\'chirilgan)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('add_domain')
        .setDescription('Oq ro\'yxatga yangi domen yoki invite qo\'shish (masalan: youtube.com, spotify.com)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('remove_domain')
        .setDescription('Oq ro\'yxatdan domenni olib tashlash (masalan: youtube.com)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('list_whitelist')
        .setDescription('Barcha ruxsat etilgan domenlar ro\'yxatini ko\'rish (True)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const status = interaction.options.getBoolean('status');
    const addDomainInput = interaction.options.getString('add_domain');
    const removeDomainInput = interaction.options.getString('remove_domain');
    const listWhitelist = interaction.options.getBoolean('list_whitelist');

    const guild = interaction.guild;
    const settings = storage.getGuildSettings(guild.id);
    let currentWhitelist = Array.isArray(settings.linkWhitelist) ? [...settings.linkWhitelist] : [];
    let updatedStatus = settings.antiLinkEnabled !== false;

    const changes = [];

    // 1. Holatni o'zgartirish
    if (status !== null) {
      updatedStatus = status;
      changes.push(`🛡️ **Tizim holati:** ${status ? '🟢 Yoqildi (Faol)' : '🔴 O\'chirildi'}`);
    }

    // 2. Domen qo'shish
    if (addDomainInput) {
      const normalized = normalizeDomainOrInvite(addDomainInput);
      if (!normalized) {
        changes.push(`❌ Noto'g'ri domen formati: \`${addDomainInput}\``);
      } else if (DEFAULT_WHITELIST.some(d => d.toLowerCase() === normalized)) {
        changes.push(`ℹ️ \`${normalized}\` allaqachon standart tizim oq ro'yxatida ruxsat berilgan.`);
      } else if (currentWhitelist.includes(normalized)) {
        changes.push(`ℹ️ \`${normalized}\` allaqachon ushbu server oq ro'yxatida mavjud.`);
      } else {
        currentWhitelist.push(normalized);
        changes.push(`➕ **Yangi domen qo'shildi:** \`${normalized}\``);
      }
    }

    // 3. Domenni olib tashlash
    if (removeDomainInput) {
      const normalized = normalizeDomainOrInvite(removeDomainInput);
      if (DEFAULT_WHITELIST.some(d => d.toLowerCase() === normalized)) {
        changes.push(`⚠️ \`${normalized}\` tizimning standart media servisi (Klipy, Tenor, Giphy va hk.) bo'lgani uchun uni o'chirib bo'lmaydi.`);
      } else if (!currentWhitelist.includes(normalized)) {
        changes.push(`❌ \`${normalized}\` server oq ro'yxatida topilmadi.`);
      } else {
        currentWhitelist = currentWhitelist.filter(d => d !== normalized);
        changes.push(`➖ **Domen o'chirildi:** \`${normalized}\``);
      }
    }

    // O'zgarishlar bo'lsa bazaga saqlash
    if (status !== null || addDomainInput || removeDomainInput) {
      storage.updateGuildSettings(guild.id, {
        antiLinkEnabled: updatedStatus,
        linkWhitelist: currentWhitelist
      });
    }

    // Chiroyli hisobot embedi
    const embed = new EmbedBuilder()
      .setColor(updatedStatus ? 0x57F287 : 0xED4245)
      .setTitle('🛡️ Anti-Link & Domen Oq Ro\'yxati (Whitelist)')
      .setDescription(
        `${changes.length > 0 ? `### 📝 O'zgarishlar:\n${changes.join('\n')}\n\n` : ''}` +
        `**Joriy Tizim Holati:** ${updatedStatus ? '🟢 **Faol (Yoqilgan)**' : '🔴 **O\'chirilgan**'}\n` +
        `*${updatedStatus ? 'Oddiy a\'zolar ruxsatsiz havola tashlasa, xabar avtomatik o\'chiriladi.' : 'A\'zolar chatda ixtiyoriy havolalar yuborishi mumkin.'}*`
      )
      .addFields(
        {
          name: '🎬 Standart Ruxsat Berilgan Servislar (GIF & Discord)',
          value: '`klipy.com` (Klipy GIF), `tenor.com` (Tenor GIF), `giphy.com` (Giphy GIF), `discordapp.com`, `discordapp.net`, `discord.com`, `gfycat.com`, `imgur.com`, `discord.gg/fwVyfrtP4h` (Server taklifi)',
          inline: false
        },
        {
          name: `🌐 Server Maxsus Oq Ro'yxati (${currentWhitelist.length} ta)`,
          value: currentWhitelist.length > 0
            ? currentWhitelist.map(d => `• \`${d}\``).join('\n')
            : '*Hozircha maxsus qo\'shimcha domenlar yo\'q.*',
          inline: false
        },
        {
          name: '💡 Qo\'llanma va Misollar',
          value: '• Domen qo\'shish: `/set-antilink add_domain: youtube.com`\n• Domenni o\'chirish: `/set-antilink remove_domain: youtube.com`\n• Holatni o\'zgartirish: `/set-antilink status: True/False`\n• Ro\'yxatni ko\'rish: `/set-antilink list_whitelist: True`',
          inline: false
        }
      )
      .setFooter({ text: `Sozlovchi: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
