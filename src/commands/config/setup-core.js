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
    .setName('setup-core')
    .setDescription('2-Core Staff serveri uchun rollar, ruxsatlar, moderator chat va Team Arxivini sozlaydi')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addRoleOption(option =>
      option.setName('head_role')
        .setDescription('Katta rol (Rahbariyat / Boshqaruv) — barcha loglar, arxiv va rahbariyat chatiga kiradi')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('moder_role')
        .setDescription('Moderator roli — faqat moderator chati va xabar loglarini ko\'radi')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('log_category')
        .setDescription('Mavjud loglar kategoriyasi (masalan: MG LOGS). Tanlanmasa avtomatik topiladi')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('archive_category_name')
        .setDescription('Rahbariyat kategoriyasi nomi (standart: 👑・RAHBARIYAT & ARXIV)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const { guild, client } = interaction;

    const headRole = interaction.options.getRole('head_role');
    const moderRole = interaction.options.getRole('moder_role');
    const specifiedLogCategory = interaction.options.getChannel('log_category');
    const archiveCategoryName = interaction.options.getString('archive_category_name') || '👑・RAHBARIYAT & ARXIV';

    const logsConfigured = [];
    const logsHidden = [];
    const errors = [];

    // 1. MAVJUD LOG KANALLARINI TOPISH VA RUXSATLARINI SOZLASH
    // Log kategoriyasini aniqlash:
    let logCategory = specifiedLogCategory;
    if (!logCategory) {
      logCategory = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory &&
        (c.name.toLowerCase().includes('log') || c.name.toLowerCase().includes('mg logs'))
      );
    }

    // Barcha kanallar ichidan log kanallarini qidirish
    const channelsToCheck = logCategory ? logCategory.children.cache : guild.channels.cache;

    for (const [, ch] of channelsToCheck) {
      if (!ch.isTextBased() || ch.type === ChannelType.GuildCategory) continue;

      const lowerName = ch.name.toLowerCase();

      // A) Xabar loglari: Moderatorga faqat o'qish, Rahbariyatga to'liq, @everyone ga yopiq
      if (lowerName.includes('xabar-log') || lowerName.includes('messages')) {
        try {
          await ch.permissionOverwrites.edit(guild.roles.everyone.id, {
            ViewChannel: false
          });
          await ch.permissionOverwrites.edit(moderRole.id, {
            ViewChannel: true,
            SendMessages: false,
            ReadMessageHistory: true
          });
          await ch.permissionOverwrites.edit(headRole.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });
          logsConfigured.push(`<#${ch.id}> (Moderator: O'qish ruxsati)`);
        } catch (err) {
          errors.push(`Xabar logi ruxsatida xato: ${err.message}`);
        }
      }

      // B) A'zo, moderatsiya, ticket, ovozli loglar: Moderatorga butunlay yashirin, Rahbariyatga ochiq
      if (
        lowerName.includes('azo-log') || lowerName.includes('members') ||
        lowerName.includes('moderatsiya') || lowerName.includes('mod-log') ||
        lowerName.includes('ticket-log') ||
        lowerName.includes('ovozli-log') || lowerName.includes('voice-log')
      ) {
        try {
          await ch.permissionOverwrites.edit(guild.roles.everyone.id, {
            ViewChannel: false
          });
          await ch.permissionOverwrites.edit(moderRole.id, {
            ViewChannel: false
          });
          await ch.permissionOverwrites.edit(headRole.id, {
            ViewChannel: true,
            ReadMessageHistory: true
          });
          logsHidden.push(`<#${ch.id}> (Moderatorga yashirildi)`);
        } catch (err) {
          errors.push(`Log yashirishda xato (${ch.name}): ${err.message}`);
        }
      }
    }

    // 2. RAHBARIYAT VA ARXIV KATEGORIYASINI YARATISH YOKI TIKLASH
    let leadershipCategory = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory &&
      (c.name.toLowerCase().includes('rahbariyat') || c.name.toLowerCase().includes('arxiv'))
    );

    if (!leadershipCategory) {
      try {
        leadershipCategory = await guild.channels.create({
          name: archiveCategoryName,
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: moderRole.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: headRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks
              ]
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.EmbedLinks
              ]
            }
          ]
        });
      } catch (err) {
        errors.push(`Rahbariyat kategoriyasini yaratishda xato: ${err.message}`);
      }
    } else {
      // Mavjud kategoriya ruxsatlarini yangilash
      await leadershipCategory.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false }).catch(() => {});
      await leadershipCategory.permissionOverwrites.edit(moderRole.id, { ViewChannel: false }).catch(() => {});
      await leadershipCategory.permissionOverwrites.edit(headRole.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
      }).catch(() => {});
    }

    // 3. RAHBARIYAT CHATI VA TEAM ARXIVI KANALLARINI YARATISH / TIKLASH
    let rahbariyatChat = null;
    let archiveChannel = null;

    if (leadershipCategory) {
      // 3.1. #rahbariyat-chat
      rahbariyatChat = leadershipCategory.children.cache.find(c => c.name.includes('rahbariyat-chat')) ||
        guild.channels.cache.find(c => c.name === 'rahbariyat-chat' || c.name.includes('rahbariyat-chat'));

      if (!rahbariyatChat) {
        rahbariyatChat = await guild.channels.create({
          name: '👑・rahbariyat-chat',
          type: ChannelType.GuildText,
          parent: leadershipCategory.id,
          topic: '👑 MEGA TEAM Rahbariyatining maxfiy muhokama va strategiya xonasi'
        });
      }

      // 3.2. #team-arxivi
      archiveChannel = leadershipCategory.children.cache.find(c => c.name.includes('team-arxivi')) ||
        guild.channels.cache.find(c => c.name === 'team-arxivi' || c.name.includes('team-arxivi'));

      if (!archiveChannel) {
        archiveChannel = await guild.channels.create({
          name: '📁・team-arxivi',
          type: ChannelType.GuildText,
          parent: leadershipCategory.id,
          topic: '📁 MEGA TEAM a\'zolarining rasmiy kartochkalari va dosyelari arxivi'
        });
      }

      // #team-arxivi ga boshqaruv paneli joylash (agar hali joylanmagan bo'lsa)
      if (archiveChannel) {
        const messages = await archiveChannel.messages.fetch({ limit: 10 }).catch(() => null);
        const hasPanel = messages && messages.some(m => m.embeds.some(e => e.title && e.title.includes('A\'zolar Rasmiy Arxivi')));

        if (!hasPanel) {
          const panelEmbed = createArchivePanelEmbed();
          const panelRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('team_archive_create_btn')
              .setLabel('📝 Yangi Kartochka To\'ldirish')
              .setStyle(ButtonStyle.Primary)
          );

          const panelMsg = await archiveChannel.send({ embeds: [panelEmbed], components: [panelRow] });
          await panelMsg.pin().catch(() => {});
        }
      }
    }

    // 4. MODERATOR CHATINI SOZLASH / YARATISH
    let moderChat = guild.channels.cache.find(c => c.name === 'moderator-chat' || c.name.includes('moderator-chat'));
    if (!moderChat) {
      moderChat = await guild.channels.create({
        name: '🛡️・moderator-chat',
        type: ChannelType.GuildText,
        topic: '🛡️ Moderatorlar va staff a\'zolarining umumiy ishchi muloqot xonasi',
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: moderRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: headRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages
            ]
          }
        ]
      });
    } else {
      // Mavjud moderator chat ruxsatlarini yangilash
      await moderChat.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false }).catch(() => {});
      await moderChat.permissionOverwrites.edit(moderRole.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
      }).catch(() => {});
      await moderChat.permissionOverwrites.edit(headRole.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
      }).catch(() => {});
    }

    // 5. SOZLAMALARNI BAZAGA SAQLASH
    storage.setTeamArchiveSettings(guild.id, {
      channelId: archiveChannel ? archiveChannel.id : null,
      headRoleId: headRole.id,
      moderRoleId: moderRole.id
    });

    // 6. XULOSA EMBEDINI CHIQARISH
    const resultEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('⚡ 2-Core Server Sozlamalari Muvaffaqiyatli O\'rnatildi!')
      .setDescription(
        'Serverdagi rollar va kanallar ruxsati moderatsiya va rahbariyat talablariga mos ravishda to\'liq taqsimlandi.\n\n' +
        `👑 **Katta Rahbariyat Roli:** <@&${headRole.id}>\n` +
        `🛡️ **Moderator Roli:** <@&${moderRole.id}>`
      )
      .addFields(
        {
          name: '👁️ Moderatorlar Ko\'ra Oladigan Kanallar',
          value:
            `• ${moderChat ? `<#${moderChat.id}>` : '*Mavjud emas*'} (Yozish va muloqot)\n` +
            `• ${logsConfigured.length > 0 ? logsConfigured.join('\n• ') : '*Xabar loglari topilmadi*'}`,
          inline: false
        },
        {
          name: '🔒 Moderatorlardan Yashirilgan Loglar',
          value: logsHidden.length > 0
            ? logsHidden.join('\n')
            : '*Hech qanday log yashirilmadi yoki topilmadi*',
          inline: false
        },
        {
          name: '👑 Rahbariyat & Team Arxivi',
          value:
            `• **Rahbariyat chati:** ${rahbariyatChat ? `<#${rahbariyatChat.id}>` : '*Xato*'}\n` +
            `• **Team Arxivi:** ${archiveChannel ? `<#${archiveChannel.id}>` : '*Xato*'}\n` +
            `*(Ushbu kanallar faqat <@&${headRole.id}> va administratorlar uchun ochiq)*`,
          inline: false
        }
      )
      .setFooter({ text: 'Cleva • 2-Core Staff & Team Archive System' })
      .setTimestamp();

    if (errors.length > 0) {
      resultEmbed.addFields({
        name: '⚠️ Kichik Ogohlantirishlar',
        value: errors.slice(0, 5).join('\n')
      });
    }

    return interaction.editReply({ embeds: [resultEmbed] });
  }
};
