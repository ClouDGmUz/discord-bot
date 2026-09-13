const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storage = require('../config/storage');
const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // 1. FAQT 1 TA SERVERDA ISHLASH CHEKLOVI (ALLOWED_GUILD_ID)
    const allowedGuildId = process.env.ALLOWED_GUILD_ID || process.env.GUILD_ID;
    if (allowedGuildId && allowedGuildId.trim() !== '') {
      if (interaction.guildId && interaction.guildId !== allowedGuildId.trim()) {
        const replyPayload = {
          content: '❌ Bu bot faqat maxsus ruxsat berilgan asosiy serverda ishlaydi.',
          ephemeral: true
        };
        if (interaction.isRepliable()) {
          return interaction.reply(replyPayload).catch(() => {});
        }
        return;
      }
    }

    // 2. SLASH BUYRUQLAR (ChatInputCommand)
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`Noma'lum buyruq chaqirildi: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`Buyruq bajarilishida xatolik (${interaction.commandName}):`, error);

        const errorPayload = {
          content: '❌ Ushbu buyruqni bajarishda kutilmagan xatolik yuz berdi!',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorPayload).catch(() => {});
        } else {
          await interaction.reply(errorPayload).catch(() => {});
        }
      }
      return;
    }

    // 3. TUGMALAR HODISALARI (Button Interactions)
    if (interaction.isButton()) {
      const { customId, guild, user } = interaction;

      // 3.1. YANGI TICKET OCHISH
      if (customId === 'ticket_create') {
        const settings = storage.getGuildSettings(guild.id);
        if (!settings.ticketCategoryId) {
          return interaction.reply({
            content: '❌ Ticket tizimi sozlanmagan yoki kategoriya o\'chirilgan.',
            ephemeral: true
          });
        }

        const category = guild.channels.cache.get(settings.ticketCategoryId);
        if (!category) {
          return interaction.reply({
            content: '❌ Ticketlar kategoriyasi topilmadi.',
            ephemeral: true
          });
        }

        // Foydalanuvchining ochiq ticketi borligini tekshirish
        const existingTicket = category.children.cache.find(c =>
          c.topic && c.topic.includes(`OwnerID: ${user.id}`)
        );

        if (existingTicket) {
          return interaction.reply({
            content: `⚠️ Sizda allaqachon ochiq murojaat mavjud: <#${existingTicket.id}>`,
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const ticketNumber = storage.incrementTicketCounter(guild.id);
          const formattedNumber = String(ticketNumber).padStart(4, '0');
          const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
          const channelName = `ticket-${formattedNumber}-${cleanUsername}`.slice(0, 32);

          // Ruxsatlar
          const permissionOverwrites = [
            {
              id: guild.id, // @everyone
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: user.id, // Ticket egasi
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: guild.members.me.id, // Bot
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.EmbedLinks
              ]
            }
          ];

          // Agar support roli sozlangan bo'lsa
          if (settings.supportRoleId) {
            permissionOverwrites.push({
              id: settings.supportRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory
              ]
            });
          }

          // Yangi kanal yaratish
          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: settings.ticketCategoryId,
            topic: `Ticket #${formattedNumber} | OwnerID: ${user.id}`,
            permissionOverwrites
          });

          // Ticket ichidagi kutib olish xabari
          const welcomeEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🎫 Murojaat #${formattedNumber}`)
            .setDescription(
              `Assalomu alaykum ${user}! Sizning murojaatingiz muvaffaqiyatli qabul qilindi.\n\n` +
              `Iltimos, savolingiz yoki muammoingizni to'liq bayon qilib qoldiring. ` +
              `Server ma'muriyati tez orada javob beradi.\n\n` +
              `*Murojaat yakunlangach, pastdagi tugma orqali uni yopishingiz mumkin.*`
            )
            .setFooter({ text: 'Yopish uchun quyidagi tugmani bosing' })
            .setTimestamp();

          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_close')
              .setLabel('🔒 Murojaatni Yopish')
              .setStyle(ButtonStyle.Danger)
          );

          await ticketChannel.send({
            content: `${user} ${settings.supportRoleId ? `<@&${settings.supportRoleId}>` : ''}`,
            embeds: [welcomeEmbed],
            components: [closeRow]
          });

          await interaction.editReply({
            content: `✅ Murojaatingiz ochildi: <#${ticketChannel.id}>`
          });

          // Log
          await logger.sendLog(
            guild,
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle('📩 Yangi Ticket Ochildi')
              .setDescription(`**Foydalanuvchi:** ${user.tag} (<@${user.id}>)\n**Kanal:** <#${ticketChannel.id}>\n**Ticket:** #${formattedNumber}`)
              .setTimestamp()
          );
        } catch (error) {
          console.error('Ticket ochishda xatolik:', error);
          await interaction.editReply({
            content: `❌ Ticket ochishda xatolik: ${error.message}`
          });
        }
        return;
      }

      // 3.2. TICKETNI YOPISH
      if (customId === 'ticket_close') {
        const channel = interaction.channel;

        const closingEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔒 Murojaat Yopilmoqda')
          .setDescription(`Ushbu ticket **5 soniyadan so'ng** butunlay yopiladi va o'chiriladi...`)
          .setFooter({ text: `Yopuvchi: ${user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [closingEmbed] });

        // Log
        await logger.sendLog(
          guild,
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🔒 Ticket Yopildi')
            .setDescription(`**Kanal:** #${channel.name}\n**Yopgan shaxs:** ${user.tag} (<@${user.id}>)`)
            .setTimestamp()
        );

        setTimeout(async () => {
          await channel.delete('Ticket muvaffaqiyatli yopildi').catch(() => {});
        }, 5000);
        return;
      }
    }
  }
};
