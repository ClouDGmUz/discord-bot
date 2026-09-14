const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const setTeamArchiveChat = require('./set-team-archive-chat');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-team-archive')
    .setDescription('A\'zolar kartochkalari yuboriladigan Team Arxivi kanalini belgilaydi (/set-team-archive-chat)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Kartochkalar yuboriladigan matnli kanal')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('send_panel')
        .setDescription('Ushbu kanalga \'Yangi Kartochka To\'ldirish\' tugmali panelni joylashtirish (Standart: Ha)')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('ping_role')
        .setDescription('Yangi kartochka to\'ldirilganda xabarnoma boradigan rol (Masalan: @Rahbariyat)')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('head_role')
        .setDescription('Kartochkalarni to\'liq tahrirlash va o\'chirish huquqiga ega Rahbariyat roli')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('allow_public_view')
        .setDescription('Oddiy a\'zolar ham boshqalarning kartochkalarini /team-archive orqali ko\'ra olsinmi?')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('disable')
        .setDescription('Arxiv kanali integratsiyasini o\'chirib qo\'yish')
        .setRequired(false)
    ),

  async execute(interaction) {
    return setTeamArchiveChat.execute(interaction);
  }
};
