const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Botning barcha buyruqlari, vazifalari va sintaksisi haqida mukammal qo\'llanma'),

  async execute(interaction) {
    // Asosiy bosh sahifa Embed
    const mainEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📚 Cleva — Mukammal Bot Qo\'llanmasi')
      .setDescription(
        '**Cleva** serveringiz xavfsizligi, moderatsiyasi, ticket tizimi va a\'zolar bilan aloqani professional darajada ta\'minlaydi.\n\n' +
        '👇 **Batafsil ma\'lumot olish uchun pastdagi menyudan toifani tanlang:**'
      )
      .addFields(
        {
          name: '🛡️ Moderatsiya (6 ta buyruq)',
          value: '`/give-role`, `/remove-role-from`, `/mute`, `/unmute`, `/del-warn`, `/clear`',
          inline: false
        },
        {
          name: '⚙️ Server Sozlamalari (3 ta tizim)',
          value: '`/set-log`, `/set-welcome`, `/set-ticket`',
          inline: false
        },
        {
          name: '📢 E\'lonlar va So\'rovnomalar (3 ta buyruq)',
          value: '`/say`, `/embed`, `/poll`',
          inline: false
        },
        {
          name: 'ℹ️ Umumiy & Ma\'lumot (5 ta buyruq)',
          value: '`/avatar`, `/roles`, `/server-info`, `/user-info`, `/help`',
          inline: false
        }
      )
      .setFooter({ text: `So'rovchi: ${interaction.user.tag} • Menyudan toifani tanlang` })
      .setTimestamp();

    // Toifalar ro'yxati
    const categoryEmbeds = {
      moderation: new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🛡️ Moderatsiya Buyruqlari')
        .setDescription('Serverda tartib-intizomni saqlash uchun kuchli vositalar:')
        .addFields(
          {
            name: '`/give-role [user] [role]`',
            value: 'Foydalanuvchiga belgilangan rolni xavfsiz beradi. Bot va ijrochining ierarxiyasini tekshiradi.'
          },
          {
            name: '`/remove-role-from [remove_role] [having_role]`',
            value: '1-tanlangan rolni 2-roli bor barcha a\'zolardan avtomatik ommaviy olib tashlaydi.'
          },
          {
            name: '`/mute [user] [duration] [reason]`',
            value: 'Foydalanuvchini vaqtinchalik mute qiladi (Timeout). Misollar: `60s`, `10m`, `1h`, `7d`.'
          },
          {
            name: '`/unmute [user] [reason]`',
            value: 'Foydalanuvchining timeout jazo muddatini muddatidan oldin bekor qiladi.'
          },
          {
            name: '`/del-warn [user] [reason] [message_id]`',
            value: 'Qoidabuzar xabarni o\'chiradi, unga rasmiy ogohlantirish (warn) beradi va shaxsiyiga (DM) xabar yuboradi.'
          },
          {
            name: '`/clear [count] [user]`',
            value: 'Chatdagi xabarlarni 1 dan 100 tagacha tozalaydi. Istasangiz faqat bitta foydalanuvchinikini tozalashi mumkin.'
          }
        )
        .setFooter({ text: 'Ruxsat: Manage Roles, Moderate Members, Manage Messages' }),

      config: new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('⚙️ Server Sozlamalari va Tizimlar')
        .setDescription('Avtomatlashtirilgan server tizimlarini sozlash:')
        .addFields(
          {
            name: '`/set-log [channel] [disable]`',
            value: 'Barcha server voqealari (xabar o\'chishi/tahrirlanishi, a\'zo kirishi/chiqishi, ovozli kanallar) yoziladigan log kanalini o\'rnatadi.'
          },
          {
            name: '`/set-welcome [channel] [message] [status] [test]`',
            value: 'Yangi a\'zolar kirganda xush kelibsiz xabarini sozlaydi. O\'zgaruvchilar: `{user}`, `{username}`, `{server}`, `{memberCount}`.'
          },
          {
            name: '`/set-ticket [channel] [category] [support_role]`',
            value: 'Murojaat va yordam markazi (Ticket tizimi)ni sozlaydi. Asosiy kanalda tugmali panel chiqaradi va yangi murojaatlarni alohida kategoriyada ochadi.'
          }
        )
        .setFooter({ text: 'Ruxsat: Administrator yoki Manage Server' }),

      announcements: new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('📢 E\'lonlar va So\'rovnomalar')
        .setDescription('Server a\'zolariga xabarlar yetkazish va fikrlarini bilish:')
        .addFields(
          {
            name: '`/say [message] [channel]`',
            value: 'Bot nomidan istalgan kanalda oddiy matnli xabar yuboradi.'
          },
          {
            name: '`/embed [title] [description] [color] [image] [thumbnail] [footer] [channel]`',
            value: 'Bot nomidan chiroyli ramkali, rasmli va rangli rasmiy e\'lon (Embed) chiqaradi.'
          },
          {
            name: '`/poll [question] [option1] [option2] [option3..5]`',
            value: '2 dan 5 tagacha variantli ovoz berish so\'rovnomasi tashkil qiladi. A\'zolar emojilar orqali ovoz berishadi.'
          }
        )
        .setFooter({ text: 'Ruxsat: Manage Messages' }),

      general: new EmbedBuilder()
        .setColor(0x38BDF8)
        .setTitle('ℹ️ Umumiy va Ma\'lumot Buyruqlari')
        .setDescription('Barcha a\'zolar foydalanishi mumkin bo\'lgan qulay buyruqlar:')
        .addFields(
          {
            name: '`/avatar [type] [user]`',
            value: 'O\'zingizning, serverning (Icon & Banner) yoki boshqa a\'zoning rasmini **4096px HD** sifatda ko\'rish va yuklab olish.'
          },
          {
            name: '`/roles`',
            value: 'Serverdagi barcha rollar ro\'yxati va har bir rolda nechtadan a\'zo borligini ko\'rsatadi.'
          },
          {
            name: '`/server-info`',
            value: 'Server haqida to\'liq ma\'lumot: egasi, ochilgan sana, a\'zolar, kanallar, boostlar, xavfsizlik darajasi.'
          },
          {
            name: '`/user-info [user]`',
            value: 'Foydalanuvchi qachon ro\'yxatdan o\'tgani, serverga qachon kirgani, rollari va jami warnlari.'
          },
          {
            name: '`/help`',
            value: 'Ushbu interaktiv qo\'llanma oynasini ochadi.'
          }
        )
        .setFooter({ text: 'Ruxsat: Barcha a\'zolar uchun' })
    };

    // Dropdown Select Menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Kerakli toifani tanlang...')
      .addOptions(
        {
          label: 'Asosiy Sahifa',
          description: 'Umumiy ko\'rinish va toifalar ro\'yxati',
          value: 'main',
          emoji: '🏠'
        },
        {
          label: 'Moderatsiya Buyruqlari',
          description: 'give-role, mute, unmute, del-warn, clear...',
          value: 'moderation',
          emoji: '🛡️'
        },
        {
          label: 'Server Sozlamalari',
          description: 'set-log, set-welcome, set-ticket...',
          value: 'config',
          emoji: '⚙️'
        },
        {
          label: 'E\'lonlar va So\'rovnomalar',
          description: 'say, embed, poll...',
          value: 'announcements',
          emoji: '📢'
        },
        {
          label: 'Umumiy & Ma\'lumot',
          description: 'avatar, roles, server-info, user-info...',
          value: 'general',
          emoji: 'ℹ️'
        }
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.reply({
      embeds: [mainEmbed],
      components: [row],
      fetchReply: true
    });

    // Foydalanuvchi menyuni bosganda javob beruvchi collector (60 soniya faol)
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: '❌ Bu menyu siz uchun emas! O\'zingiz uchun ochishga `/help` deb yozing.',
          ephemeral: true
        });
      }

      const selected = i.values[0];
      const targetEmbed = selected === 'main' ? mainEmbed : categoryEmbeds[selected];

      await i.update({
        embeds: [targetEmbed],
        components: [row]
      });
    });

    collector.on('end', async () => {
      // 60 soniya o'tgach menyuni passiv qilish
      selectMenu.setDisabled(true);
      const disabledRow = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  }
};
