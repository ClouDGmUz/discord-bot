const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-level')
    .setDescription('Chatda tajriba to\'plash (Level & XP) tizimini yoqish yoki o\'chirish')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('status')
        .setDescription('Tizim holatini tanlang')
        .setRequired(true)
        .addChoices(
          { name: '✅ Yoqish (A\'zolar chatda yozib XP to\'playdi)', value: 'enable' },
          { name: '❌ O\'chirish (XP to\'planishi to\'xtatiladi)', value: 'disable' }
        )
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Level oshganda tabriklash xabarlari yuboriladigan kanal (Ixtiyoriy)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const isOwner = process.env.OWNER_ID && interaction.user.id === process.env.OWNER_ID.trim();
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !isOwner) {
      return interaction.reply({
        content: '❌ Ushbu buyruqdan foydalanish uchun sizda `Administrator` yoki `Manage Server` ruxsati bo\'lishi kerak.',
        flags: MessageFlags.Ephemeral
      });
    }

    const statusChoice = interaction.options.getString('status');
    const targetChannel = interaction.options.getChannel('channel');
    const guild = interaction.guild;
    const settings = storage.getGuildSettings(guild.id);

    const isEnable = statusChoice === 'enable';
    const currentLeveling = settings.leveling || { enabled: false, users: {} };

    storage.updateGuildSettings(guild.id, {
      leveling: {
        ...currentLeveling,
        enabled: isEnable,
        channelId: targetChannel ? targetChannel.id : (isEnable ? currentLeveling.channelId : null)
      }
    });

    const embed = new EmbedBuilder()
      .setColor(isEnable ? 0x57F287 : 0xED4245)
      .setTitle(isEnable ? '🏆 Level & XP Tizimi Yoqildi!' : '🏆 Level & XP Tizimi O\'chirildi')
      .setDescription(
        isEnable
          ? '✅ **Chatda faollik uchun daraja (Level/XP) to\'plash tizimi ishga tushdi!**\n\n' +
            `📢 **Tabriklash kanali:** ${targetChannel ? `<#${targetChannel.id}>` : '*Xabar yozilgan chatning o\'zida*'}\n` +
            '💡 *A\'zolar endi har bir xabar uchun XP oladi va `/rank`, `/leaderboard` buyruqlaridan foydalana oladi.*'
          : '❌ **Level & XP tizimi o\'chirildi.** Foydalanuvchilar chatda yozganda XP hisoblanmaydi.'
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
