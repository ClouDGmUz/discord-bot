const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const setTeamArchiveChat = require('./set-team-archive-chat');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-team-archive')
    .setDescription('Kartochkalar to\'ldiriladigan va ular yuboriladigan arxiv kanallarini belgilaydi')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('fill_channel')
        .setDescription('A\'zolar kartochka to\'ldiradigan kanal (bu yerga "To\'ldirish" tugmali panel joylanadi)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption(option =>
      option.setName('send_channel')
        .setDescription('To\'ldirilgan kartochkalar borib tushadigan kanal (arxiv/rahbariyat xonasi)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Ikkala vazifa uchun bitta umumiy kanal (muqobil)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('ping_role')
        .setDescription('Yangi kartochka tushganda ogohlantiriladigan rol (Masalan: @Rahbariyat)')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('head_role')
        .setDescription('Kartochkalarni to\'liq tahrirlash va boshqarish huquqiga ega Rahbariyat roli')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('disable')
        .setDescription('Team arxivi kanallarini o\'chirib qo\'yish')
        .setRequired(false)
    ),

  async execute(interaction) {
    return setTeamArchiveChat.execute(interaction);
  }
};
