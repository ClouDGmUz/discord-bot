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
    const { guild } = interaction;
    const fillChannel = interaction.options.getChannel('fill_channel');
    const sendChannel = interaction.options.getChannel('send_channel');
    const commonChannel = interaction.options.getChannel('channel');
    const pingRole = interaction.options.getRole('ping_role');
    const headRole = interaction.options.getRole('head_role');
    const disable = interaction.options.getBoolean('disable');

    const settings = storage.getGuildSettings(guild.id);
    const currentArchive = settings.teamArchive || {};

    // 1. TIZIMNI O'CHIRISH (Disable)
    if (disable) {
      storage.setTeamArchiveSettings(guild.id, {
        fillChannelId: null,
        channelId: null
      });

      const disableEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔴 Team Arxivi Kanallari O\'chirildi')
        .setDescription('Kartochkalar to\'ldiriladigan va qabul qilinadigan kanallar sozlamasi o\'chirildi. Saqlangan a\'zolar ma\'lumotlari bazada qoladi.')
        .setFooter({ text: 'Qayta sozlash uchun: /set-team-archive-chat fill_channel:[kanal] send_channel:[kanal]' })
        .setTimestamp();

      return interaction.reply({ embeds: [disableEmbed] });
    }

    // 2. HECH QANDAY PARAMETR KIRITILMASA — JORIY HOLATNI KO'RSATISH
    if (!fillChannel && !sendChannel && !commonChannel && !pingRole && !headRole) {
      const allMembers = storage.getAllTeamMembers(guild.id);
      const memberCount = Object.keys(allMembers).length;

      const hasFill = Boolean(currentArchive.fillChannelId);
      const hasSend = Boolean(currentArchive.channelId);

      const statusEmbed = new EmbedBuilder()
        .setColor(hasFill && hasSend ? 0x57F287 : 0xFEE75C)
        .setTitle('⚙️ Team Arxivi Kanallari Sozlamalari')
        .setDescription(
          `**Tizim Holati:** ${hasFill && hasSend ? '🟢 **To\'liq Faol**' : (hasFill || hasSend ? '🟡 **Qisman Sozlangan**' : '🔴 **Sozlanmagan**')}\n\n` +
          `• 📝 **To'ldirish kanali (Panel & Tugma):** ${hasFill ? `<#${currentArchive.fillChannelId}>` : '*Belgilanmagan*'}\n` +
          `• 📥 **Qabul qilish kanali (Arxiv/Dosyalar):** ${hasSend ? `<#${currentArchive.channelId}>` : '*Belgilanmagan*'}\n` +
          `• 👑 **Rahbariyat Roli:** ${currentArchive.headRoleId ? `<@&${currentArchive.headRoleId}>` : '*Belgilanmagan*'}\n` +
          `• 🔔 **Xabarnoma Roli:** ${currentArchive.pingRoleId ? `<@&${currentArchive.pingRoleId}>` : '*O\'rnatilmagan*'}\n` +
          `• 👥 **Arxivlangan a'zolar soni:** **${memberCount} ta**`
        )
        .addFields({
          name: '💡 Qanday sozlanadi?',
          value:
            '• **To\'ldirish va qabul qilish kanallarini birvarakay sozlash:**\n' +
            '`/set-team-archive-chat fill_channel:#to\'ldirish send_channel:#arxiv`\n\n' +
            '• **Xabarnoma roli bilan birga:**\n' +
            '`/set-team-archive-chat fill_channel:#to\'ldirish send_channel:#arxiv ping_role:@Rahbariyat`\n\n' +
            '• **Ikkalasi bitta kanal bo\'lsa:**\n' +
            '`/set-team-archive-chat channel:#umumiy-arxiv`'
        })
        .setFooter({ text: 'Cleva • Team Archive System' })
        .setTimestamp();

      return interaction.reply({ embeds: [statusEmbed] });
    }

    // 3. SOZLAMALARNI YANGILASH
    await interaction.deferReply();

    const updatePayload = {};
    const effectiveFill = fillChannel || (commonChannel ? commonChannel : null);
    const effectiveSend = sendChannel || (commonChannel ? commonChannel : null);

    if (effectiveFill) updatePayload.fillChannelId = effectiveFill.id;
    if (effectiveSend) updatePayload.channelId = effectiveSend.id;
    if (headRole) updatePayload.headRoleId = headRole.id;
    if (pingRole) updatePayload.pingRoleId = pingRole.id;

    storage.setTeamArchiveSettings(guild.id, updatePayload);

    // 4. AGAR TO'LDIRISH KANALI (fill_channel) BERILGAN BO'LSA — PANEL VA TUGMANI JOYLASHTIRISH
    let fillStatusText = '*O\'zgarishsiz qoldi*';
    if (effectiveFill) {
      try {
        const panelEmbed = createArchivePanelEmbed();
        const panelRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('team_archive_create_btn')
            .setLabel('📝 Yangi Kartochka To\'ldirish')
            .setStyle(ButtonStyle.Primary)
        );

        const panelMessage = await effectiveFill.send({
          embeds: [panelEmbed],
          components: [panelRow]
        });

        await panelMessage.pin().catch(() => {});
        fillStatusText = `✅ <#${effectiveFill.id}> kanaliga "Yangi Kartochka To'ldirish" paneli joylandi va qadaldi!`;
      } catch (err) {
        fillStatusText = `⚠️ <#${effectiveFill.id}> kanaliga panel yuborishda xatolik: ${err.message}`;
      }
    } else if (currentArchive.fillChannelId) {
      fillStatusText = `<#${currentArchive.fillChannelId}> (Avvaldan belgilangan)`;
    }

    // 5. QABUL QILISH KANALI (send_channel) MATNI
    let sendStatusText = '*O\'zgarishsiz qoldi*';
    if (effectiveSend) {
      sendStatusText = `✅ To'ldirilgan kartochkalar endi <#${effectiveSend.id}> kanaliga xabar qilinadi!`;
    } else if (currentArchive.channelId) {
      sendStatusText = `<#${currentArchive.channelId}> (Avvaldan belgilangan)`;
    }

    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('⚡ Team Arxivi Kanallari Muvaffaqiyatli Sozlandi!')
      .setDescription(
        'A\'zolar kartochka to\'ldirishi va tayyor dosyelar qabul qilinishi uchun kanallar muvaffaqiyatli belgilandi.\n\n' +
        `• 📝 **Kartochka to'ldiriladigan kanal:** ${effectiveFill ? `<#${effectiveFill.id}>` : (currentArchive.fillChannelId ? `<#${currentArchive.fillChannelId}>` : '*Belgilanmagan*')}\n` +
        `• 📥 **Kartochkalar borib tushadigan kanal:** ${effectiveSend ? `<#${effectiveSend.id}>` : (currentArchive.channelId ? `<#${currentArchive.channelId}>` : '*Belgilanmagan*')}\n` +
        `• 👑 **Rahbariyat Roli:** ${headRole ? `<@&${headRole.id}>` : (currentArchive.headRoleId ? `<@&${currentArchive.headRoleId}>` : '*Belgilanmagan*')}\n` +
        `• 🔔 **Xabarnoma Roli:** ${pingRole ? `<@&${pingRole.id}>` : (currentArchive.pingRoleId ? `<@&${currentArchive.pingRoleId}>` : '*Yo\'q*')}`
      )
      .addFields(
        {
          name: '📋 To\'ldirish Paneli Holati',
          value: fillStatusText,
          inline: false
        },
        {
          name: '📥 Qabul Qilish Holati',
          value: sendStatusText,
          inline: false
        },
        {
          name: '🚀 Jarayon qanday kechadi?',
          value:
            `1. A'zolar ${effectiveFill ? `<#${effectiveFill.id}>` : 'to\'ldirish'} kanalidagi **"📝 Yangi Kartochka To'ldirish"** tugmasini bosib anketani to'ldiradilar.\n` +
            `2. Topshirilgan tayyor dosye kartochkasi zudlik bilan ${effectiveSend ? `<#${effectiveSend.id}>` : 'arxiv'} kanaliga xabar bo'lib tushadi!`
        }
      )
      .setFooter({ text: 'Cleva • Team Archive System' })
      .setTimestamp();

    return interaction.editReply({ embeds: [successEmbed] });
  }
};
