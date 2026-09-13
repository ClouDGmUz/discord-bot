const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-stats')
    .setDescription('Server a\'zolari va botlari sonini ko\'rsatuvchi ovozli hisoblagich kanallarini sozlash')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('status')
        .setDescription('Server statistikasini yoqish yoki o\'chirish')
        .setRequired(true)
        .addChoices(
          { name: '✅ Yoqish (Kategoriya va kanallarni ochish)', value: 'enable' },
          { name: '❌ O\'chirish (Kanallar va kategoriyani olib tashlash)', value: 'disable' }
        )
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const statusChoice = interaction.options.getString('status');
    const guild = interaction.guild;
    const settings = storage.getGuildSettings(guild.id);

    if (statusChoice === 'disable') {
      if (!settings.stats || !settings.stats.enabled) {
        return interaction.editReply({
          content: 'ℹ️ Server statistikasi allaqachon o\'chirilgan holatda.'
        });
      }

      const { totalChannelId, membersChannelId, botsChannelId, categoryId } = settings.stats;

      // Kanallarni o'chirish
      if (totalChannelId) {
        const ch = guild.channels.cache.get(totalChannelId);
        if (ch) await ch.delete().catch(() => {});
      }
      if (membersChannelId) {
        const ch = guild.channels.cache.get(membersChannelId);
        if (ch) await ch.delete().catch(() => {});
      }
      if (botsChannelId) {
        const ch = guild.channels.cache.get(botsChannelId);
        if (ch) await ch.delete().catch(() => {});
      }
      if (categoryId) {
        const cat = guild.channels.cache.get(categoryId);
        if (cat) await cat.delete().catch(() => {});
      }

      storage.updateGuildSettings(guild.id, {
        stats: {
          enabled: false,
          categoryId: null,
          totalChannelId: null,
          membersChannelId: null,
          botsChannelId: null
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('📊 Server Statistikasi O\'chirildi')
        .setDescription('Server statistikasi kanallari va kategoriyasi to\'liq olib tashlandi.')
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ENABLE HOLATI
    try {
      await guild.members.fetch().catch(() => {});

      const total = guild.memberCount || guild.members.cache.size;
      const bots = guild.members.cache.filter(m => m.user.bot).size;
      const humans = Math.max(0, total - bots);

      // Kategoriya yaratish (eng yuqorida turishi uchun)
      const category = await guild.channels.create({
        name: '📊 SERVER STATISTIKASI',
        type: ChannelType.GuildCategory,
        position: 0,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.Connect] // Ovozli xonaga ulanishni taqiqlash (faqat ko'rish)
          }
        ]
      });

      // 1. Jami a'zolar
      const totalChannel = await guild.channels.create({
        name: `👥 Jami A'zolar: ${total}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.Connect]
          }
        ]
      });

      // 2. Oddiy a'zolar
      const membersChannel = await guild.channels.create({
        name: `👤 A'zolar: ${humans}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.Connect]
          }
        ]
      });

      // 3. Botlar
      const botsChannel = await guild.channels.create({
        name: `🤖 Botlar: ${bots}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.Connect]
          }
        ]
      });

      storage.updateGuildSettings(guild.id, {
        stats: {
          enabled: true,
          categoryId: category.id,
          totalChannelId: totalChannel.id,
          membersChannelId: membersChannel.id,
          botsChannelId: botsChannel.id
        }
      });

      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('📊 Server Statistikasi Yoqildi!')
        .setDescription(
          '**Server statistikasi kategoriyasi va hisoblagich kanallar muvaffaqiyatli yaratildi!**\n\n' +
          `📁 **Kategoriya:** ${category.name}\n` +
          `• 👥 **Jami:** <#${totalChannel.id}> (${total})\n` +
          `• 👤 **A'zolar:** <#${membersChannel.id}> (${humans})\n` +
          `• 🤖 **Botlar:** <#${botsChannel.id}> (${bots})\n\n` +
          '⏰ *Ushbu kanallar har 10 daqiqada va yangi a\'zolar kirib-chiqqanda avtomatik yangilanadi.*'
        )
        .setFooter({ text: 'O\'chirish uchun: /set-stats status:O\'chirish' })
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] });
    } catch (err) {
      console.error('[SET-STATS XATOSI]:', err);
      return interaction.editReply({
        content: `❌ Statistikani sozlashda xatolik yuz berdi: ${err.message}`
      });
    }
  }
};
