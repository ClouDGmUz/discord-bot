const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');

const REQUIRED_LOG_CHANNELS = [
  { key: 'messages', name: '🗑️・xabar-loglari', oldName: 'xabar-loglari', topic: '🗑️ Xabarlar o\'chirilishi va tahrirlanishi loglari' },
  { key: 'members', name: '👤・azo-loglari', oldName: 'azo-loglari', topic: '👤 Serverga a\'zolar kirishi, chiqishi va rollar o\'zgarishi loglari' },
  { key: 'moderation', name: '🛡️・moderatsiya-loglari', oldName: 'moderatsiya-loglari', topic: '🛡️ Mute, del-warn, lock, ban va anti-link loglari' },
  { key: 'tickets', name: '🎫・ticket-loglari', oldName: 'ticket-loglari', topic: '🎫 Ticket ochilishi, yopilishi va transcript fayllari loglari' },
  { key: 'voice', name: '🔊・ovozli-loglar', oldName: 'ovozli-loglar', topic: '🎙️ Ovozli kanallarga kirish, chiqish va ko\'chish loglari' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-log')
    .setDescription('Log kategoriyasini belgilaydi va ichida 5 ta maxsus log kanallarini avtomat ochadi')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('category')
        .setDescription('Log kanallari joylashadigan kategoriya')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('disable')
        .setDescription('Log tizimini butunlay o\'chirib qo\'yish')
        .setRequired(false)
    ),

  async execute(interaction) {
    const category = interaction.options.getChannel('category');
    const disable = interaction.options.getBoolean('disable');
    const guild = interaction.guild;

    if (disable) {
      storage.updateGuildSettings(guild.id, {
        logCategoryId: null,
        logChannels: { messages: null, members: null, moderation: null, tickets: null, voice: null },
        logChannelId: null
      });
      return interaction.reply({
        content: '✅ Log tizimi ushbu serverda butunlay o\'chirib qo\'yildi.',
        ephemeral: true
      });
    }

    if (!category) {
      const current = storage.getGuildSettings(guild.id);
      if (current.logCategoryId) {
        return interaction.reply({
          content: `ℹ️ Hozirgi log kategoriyasi: <#${current.logCategoryId}>.\nO'zgartirish uchun: \`/set-log category:[kategoriya]\` deb yozing.`,
          ephemeral: true
        });
      }
      return interaction.reply({
        content: 'ℹ️ Iltimos, log kanallari ochiladigan kategoriyani ko\'rsating: `/set-log category:[kategoriya]`',
        ephemeral: true
      });
    }

    // Botning ManageChannels ruxsatini tekshirish
    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ Botda kanallarni yaratish va boshqarish (**Manage Channels**) ruxsati yo\'q! Iltimos, botga ushbu ruxsatni bering.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const createdChannels = {};
      const createdNames = [];

      for (const item of REQUIRED_LOG_CHANNELS) {
        // Avval kategoriya ichida shu nomli yoki eski nomli kanal bormi-yo'qligini tekshiramiz
        let channel = category.children.cache.find(c =>
          c.name === item.name || c.name === item.oldName || c.name.includes(item.key) || c.name.endsWith(item.oldName)
        );

        if (!channel) {
          channel = await guild.channels.create({
            name: item.name,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: item.topic,
            permissionOverwrites: [
              {
                id: guild.id, // @everyone ko'ra olmaydi
                deny: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: botMember.id, // Bot ko'ra oladi va xabar yubora oladi
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles
                ]
              }
            ]
          });

          // Yangi kanalga dastlabki xabarni yuborish
          const introEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📋 ${channel.name}`)
            .setDescription(`${item.topic}\n\n*Ushbu kanal faqat ma'muriyat uchun ko'rinadi.*`)
            .setTimestamp();

          await channel.send({ embeds: [introEmbed] }).catch(() => {});
        } else if (channel.name !== item.name) {
          // Agar eski nomda bo'lsa, yangi chiroyli nomga o'zgartiramiz
          await channel.setName(item.name).catch(() => {});
        }

        createdChannels[item.key] = channel.id;
        createdNames.push(`• **${item.topic.split(' ')[0]}** <#${channel.id}>`);
      }

      // Sozlamalarni saqlash
      storage.updateGuildSettings(guild.id, {
        logCategoryId: category.id,
        logChannels: createdChannels,
        logChannelId: createdChannels.moderation || createdChannels.messages
      });

      const responseEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Kategoriyalangan Log Tizimi Muvaffaqiyatli Sozlandi!')
        .setDescription(`**${category.name}** kategoriyasi ichida barcha log kanallari sozlandi va ulandi:\n\n${createdNames.join('\n')}`)
        .setFooter({ text: `Sozlovchi: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [responseEmbed] });
    } catch (error) {
      console.error('Set-log xatosi:', error);
      await interaction.editReply({
        content: `❌ Log kanallarini yaratishda xatolik: ${error.message}`
      });
    }
  }
};
