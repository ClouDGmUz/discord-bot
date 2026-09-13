const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const setYouTube = require('./set-youtube');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-video')
    .setDescription('YouTube kanalidagi yangi videolarni avtomatik Discordga chiqarish (/set-youtube muqobili)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('youtube_channel')
        .setDescription('YouTube kanal havolasi, handle (@SubyektivUz) yoki ID si (UC...)')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Yangi videolar joylanadigan Discord matnli kanali')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('ping_role')
        .setDescription('Yangi video chiqqanda chaqiriladigan rol (ixtiyoriy, masalan: @everyone)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Maxsus xabar shabloni ({author}, {title}, {link}, {ping} belgilaridan foydalaning)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('status')
        .setDescription('Tizim holati (True = Yoqilgan, False = O\'chirilgan)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('test')
        .setDescription('Kanalga oxirgi videoni darhol test tariqasida yuborib ko\'rish (True)')
        .setRequired(false)
    ),

  async execute(interaction) {
    return setYouTube.execute(interaction);
  }
};
