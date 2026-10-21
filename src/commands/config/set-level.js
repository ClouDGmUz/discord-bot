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
        .setDescription('Tizim holatini tanlang (bo\'sh qoldirilsa - joriy sozlamalar ko\'rsatiladi)')
        .setRequired(false)
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
    )
    .addBooleanOption(option =>
      option
        .setName('voice_xp')
        .setDescription('Ovozli xonada suhbatlashgani uchun ham XP berilsinmi (daqiqasiga 10 XP)')
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
    const voiceXp = interaction.options.getBoolean('voice_xp');
    const guild = interaction.guild;
    const currentLeveling = storage.getGuildSettings(guild.id).leveling;

    const nothingChanged = !statusChoice && !targetChannel && voiceXp === null;

    if (!nothingChanged) {
      storage.updateGuildSettings(guild.id, {
        leveling: {
          ...currentLeveling,
          enabled: statusChoice ? statusChoice === 'enable' : currentLeveling.enabled,
          // O'chirilganda ham kanal saqlanadi - qayta yoqqanda qayta sozlash shart emas
          channelId: targetChannel ? targetChannel.id : currentLeveling.channelId,
          voiceXp: voiceXp ?? currentLeveling.voiceXp
        }
      });
    }

    const leveling = storage.getGuildSettings(guild.id).leveling;

    const details =
      `📢 **Tabriklash kanali:** ${leveling.channelId ? `<#${leveling.channelId}>` : '*Xabar yozilgan chatning o\'zida*'}\n` +
      `🎙️ **Ovozli xona XP si:** ${leveling.voiceXp !== false ? '✅ Yoqilgan (daqiqasiga 10 XP)' : '❌ O\'chirilgan'}\n` +
      '💡 *XP chatdagi xabarlar (daqiqada bir marta 15-25 XP)' +
      (leveling.voiceXp !== false ? ' va ovozli xonada suhbat uchun beriladi (AFK, ovozi o\'chirilgan yoki yolg\'iz o\'tirganlarga berilmaydi).*' : ' uchun beriladi.*') +
      '\n🎁 *Rol mukofotlari:* `/set-level-rewards`';

    const embed = new EmbedBuilder()
      .setColor(leveling.enabled ? 0x57F287 : 0xED4245)
      .setTitle(nothingChanged
        ? '🏆 Level & XP Tizimi Sozlamalari'
        : (leveling.enabled ? '🏆 Level & XP Tizimi Yoqildi!' : '🏆 Level & XP Tizimi O\'chirildi'))
      .setDescription(
        leveling.enabled
          ? '✅ **Faollik uchun daraja (Level/XP) to\'plash tizimi ishlamoqda.**\n\n' + details
          : '❌ **Level & XP tizimi o\'chirilgan.** Foydalanuvchilar XP to\'plamaydi.\n\n' + details
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
