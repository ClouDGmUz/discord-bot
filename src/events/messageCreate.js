const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../config/storage');
const logger = require('../utils/logger');
const { askClevaAI, splitMessage } = require('../utils/aiManager');

const LINK_REGEX = /(https?:\/\/[^\s]+)|(discord\.(gg|io|me|li)\/[^\s]+)|(discord\.com\/invite\/[^\s]+)/i;

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const guild = message.guild;
    const settings = storage.getGuildSettings(guild.id);

    // 1. ANTI-LINK VA ANTI-INVITE TEKSHIRUVI
    if (settings.antiLinkEnabled !== false) {
      const member = message.member;
      const isOwner = process.env.OWNER_ID && message.author.id === process.env.OWNER_ID.trim();
      const isStaff = member && (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)
      );

      if (!isOwner && !isStaff) {
        const match = message.content.match(LINK_REGEX);
        if (match) {
          try {
            await message.delete().catch(() => {});

            const warnMsg = await message.channel.send({
              content: `⚠️ ${message.author}, bu serverda begona havola va reklamalar yuborish taqiqlangan!`
            }).catch(() => null);

            if (warnMsg) {
              setTimeout(() => {
                warnMsg.delete().catch(() => {});
              }, 5000);
            }

            await logger.logAntiLink(message, match[0]);
            return; // Havola yuborgan foydalanuvchiga XP berilmaydi
          } catch (err) {
            console.error('Anti-link qayta ishlashda xatolik:', err.message);
          }
        }
      }
    }

    // 2. LEVEL & XP TIZIMI (Agar faollashtirilgan bo'lsa)
    if (settings.leveling && settings.leveling.enabled) {
      const xpResult = storage.addXP(guild.id, message.author.id);
      if (xpResult && xpResult.leveledUp) {
        const notifyChannelId = settings.leveling.channelId;
        const targetChannel = notifyChannelId ? guild.channels.cache.get(notifyChannelId) : message.channel;

        if (targetChannel && targetChannel.isTextBased()) {
          const levelEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🎉 Daraja Ko\'tarildi!')
            .setDescription(`Ajoyib faollik, ${message.author}! Siz **${xpResult.newLevel}-darajaga** erishdingiz! 🚀`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `Cleva Leveling • Keyingi darajagacha: ${xpResult.requiredXP} XP` })
            .setTimestamp();

          targetChannel.send({ embeds: [levelEmbed] }).catch(() => {});
        }
      }
    }

    // 3. AI CHATBOT JAVOBI (Cleva AI)
    const isAiChannel = settings.aiChat?.enabled && settings.aiChat?.channelId === message.channelId;
    const botMentioned = message.mentions.has(message.client.user) && !message.mentions.everyone;
    const isClevaCommand = message.content.trim().toLowerCase().startsWith('!cleva');
    const isRasmCommand = message.content.trim().toLowerCase().startsWith('!rasm');

    if (isAiChannel || botMentioned || isClevaCommand || isRasmCommand) {
      let prompt = message.content;
      let repliedContext = '';

      // 1. Agar biror xabarga reply (javob) qilib yozilgan bo'lsa, o'sha xabarning matnini olish
      if (message.reference && message.reference.messageId) {
        try {
          const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
          if (repliedMsg) {
            const repliedAuthor = repliedMsg.member?.displayName || repliedMsg.author.username;
            const contentText = repliedMsg.content || (repliedMsg.embeds?.[0]?.description) || '*(Rasm yoki fayl yuborilgan)*';
            repliedContext = `[Suhbatdosh (${repliedAuthor}) yozgan xabar]: "${contentText}"\n`;
          }
        } catch (err) {
          // Ignorlash
        }
      }

      // 2. Prefiks yoki mentionni tozalash
      if (isRasmCommand) {
        prompt = prompt.replace(/^!rasm\s*/i, '').trim();
      } else if (isClevaCommand) {
        prompt = prompt.replace(/^!cleva\s*/i, '').trim();
      } else if (botMentioned) {
        prompt = prompt.replace(new RegExp(`<@!?${message.client.user.id}>`, 'g'), '').trim();
      }

      // 3. Rasm chizish buyrug'i bo'lsa (!rasm ..., !cleva rasm ..., !cleva image ...)
      const isImageRequest = isRasmCommand ||
        prompt.toLowerCase().startsWith('rasm ') ||
        prompt.toLowerCase().startsWith('image ') ||
        prompt.toLowerCase() === 'rasm' ||
        prompt.toLowerCase() === 'image';

      if (isImageRequest) {
        let imagePrompt = prompt;
        if (imagePrompt.toLowerCase().startsWith('rasm ')) {
          imagePrompt = imagePrompt.slice(5).trim();
        } else if (imagePrompt.toLowerCase().startsWith('image ')) {
          imagePrompt = imagePrompt.slice(6).trim();
        } else if (imagePrompt.toLowerCase() === 'rasm' || imagePrompt.toLowerCase() === 'image') {
          imagePrompt = '';
        }

        // Agar reply qilingan xabar bo'lsa va imagePrompt bo'sh bo'lsa
        if (imagePrompt.length === 0 && repliedContext.length > 0) {
          imagePrompt = repliedContext.replace(/\[Suhbatdosh.*?\]:\s*"/g, '').replace(/"\s*$/g, '').trim();
        }

        if (imagePrompt.length === 0) {
          return message.reply({
            content: '🎨 Qanday rasm chizmoqchisiz? Masalan: `!cleva rasm kiberpank mashina` yoki `/image prompt: kosmosdagi shahar` deb yozing!'
          }).catch(() => {});
        }

        try {
          await message.channel.sendTyping();
          const { generateAiImage } = require('../utils/imageGenerator');
          const waitMsg = await message.reply({ content: '🎨 **Rasm chizilmoqda, 3-5 soniya kuting...**' }).catch(() => null);

          const result = await generateAiImage(imagePrompt);
          if (waitMsg) await waitMsg.delete().catch(() => {});

          if (result.success && result.attachment) {
            const embed = new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('🎨 Cleva AI — Yangi Rasm Yaratildi!')
              .setDescription(
                `👤 **So'rovchi:** ${message.author}\n` +
                `📝 **Tavsif:** \`${imagePrompt}\`\n` +
                `🔍 **Prompt:** *${result.prompt.slice(0, 300)}...*`
              )
              .setImage(`attachment://${result.attachment.name}`)
              .setFooter({ text: 'Cleva AI • 100% Bepul va Cheksiz (Flux.1)' })
              .setTimestamp();

            return message.reply({
              embeds: [embed],
              files: [result.attachment]
            });
          } else {
            return message.reply({
              content: `❌ Rasm yaratishda xatolik yuz berdi: ${result.error || 'Noma\'lum xatolik'}`
            });
          }
        } catch (err) {
          console.error('[RASM YARATISH XATOSI]:', err);
          return message.reply({ content: '❌ Rasm yaratishda kutilmagan xatolik yuz berdi.' }).catch(() => {});
        }
      }

      // 4. Agar faqat "!cleva" deb yozilgan bo'lsa va reply qilingan xabar bo'lsa
      if (prompt.length === 0 && repliedContext.length > 0) {
        prompt = 'Ushbu xabarga munosib va to\'liq javob qaytaring.';
      }

      // 5. Agar umumiy chatda shunchaki "!cleva" deb yozilgan bo'lsa (savol ham, reply ham yo'q)
      if (prompt.length === 0 && repliedContext.length === 0) {
        return message.reply({
          content: '👋 Assalomu alaykum! Men **Cleva AI**man.\n• Savol berish uchun: `!cleva [savolingiz]`\n• Rasm chizish uchun: `!cleva rasm [tavsif]` yoki `/image`\n• Biror a\'zoning xabariga javob olish uchun reply qilib `!cleva` deb yozing!'
        }).catch(() => {});
      }

      // Yakuniy promptni shakllantirish
      const finalPrompt = repliedContext ? `${repliedContext}[Mening ko'rsatmam/savolim]: ${prompt}` : prompt;

      try {
        await message.channel.sendTyping();

        const userName = message.member?.displayName || message.author.username;
        const aiReply = await askClevaAI(message.channelId, finalPrompt, userName);

        const chunks = splitMessage(aiReply);
        for (let i = 0; i < chunks.length; i++) {
          if (i === 0) {
            await message.reply({ content: chunks[i] }).catch(async () => {
              await message.channel.send({ content: chunks[i] });
            });
          } else {
            await message.channel.send({ content: chunks[i] });
          }
        }
      } catch (err) {
        console.error('[AI JAVOB BERISHDA XATO]:', err);
      }
    }
  }
};
