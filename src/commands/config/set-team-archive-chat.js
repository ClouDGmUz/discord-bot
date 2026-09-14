const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const storage = require('../../config/storage');
const { createArchivePanelEmbed } = require('../../utils/teamArchiveManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-team-archive-chat')
    .setDescription('A\'zolar kartochkalari (dosyelari) yuboriladigan Team Arxivi kanalini belgilaydi')
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
    const { guild } = interaction;
    const channel = interaction.options.getChannel('channel');
    const sendPanel = interaction.options.getBoolean('send_panel');
    const pingRole = interaction.options.getRole('ping_role');
    const headRole = interaction.options.getRole('head_role');
    const allowPublicView = interaction.options.getBoolean('allow_public_view');
    const disable = interaction.options.getBoolean('disable');

    const settings = storage.getGuildSettings(guild.id);
    const currentArchive = settings.teamArchive || {};

    // 1. O'CHIRIB QO'YISH (Disable)
    if (disable) {
      storage.setTeamArchiveSettings(guild.id, {
        channelId: null
      });

      const disableEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔴 Team Arxivi Kanali O\'chirildi')
        .setDescription('Endi a\'zolar to\'ldirgan kartochkalar hech qaysi kanalga avtomatik yuborilmaydi (ma\'lumotlar esa bot bazasida saqlanib qoladi).')
        .setFooter({ text: 'Qayta yoqish uchun: /set-team-archive-chat channel:[kanal]' })
        .setTimestamp();

      return interaction.reply({ embeds: [disableEmbed] });
    }

    // 2. AGAR PARAMETR KIRITILMAGAN BO'LSA — JORIY HOLATNI KO'RSATISH
    if (!channel && !pingRole && !headRole && allowPublicView === null) {
      const allMembers = storage.getAllTeamMembers(guild.id);
      const memberCount = Object.keys(allMembers).length;
      const isConfigured = Boolean(currentArchive.channelId);

      const statusEmbed = new EmbedBuilder()
        .setColor(isConfigured ? 0x57F287 : 0xFEE75C)
        .setTitle('⚙️ Team Arxivi Kanali Sozlamalari')
        .setDescription(
          `**Tizim Holati:** ${isConfigured ? '🟢 **Faol (Kanal belgilangan)**' : '🟡 **Kanal belgilanmagan**'}\n\n` +
          `• 📁 **Arxiv Kanali:** ${currentArchive.channelId ? `<#${currentArchive.channelId}>` : '*Belgilanmagan*'}\n` +
          `• 👑 **Rahbariyat Roli:** ${currentArchive.headRoleId ? `<@&${currentArchive.headRoleId}>` : '*Belgilanmagan*'}\n` +
          `• 🔔 **Xabarnoma Roli:** ${currentArchive.pingRoleId ? `<@&${currentArchive.pingRoleId}>` : '*O\'rnatilmagan*'}\n` +
          `• 👁️ **Ommaviy ko\'rish:** ${currentArchive.allowPublicView !== false ? '✅ Hamma a\'zolarga ruxsat berilgan' : '🔒 Faqat xodimlar uchun'}\n` +
          `• 👥 **Arxivlangan a\'zolar soni:** **${memberCount} ta**`
        )
        .addFields({
          name: '💡 Kanalni qanday belgilash mumkin?',
          value:
            '• **Kanalni sozlash va panel qo\'yish:** `/set-team-archive-chat channel:#arxiv-chati`\n' +
            '• **Xabarnoma roli bilan birga:** `/set-team-archive-chat channel:#arxiv-chati ping_role:@Rahbariyat`\n' +
            '• **Tizimni o\'chirish:** `/set-team-archive-chat disable:True`'
        })
        .setFooter({ text: 'Cleva • Team Archive System' })
        .setTimestamp();

      return interaction.reply({ embeds: [statusEmbed] });
    }

    // 3. YANGI KANAL VA PARAMETRLARNI SOZLASH
    await interaction.deferReply();

    const updatePayload = {};
    if (channel) updatePayload.channelId = channel.id;
    if (headRole) updatePayload.headRoleId = headRole.id;
    if (pingRole) updatePayload.pingRoleId = pingRole.id;
    if (allowPublicView !== null) updatePayload.allowPublicView = allowPublicView;

    storage.setTeamArchiveSettings(guild.id, updatePayload);

    const targetChannel = channel || (currentArchive.channelId ? guild.channels.cache.get(currentArchive.channelId) : null);
    let panelStatusText = 'Yuborilmadi';

    // 4. AGAR KANAL KO'RSATILGAN BO'LSA VA send_panel !== false BO'LSA — PANEL JOYLASH
    if (targetChannel && sendPanel !== false) {
      try {
        const panelEmbed = createArchivePanelEmbed();
        const panelRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('team_archive_create_btn')
            .setLabel('📝 Yangi Kartochka To\'ldirish')
            .setStyle(ButtonStyle.Primary)
        );

        const panelMessage = await targetChannel.send({
          embeds: [panelEmbed],
          components: [panelRow]
        });

        await panelMessage.pin().catch(() => {});
        panelStatusText = `✅ <#${targetChannel.id}> kanaliga joylandi va qadaldi`;
      } catch (err) {
        panelStatusText = `⚠️ Panel yuborishda xatolik: ${err.message}`;
      }
    }

    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Team Arxivi Kanali Muvaffaqiyatli Sozlandi!')
      .setDescription(
        'Endi barcha server a\'zolari o\'z dosye kartochkalarini to\'ldirganda, yangi kartochka xabarlari to\'g\'ridan-to\'g\'ri belgilangan kanalga yuboriladi!\n\n' +
        `• 📁 **Belgilangan Kanal:** ${targetChannel ? `<#${targetChannel.id}>` : '*O\'zgarmadi*'}\n` +
        `• 📋 **Boshqaruv Paneli:** ${panelStatusText}\n` +
        `• 👑 **Rahbariyat Roli:** ${headRole ? `<@&${headRole.id}>` : (currentArchive.headRoleId ? `<@&${currentArchive.headRoleId}>` : '*Belgilanmagan*')}\n` +
        `• 🔔 **Xabarnoma Pingi:** ${pingRole ? `<@&${pingRole.id}>` : (currentArchive.pingRoleId ? `<@&${currentArchive.pingRoleId}>` : '*Yo\'q*')}\n` +
        `• 👁️ **Ommaviy ko\'rish:** ${allowPublicView !== null ? (allowPublicView ? '✅ Ochiq' : '🔒 Maxfiy') : (currentArchive.allowPublicView !== false ? '✅ Ochiq' : '🔒 Maxfiy')}`
      )
      .addFields({
        name: '🚀 A\'zolar qanday to\'ldiradi?',
        value:
          '1. Kanalga joylangan **"📝 Yangi Kartochka To\'ldirish"** tugmasini bosish orqali;\n' +
          '2. Istalgan chatda **/team-archive card** buyrug\'ini yozish orqali.'
      })
      .setFooter({ text: 'Cleva • Team Archive System' })
      .setTimestamp();

    return interaction.editReply({ embeds: [successEmbed] });
  }
};
