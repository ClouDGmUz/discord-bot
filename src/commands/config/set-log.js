const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-log')
    .setDescription('Server voqealari (loglar) yuboriladigan kanalni belgilaydi yoki o\'chiradi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Loglar yuborilishi kerak bo\'lgan matnli kanal')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('disable')
        .setDescription('Log tizimini to\'xtatish (o\'chirib qo\'yish)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const disable = interaction.options.getBoolean('disable');
    const guild = interaction.guild;

    if (disable) {
      storage.updateGuildSettings(guild.id, { logChannelId: null });
      return interaction.reply({
        content: '✅ Log tizimi ushbu serverda o\'chirib qo\'yildi.',
        ephemeral: true
      });
    }

    if (!channel) {
      const current = storage.getGuildSettings(guild.id);
      return interaction.reply({
        content: current.logChannelId
          ? `ℹ️ Hozirgi log kanali: <#${current.logChannelId}>.\nO'zgartirish uchun: \`/set-log channel:#kanal\` deb yozing.`
          : 'ℹ️ Serverda hozircha log kanali belgilanmagan.\nBelgilash uchun: \`/set-log channel:#kanal\` deb yozing.',
        ephemeral: true
      });
    }

    // Botning kanalga yozish ruxsatini tekshirish
    const permissions = channel.permissionsFor(guild.members.me);
    if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.EmbedLinks)) {
      return interaction.reply({
        content: `❌ Mening <#${channel.id}> kanaliga xabar va Embed yuborish uchun ruxsatim yetarli emas! Iltimos, kanal sozlamalarida botga **Send Messages** va **Embed Links** ruxsatini bering.`,
        ephemeral: true
      });
    }

    // Sozlamani saqlash
    storage.updateGuildSettings(guild.id, { logChannelId: channel.id });

    // Yangi log kanaliga sinov xabari yuborish
    const testEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('📋 Log Tizimi Faollashtirildi')
      .setDescription(`Ushbu kanal **${guild.name}** serverining rasmiy log kanali etib belgilandi.\nServerda bo'ladigan barcha o'zgarishlar (xabar o'chirilishi, tahrirlanishi, a'zolar kirish/chiqishi, moderatsiya amallari) shu yerda qayd etiladi.`)
      .setFooter({ text: `Sozlovchi: ${interaction.user.tag}` })
      .setTimestamp();

    await channel.send({ embeds: [testEmbed] }).catch(() => {});

    await interaction.reply({
      content: `✅ Log kanali muvaffaqiyatli <#${channel.id}> ga o'rnatildi va sinov xabari yuborildi!`,
      ephemeral: true
    });
  }
};
