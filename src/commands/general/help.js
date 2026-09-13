const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Cleva botining barcha buyruqlari, tizimlari va sozlamalari haqida to\'liq qo\'llanma'),

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
          name: '🛡️ Moderatsiya va Xavfsizlik (10 ta buyruq)',
          value: '`/give-role`, `/remove-role-from`, `/mute`, `/unmute`, `/del-warn`, `/warns`, `/lock`, `/unlock`, `/clear`, `/audit-log`',
          inline: false
        },
        {
          name: '⚙️ Server Sozlamalari (11 ta tizim)',
          value: '`/set-log`, `/set-welcome`, `/set-ticket`, `/set-autorole`, `/set-antilink`, `/set-media-roles`, `/set-stats`, `/set-tempvoice`, `/set-level`, `/set-ai`, `/set-youtube` (`/set-video`)',
          inline: false
        },
        {
          name: '📢 E\'lonlar va So\'rovnomalar (3 ta buyruq)',
          value: '`/say`, `/embed`, `/poll`',
          inline: false
        },
        {
          name: 'ℹ️ Umumiy & Ma\'lumot (10 ta buyruq)',
          value: '`/lfg`, `/image`, `/chats-list`, `/rank`, `/leaderboard`, `/avatar`, `/roles`, `/server-info`, `/user-info`, `/help`',
          inline: false
        }
      )
      .setFooter({ text: 'Cleva • Menyudan toifani tanlang' })
      .setTimestamp();

    // Toifalar ro'yxati
    const categoryEmbeds = {
      moderation: new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🛡️ Moderatsiya va Xavfsizlik Buyruqlari')
        .setDescription('Serverda tartib-intizomni saqlash va a\'zolarni boshqarish vositalari:')
        .addFields(
          {
            name: '`/give-role [user] [role]`',
            value: 'Foydalanuvchiga belgilangan rolni beradi. Ierarxiya va ruxsatlarni tekshiradi.'
          },
          {
            name: '`/remove-role-from [remove_role] [having_role]`',
            value: '2-rolga ega barcha a\'zolardan 1-rolni bittada ommaviy olib tashlaydi.'
          },
          {
            name: '`/mute [user] [duration] [reason]`',
            value: 'Vaqtinchalik timeout qiladi (masalan: `60s`, `10m`, `2h`, `1d`, `7d`).'
          },
          {
            name: '`/unmute [user] [reason]`',
            value: 'Foydalanuvchining mute jazo muddatini muddatidan oldin bekor qiladi.'
          },
          {
            name: '`/del-warn [user] [reason] [message_id]`',
            value: 'Xabarni o\'chiradi, rasmiy ogohlantirish (warn) yozadi va unga DM yuboradi.'
          },
          {
            name: '`/warns [subcommand: list | remove | clear]`',
            value: '`list`: Foydalanuvchining barcha warnlarini ko\'rish.\n`remove`: Bitta warnni o\'chirish.\n`clear`: Hamma warnlarini nolga tushirish.'
          },
          {
            name: '`/lock [channel] [reason]`',
            value: 'Kanalni oddiy a\'zolar uchun yozishdan vaqtincha yopadi (Lockdown).'
          },
          {
            name: '`/unlock [channel]`',
            value: 'Qulflangan kanalni yana hammaga ochib beradi.'
          },
          {
            name: '`/clear [count] [user]`',
            value: 'Chatdagi xabarlarni 1 dan 100 tagacha tozalaydi (foydalanuvchi filtri bilan).'
          },
          {
            name: '`/audit-log [tur] [soni]`',
            value: 'Serverda kim xabarlarni o\'chirgani yoki Discord AutoMod bloklaganini tekshirish.'
          }
        )
        .setFooter({ text: 'Ruxsat: Manage Roles, Moderate Members, Manage Channels, Manage Messages, View Audit Log' }),

      config: new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('⚙️ Server Sozlamalari va Tizimlar')
        .setDescription('Avtomatlashtirilgan server tizimlarini sozlash buyruqlari:')
        .addFields(
          {
            name: '`/set-log [category] [external_category_id] [external_channel_id]`',
            value: 'Kategoriya ichida 5 ta log kanalini ochadi (shu serverda yoki boshqa alohida Admin serverda!).'
          },
          {
            name: '`/set-ticket channel:[kanal] category:[kategoriya] support_role:[rol]`',
            value: 'Ticket markazini sozlaydi. A\'zolar tugmani bosganda shaxsiy kanal ochiladi va rol olish anketasi beriladi. Yopilganda transcript saqlanadi.'
          },
          {
            name: '`/set-autorole role:[rol] disable:[true/false]`',
            value: 'Yangi kirgan har bir a\'zoga darhol ushbu rolni avtomatik biriktiradi.'
          },
          {
            name: '`/set-antilink [status] [add_domain] [remove_domain] [list_whitelist]`',
            value: 'Anti-Link filtri va oq ro\'yxat (Whitelist). Klipy, Tenor, Giphy GIF\'lari va server taklifi avtomatik ruxsat etilgan.'
          },
          {
            name: '`/set-welcome channel:[kanal] message:[matn] status:[true/false]`',
            value: 'Yangi a\'zolar uchun welcome xabari (`{user}`, `{username}`, `{server}`, `{memberCount}`).'
          },
          {
            name: '`/set-stats status:[Yoqish/O\'chirish]`',
            value: 'Server a\'zolari, odamlar va botlar sonini ko\'rsatuvchi ovozli hisoblagich kanallarini avtomat ochish yoki o\'chirish.'
          },
          {
            name: '`/set-tempvoice status:[Yoqish/O\'chirish]`',
            value: 'Avtomatik shaxsiy ovozli xonalar ("Join to Create"). "➕ Xona Yaratish" ga kirganda yangi xona ochib beradi va bo\'shagach o\'chiradi.'
          },
          {
            name: '`/set-level status:[Yoqish/O\'chirish] [channel]`',
            value: 'Chatda yozish orqali tajriba (Level & XP) to\'plash tizimini yoqish yoki o\'chirish.'
          },
          {
            name: '`/set-ai status:[Yoqish/O\'chirish] [channel]`',
            value: 'Google Gemini sun\'iy intellekt chatbotini yoqish yoki o\'chirish. A\'zolarga o\'zbek tilida aqlli javoblar qaytaradi.'
          },
          {
            name: '`/set-media-roles [status] [add_role] [remove_role] [clear_all]`',
            value: 'Faqat tanlangan rollarga rasm va GIF yuborish ruxsatini berish. Ruxsatsiz a\'zolarning rasm/GIF xabarlari avtomatik o\'chiriladi.'
          },
          {
            name: '`/set-youtube` yoki `/set-video [youtube_channel] [channel] [ping_role] [test]`',
            value: 'YouTube kanaliga yangi video yoki Shorts yuklanganda Discord kanaliga avtomatik e\'lon qilish (YouTube Notifier).'
          }
        )
        .setFooter({ text: 'Ruxsat: Administrator yoki Manage Server' }),

      announcements: new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('📢 E\'lonlar va So\'rovnomalar')
        .setDescription('Server a\'zolariga xabarlar yetkazish va fikrlarini o\'rganish:')
        .addFields(
          {
            name: '`/say [message] [channel]`',
            value: 'Bot nomidan istalgan kanalda oddiy matnli xabar yuborish.'
          },
          {
            name: '`/embed [title] [description] [color] [image] [thumbnail] [footer] [channel]`',
            value: 'Bot nomidan chiroyli ramkali, rangli va rasmli rasmiy e\'lon chiqarish (`\\n` yangi qator uchun).'
          },
          {
            name: '`/poll [question] [option1] [option2] [option3..5]`',
            value: '2 dan 5 tagacha variantli ovoz berish so\'rovnomasi. Emojilar orqali ovoz to\'playdi.'
          }
        )
        .setFooter({ text: 'Ruxsat: Manage Messages' }),

      general: new EmbedBuilder()
        .setColor(0x38BDF8)
        .setTitle('ℹ️ Umumiy va Ma\'lumot Buyruqlari')
        .setDescription('Barcha server a\'zolari foydalanishi mumkin bo\'lgan buyruqlar:')
        .addFields(
          {
            name: '`/lfg [game] [players] [voice_channel] [rank] [note]`',
            value: 'O\'yinga sheriklar (party/jamoa) yig\'ish uchun interaktiv e\'lon chiqarish (Qo\'shilish va chiqish tugmalari bilan).'
          },
          {
            name: '`/image [prompt] [style]`',
            value: 'Sun\'iy intellekt (Flux.1 / SDXL) orqali matndan mutlaqo bepul va cheksiz HD rasm yaratish.'
          },
          {
            name: '`/chats-list [yashirin]`',
            value: 'Serverdagi barcha kategoriyalar va ularning ichidagi kanallar (matnli, ovozli, e\'lonlar) ro\'yxatini chiqaradi.'
          },
          {
            name: '`/rank [user]`',
            value: 'O\'zingizning yoki boshqa a\'zoning darajasi (Level), tajribasi (XP), serverdagi o\'rni va progress barini ko\'rish.'
          },
          {
            name: '`/leaderboard`',
            value: 'Serverdagi eng faol a\'zolar TOP-10 reytingi va darajalarini ko\'rish.'
          },
          {
            name: '`/avatar [type] [user]`',
            value: 'O\'zingizning, serverning yoki boshqa foydalanuvchining rasmini **4096px HD** tiniq sifatda ko\'rish va yuklab olish.'
          },
          {
            name: '`/roles`',
            value: 'Serverdagi barcha rollar ro\'yxati va har bir rolda nechtadan a\'zo borligi.'
          },
          {
            name: '`/server-info`',
            value: 'Server statistikasi: egasi, ochilgan sana, a\'zolar soni, kanallar, boost darajasi.'
          },
          {
            name: '`/user-info [user]`',
            value: 'Foydalanuvchi hisobi qachon ochilgani, serverga qachon kirgani, rollari va jami warnlari.'
          },
          {
            name: '`/help`',
            value: 'Ushbu interaktiv qo\'llanma oynasini ochadi.'
          }
        )
        .setFooter({ text: 'Ruxsat: Hamma a\'zolar uchun ochiq' })
    };

    // Dropdown Select Menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Kerakli toifani tanlang...')
      .addOptions(
        {
          label: 'Asosiy Bosh Sahifa',
          description: 'Umumiy ko\'rinish va toifalar ro\'yxati',
          value: 'main',
          emoji: '🏠'
        },
        {
          label: 'Moderatsiya & Xavfsizlik',
          description: 'give-role, mute, warns, lock, unlock, clear...',
          value: 'moderation',
          emoji: '🛡️'
        },
        {
          label: 'Server Sozlamalari',
          description: 'set-log, set-ticket, set-autorole, set-antilink...',
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

    const inviteLink = process.env.SERVER_INVITE_URL || 'https://discord.gg/fwVyfrtP4h';
    const menuRow = new ActionRowBuilder().addComponents(selectMenu);
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('👑 Serverimizga Qo\'shiling')
        .setStyle(ButtonStyle.Link)
        .setURL(inviteLink)
    );

    const response = await interaction.reply({
      embeds: [mainEmbed],
      components: [menuRow, buttonRow],
      fetchReply: true
    });

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
        components: [menuRow, buttonRow]
      });
    });

    collector.on('end', async () => {
      selectMenu.setDisabled(true);
      const disabledRow = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.editReply({ components: [disabledRow, buttonRow] }).catch(() => {});
    });
  }
};
