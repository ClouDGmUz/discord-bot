const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-antilink')
    .setDescription('Reklama va havolalarni avtomatik o\'chirish (Anti-Link) tizimini yoqadi yoki o\'chiradi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addBooleanOption(option =>
      option.setName('status')
        .setDescription('Anti-Link tizimi holati (True = Yoqilgan, False = O\'chirilgan)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const status = interaction.options.getBoolean('status');
    const guild = interaction.guild;

    storage.updateGuildSettings(guild.id, { antiLinkEnabled: status });

    const embed = new EmbedBuilder()
      .setColor(status ? 0x57F287 : 0xED4245)
      .setTitle(`🛡️ Anti-Link Tizimi ${status ? 'Yoqildi (Faol)' : 'O\'chirildi'}`)
      .setDescription(
        status
          ? '✅ Endi oddiy a\'zolar chatga begona Discord havolalari (`discord.gg/...`) yoki veb-sayt linklarini tashlasa, bot xabarni darhol o\'chiradi va ogohlantiradi.\n\n*(Adminlar va moderatorlarga cheklov qo\'yilmaydi).*'
          : '⚠️ Anti-Link tizimi o\'chirildi. A\'zolar chatda havolalar yuborishi mumkin.'
      )
      .setFooter({ text: `Sozlovchi: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
