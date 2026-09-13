const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType
} = require('discord.js');
const storage = require('../../config/storage');
const {
  resolveYouTubeChannel,
  fetchLatestVideos,
  sendTestNotification
} = require('../../utils/youtubeNotifier');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-youtube')
    .setDescription('YouTube kanalidagi yangi videolarni avtomatik Discordga chiqarish (YouTube Notifier)')
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
    const guild = interaction.guild;
    const settings = storage.getGuildSettings(guild.id);

    let yt = {
      enabled: settings.youtubeNotifier?.enabled ?? false,
      channelId: settings.youtubeNotifier?.channelId ?? null,
      youtubeChannelId: settings.youtubeNotifier?.youtubeChannelId ?? null,
      youtubeChannelName: settings.youtubeNotifier?.youtubeChannelName ?? null,
      youtubeChannelUrl: settings.youtubeNotifier?.youtubeChannelUrl ?? null,
      pingRoleId: settings.youtubeNotifier?.pingRoleId ?? null,
      customMessage: settings.youtubeNotifier?.customMessage ?? null,
      lastVideoId: settings.youtubeNotifier?.lastVideoId ?? null
    };

    const ytInput = interaction.options.getString('youtube_channel');
    const discordChannel = interaction.options.getChannel('channel');
    const pingRole = interaction.options.getRole('ping_role');
    const customMsg = interaction.options.getString('message');
    const statusOpt = interaction.options.getBoolean('status');
    const testOpt = interaction.options.getBoolean('test');

    const hasAnyOption = ytInput || discordChannel || pingRole || customMsg || (statusOpt !== null) || testOpt;

    // Agar hech qanday parametr kiritilmagan bo'lsa, joriy sozlamalarni ko'rsatish
    if (!hasAnyOption) {
      const isEnabled = yt.enabled && yt.channelId && yt.youtubeChannelId;
      const embed = new EmbedBuilder()
        .setColor(isEnabled ? 0x57F287 : 0xED4245)
        .setTitle('🔴 YouTube Avto-Xabarnoma Sozlamalari')
        .setDescription(
          `**Tizim Holati:** ${isEnabled ? '🟢 **Faol (Yoqilgan)**' : '🔴 **O\'chirilgan / To\'liq sozlanmagan**'}\n\n` +
          `• **Discord Kanali:** ${yt.channelId ? `<#${yt.channelId}>` : '*Belgilanmagan*'}\n` +
          `• **YouTube Kanali:** ${yt.youtubeChannelName ? `[${yt.youtubeChannelName}](${yt.youtubeChannelUrl || `https://youtube.com/channel/${yt.youtubeChannelId}`})` : '*Belgilanmagan*'}\n` +
          `• **Kanal ID:** \`${yt.youtubeChannelId || 'Yo\'q'}\`\n` +
          `• **Ping Roli:** ${yt.pingRoleId ? (yt.pingRoleId === 'everyone' ? '@everyone' : `<@&${yt.pingRoleId}>`) : '*Chaqirilmaydi*'}\n` +
          `• **Xabar Shabloni:** \`${yt.customMessage || 'Standart'}\``
        )
        .addFields({
          name: '💡 Qanday sozlash mumkin?',
          value:
            '• Kanal ulash: `/set-youtube youtube_channel:@SubyektivUz channel:#videolar`\n' +
            '• Ping roli bilan: `/set-youtube ping_role:@everyone`\n' +
            '• Test qilish: `/set-youtube test:True`\n' +
            '• Tizimni o\'chirish: `/set-youtube status:False`'
        })
        .setFooter({ text: 'Cleva • YouTube Notifier' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    await interaction.deferReply();

    const changes = [];

    // 1. YouTube kanalini tekshirish va ulash
    if (ytInput) {
      const resolved = await resolveYouTubeChannel(ytInput);
      if (!resolved) {
        return interaction.editReply({
          content: `❌ **Xatolik:** \`${ytInput}\` nomli YouTube kanali topilmadi! Iltimos, kanal havolasini (masalan: \`https://www.youtube.com/@SubyektivUz\`) yoki to'g'ri handleni kiriting.`
        });
      }

      yt.youtubeChannelId = resolved.channelId;
      yt.youtubeChannelName = resolved.channelTitle;
      yt.youtubeChannelUrl = resolved.channelUrl;

      // So'nggi videoni aniqlab lastVideoId ga saqlaymiz (eski videolarni spam qilmaslik uchun)
      const latestVideos = await fetchLatestVideos(resolved.channelId);
      if (latestVideos && latestVideos.length > 0) {
        yt.lastVideoId = latestVideos[0].videoId;
      }

      changes.push(`• YouTube kanali ulandi: **[${resolved.channelTitle}](${resolved.channelUrl})** (\`${resolved.channelId}\`)`);
    }

    // 2. Discord kanalini belgilash
    if (discordChannel) {
      yt.channelId = discordChannel.id;
      changes.push(`• Discord xabarnoma kanali belgilandi: <#${discordChannel.id}>`);
    }

    // 3. Ping rolini belgilash
    if (pingRole) {
      yt.pingRoleId = pingRole.id === guild.id ? 'everyone' : pingRole.id;
      changes.push(`• Video chiqqanda chaqiriladigan rol: ${yt.pingRoleId === 'everyone' ? '@everyone' : `<@&${pingRole.id}>`}`);
    }

    // 4. Maxsus xabarni belgilash
    if (customMsg) {
      yt.customMessage = customMsg;
      changes.push(`• Maxsus xabar matni o'rnatildi.`);
    }

    // 5. Tizim holatini o'zgartirish
    if (statusOpt !== null) {
      yt.enabled = statusOpt;
      changes.push(`• Tizim holati: ${statusOpt ? '🟢 **Yoqildi**' : '🔴 **O\'chirildi**'}`);
    } else if (yt.channelId && yt.youtubeChannelId && !yt.enabled) {
      // Agar kanal va YouTube ulanib, hali yoqilmagan bo'lsa, avtomat yoqish
      yt.enabled = true;
      changes.push(`• Tizim avtomatik faollashtirildi (🟢 **Faol**).`);
    }

    // Bazaga saqlash
    storage.updateGuildSettings(guild.id, { youtubeNotifier: yt });

    // 6. Agar test so'ralgan bo'lsa
    let testResultText = '';
    if (testOpt) {
      if (!yt.youtubeChannelId || !yt.channelId) {
        testResultText = '\n⚠️ **Test ogohlantirishi:** Test qilish uchun avval YouTube kanali va Discord kanali to\'liq sozlangan bo\'lishi kerak.';
      } else {
        const testRes = await sendTestNotification(guild, yt.channelId, yt);
        if (testRes.success) {
          testResultText = `\n✅ **Test muvaffaqiyatli:** <#${yt.channelId}> kanaliga oxirgi video ("*${testRes.video.title}*") sinov tariqasida yuborildi!`;
        } else {
          testResultText = `\n❌ **Testda xatolik:** ${testRes.error}`;
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(yt.enabled ? 0x57F287 : 0xED4245)
      .setTitle('🔴 YouTube Avto-Xabarnoma Muvaffaqiyatli Sozlandi')
      .setDescription(
        `### 📝 Amalga oshirilgan o'zgarishlar:\n${changes.join('\n')}${testResultText}\n\n` +
        `**Joriy Holat:** ${yt.enabled ? '🟢 **Faol (Kuzatilmoqda)**' : '🔴 **O\'chirilgan**'}\n` +
        `• **YouTube:** [${yt.youtubeChannelName || 'Kanal'}](${yt.youtubeChannelUrl || '#'})\n` +
        `• **Discord Kanal:** ${yt.channelId ? `<#${yt.channelId}>` : 'Yo\'q'}\n` +
        `• **Chaqiruv (Ping):** ${yt.pingRoleId ? (yt.pingRoleId === 'everyone' ? '@everyone' : `<@&${yt.pingRoleId}>`) : 'Yo\'q'}\n\n` +
        `*Bot har 5 daqiqada yangi videolarni tekshiradi va video chiqishi bilan kanalingizga e'lon qiladi.*`
      )
      .setFooter({ text: `Sozlovchi: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
