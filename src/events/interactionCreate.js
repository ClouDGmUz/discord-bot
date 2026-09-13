const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
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
        let category = settings.ticketCategoryId ? guild.channels.cache.get(settings.ticketCategoryId) : null;

        // Auto-recovery: Agar kategoriya xotiradan o'chgan bo'lsa, serverdan avtomatik topib tiklaydi
        if (!category) {
          category = guild.channels.cache.find(c =>
            c.type === ChannelType.GuildCategory &&
            (c.name.toLowerCase().includes('ticket') || c.name.toLowerCase().includes('murojaat'))
          );
          if (category) {
            console.log(`[TICKET TIKLANDI] Kategoriya avtomatik topildi: ${category.name} (${category.id})`);
            storage.updateGuildSettings(guild.id, { ticketCategoryId: category.id });
          }
        }

        if (!category) {
          return interaction.reply({
            content: '❌ Ticketlar kategoriyasi topilmadi. Iltimos, ma\'muriyat `/set-ticket` orqali kategoriyani belgilasin.',
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
          const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
          const channelName = `🎫・ticket-${formattedNumber}`.slice(0, 32);

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
              `Assalomu alaykum ${user}! Sizning ticketingiz muvaffaqiyatli ochildi.\n\n` +
              `🎭 **Agar rol olish uchun ochgan bo'lsangiz:**\n` +
              `Qaysi rolni xohlayotganingiz, o'yindagi ismingiz yoki kerakli dalillarni (skrinshot) yozib qoldiring.\n\n` +
              `❓ **Agar savol yoki yordam uchun ochgan bo'lsangiz:**\n` +
              `Muammoingizni to'liq bayon qiling. Server ma'muriyati tez orada sizga javob beradi.\n\n` +
              `*Murojaat yakunlangach, pastdagi tugma orqali uni yopishingiz mumkin.*`
            )
            .setFooter({ text: 'Yopish uchun quyidagi tugmani bosing' })
            .setTimestamp();

          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_close')
              .setLabel('🔒 Ticketni Yopish')
              .setStyle(ButtonStyle.Danger)
          );

          await ticketChannel.send({
            content: `${user} ${settings.supportRoleId ? `<@&${settings.supportRoleId}>` : ''}`,
            embeds: [welcomeEmbed],
            components: [closeRow]
          });

          // 2-qo'shimcha xabar: Rol olish uchun anketa shabloni
          const roleFormEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('📋 Rol Olish Uchun Anketa')
            .setDescription(
              'Agar siz **rol olmoqchi bo\'lsangiz**, iltimos quyidagi ma\'lumotlarni to\'ldirib shu yerga yozing:\n\n' +
              '👤 **1. Ismingiz:**\n' +
              '🎂 **2. Yoshingiz:**\n' +
              '💻 **3. Kompyuteringiz (qurilmangiz) haqida:** *(Masalan: PC / Noutbuk, xarakteristikasi)*\n' +
              '🎮 **4. O\'ynaydigan o\'yinlaringiz:** *(Masalan: CS2, PUBG, Dota 2, GTA V, Valorant...)*\n' +
              '🎭 **5. Qaysi rolni olmoqchisiz:**\n\n' +
              '📌 *Ushbu ma\'lumotlarni yuborsangiz, ma\'muriyat ko\'rib chiqib rolni biriktiradi.*'
            )
            .setFooter({ text: 'Cleva • Rol olish so\'rovi' });

          await ticketChannel.send({ embeds: [roleFormEmbed] });

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
          .setDescription(`Ushbu ticket **5 soniyadan so'ng** butunlay yopiladi va o'chiriladi...\n*Yozishmalar tarixi (transcript) log kanaliga saqlanmoqda.*`)
          .setFooter({ text: `Yopuvchi: ${user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [closingEmbed] });

        // Transcript (yozishmalar tarixi)ni yig'ish
        let transcriptFile = null;
        try {
          const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
          if (messages && messages.size > 0) {
            const sorted = Array.from(messages.values()).reverse();
            let transcriptText = `====================================================\n`;
            transcriptText += `CLEVA TICKET TRANSCRIPT\n`;
            transcriptText += `Server: ${guild.name}\n`;
            transcriptText += `Kanal: #${channel.name}\n`;
            transcriptText += `Yopuvchi: ${user.tag} (${user.id})\n`;
            transcriptText += `Sana: ${new Date().toLocaleString()}\n`;
            transcriptText += `====================================================\n\n`;

            for (const msg of sorted) {
              const author = msg.author ? `${msg.author.tag} (${msg.author.id})` : 'Noma\'lum';
              const time = new Date(msg.createdTimestamp).toLocaleString();
              transcriptText += `[${time}] ${author}:\n`;
              if (msg.content) transcriptText += `${msg.content}\n`;
              if (msg.embeds && msg.embeds.length > 0) {
                for (const emb of msg.embeds) {
                  transcriptText += `  [EMBED] ${emb.title || ''}: ${emb.description || ''}\n`;
                }
              }
              if (msg.attachments && msg.attachments.size > 0) {
                transcriptText += `  [FAYLLAR]: ${msg.attachments.map(a => a.url).join(', ')}\n`;
              }
              transcriptText += `\n`;
            }

            transcriptFile = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), {
              name: `transcript-${channel.name}.txt`
            });
          }
        } catch (err) {
          console.error('Transcript yig\'ishda xatolik:', err.message);
        }

        // Ticket log kanaliga hisobot va faylni yuborish
        const logEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔒 Ticket Yopildi va Arxivlandi')
          .setDescription(`**Kanal:** #${channel.name}\n**Yopgan shaxs:** ${user.tag} (<@${user.id}>)\n**Transcript:** ${transcriptFile ? 'Biriktirildi (.txt)' : 'Yozishmalar mavjud emas'}`)
          .setTimestamp();

        await logger.logTicketAction(guild, logEmbed, transcriptFile ? [transcriptFile] : []);

        setTimeout(async () => {
          await channel.delete('Ticket muvaffaqiyatli yopildi').catch(() => {});
        }, 5000);
        return;
      }
    }
  }
};
