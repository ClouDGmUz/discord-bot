const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Foydalanuvchining asosiy avatari, server avatari va bannerini eng yuqori (4096px) sifatda ko\'rsatadi')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Kimning/nimaning rasmini ko\'rmoqchisiz?')
        .setRequired(false)
        .addChoices(
          { name: 'O\'zimning avatarim', value: 'self' },
          { name: 'Server rasmi (Icon & Banner)', value: 'server' },
          { name: 'Boshqa foydalanuvchi', value: 'user' }
        )
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Foydalanuvchi (agar "user" tanlansa)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const targetUserOption = interaction.options.getUser('user');
    const guild = interaction.guild;

    // 1. SERVER RASMI (Icon & Banner) TANLANGAN BO'LSA
    if (type === 'server') {
      if (!guild) {
        return interaction.reply({
          content: '❌ Ushbu buyruq faqat server ichida ishlaydi.',
          ephemeral: true
        });
      }

      const iconUrl = guild.iconURL({ dynamic: true, size: 4096 });
      const bannerUrl = guild.bannerURL({ dynamic: true, size: 4096 });

      if (!iconUrl && !bannerUrl) {
        return interaction.reply({
          content: '❌ Ushbu serverda rasm (icon) yoki banner o\'rnatilmagan.',
          ephemeral: true
        });
      }

      const embeds = [];
      const row = new ActionRowBuilder();

      if (iconUrl) {
        const iconEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`🏰 ${guild.name} — Server Iconi (4096px HD)`)
          .setURL(iconUrl)
          .setImage(iconUrl)
          .setFooter({ text: `Server ID: ${guild.id}` })
          .setTimestamp();

        embeds.push(iconEmbed);

        row.addComponents(
          new ButtonBuilder()
            .setLabel('Server Icon (PNG)')
            .setStyle(ButtonStyle.Link)
            .setURL(guild.iconURL({ extension: 'png', size: 4096 }))
        );
      }

      if (bannerUrl) {
        const bannerEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`🎨 ${guild.name} — Server Banneri`)
          .setURL(bannerUrl)
          .setImage(bannerUrl)
          .setFooter({ text: `Server ID: ${guild.id}` })
          .setTimestamp();

        embeds.push(bannerEmbed);

        row.addComponents(
          new ButtonBuilder()
            .setLabel('Server Banner')
            .setStyle(ButtonStyle.Link)
            .setURL(bannerUrl)
        );
      }

      const components = row.components.length > 0 ? [row] : [];
      return interaction.reply({ embeds, components });
    }

    // 2. FOYDALANUVCHI AVATARI
    const targetUser = targetUserOption || interaction.user;
    const member = guild ? await guild.members.fetch(targetUser.id).catch(() => null) : null;
    const fetchedUser = await targetUser.fetch().catch(() => targetUser);

    // Asosiy profil avatari (Foydalanuvchining o'zining shaxsiy avatari)
    const globalAvatar = targetUser.displayAvatarURL({ dynamic: true, size: 4096 });
    // Serverdagi maxsus avatar (agar server uchun alohida profil rasmi qo'ygan bo'lsa)
    const serverAvatar = member ? member.avatarURL({ dynamic: true, size: 4096 }) : null;
    // Profil banneri
    const userBanner = fetchedUser?.bannerURL ? fetchedUser.bannerURL({ dynamic: true, size: 4096 }) : null;

    const embeds = [];
    const row = new ActionRowBuilder();

    // 2.1. Foydalanuvchining ASOSIY (o'zining shaxsiy) avatari
    const mainEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🖼️ ${targetUser.displayName || targetUser.username} — Asosiy Avatari (Global HD)`)
      .setURL(globalAvatar)
      .setImage(globalAvatar)
      .setFooter({ text: `Foydalanuvchi ID: ${targetUser.id}` })
      .setTimestamp();

    if (serverAvatar) {
      mainEmbed.setDescription('📌 *Ushbu a\'zoning Discord hisobidagi asosiy (shaxsiy) avatari.*');
    }

    embeds.push(mainEmbed);

    row.addComponents(
      new ButtonBuilder()
        .setLabel('Asosiy Avatar (PNG)')
        .setStyle(ButtonStyle.Link)
        .setURL(targetUser.displayAvatarURL({ extension: 'png', size: 4096 }))
    );

    // 2.2. Agar SERVER uchun maxsus avatar o'rnatilgan bo'lsa — uni ham alohida chiqarish
    if (serverAvatar) {
      const serverEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`🏰 ${targetUser.displayName || targetUser.username} — Server Avatari (${guild?.name || 'Server'})`)
        .setURL(serverAvatar)
        .setImage(serverAvatar)
        .setDescription('📌 *Ushbu a\'zoning faqat ushbu server uchun o\'rnatilgan maxsus avatari.*')
        .setFooter({ text: `Server Avatari • ID: ${targetUser.id}` })
        .setTimestamp();

      embeds.push(serverEmbed);

      row.addComponents(
        new ButtonBuilder()
          .setLabel('Server Avatari (PNG)')
          .setStyle(ButtonStyle.Link)
          .setURL(serverAvatar)
      );
    }

    // 2.3. Agar foydalanuvchida Profil Banneri mavjud bo'lsa — uni ham qo'shish
    if (userBanner) {
      const bannerEmbed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(`🎨 ${targetUser.displayName || targetUser.username} — Profil Banneri`)
        .setURL(userBanner)
        .setImage(userBanner)
        .setFooter({ text: `Profil Banneri • ID: ${targetUser.id}` })
        .setTimestamp();

      embeds.push(bannerEmbed);

      row.addComponents(
        new ButtonBuilder()
          .setLabel('Banner (PNG)')
          .setStyle(ButtonStyle.Link)
          .setURL(userBanner)
      );
    }

    // 2.4. JPG va GIF tugmalari
    row.addComponents(
      new ButtonBuilder()
        .setLabel('JPG')
        .setStyle(ButtonStyle.Link)
        .setURL(targetUser.displayAvatarURL({ extension: 'jpg', size: 4096 }))
    );

    if (targetUser.avatar?.startsWith('a_')) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('GIF (Harakatlanuvchi)')
          .setStyle(ButtonStyle.Link)
          .setURL(targetUser.displayAvatarURL({ extension: 'gif', size: 4096 }))
      );
    }

    return interaction.reply({ embeds, components: [row] });
  }
};
