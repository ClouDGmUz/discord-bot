const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Foydalanuvchi yoki Server rasmini eng yuqori (4096px) sifatda ko\'rsatadi')
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

    // Server rasmi tanlangan bo'lsa
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

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🏰 ${guild.name} — Server Rasmi`)
        .setFooter({ text: `Server ID: ${guild.id}` })
        .setTimestamp();

      const components = [];
      const row = new ActionRowBuilder();

      if (iconUrl) {
        embed.setImage(iconUrl);
        row.addComponents(
          new ButtonBuilder()
            .setLabel('Server Icon (4096px)')
            .setStyle(ButtonStyle.Link)
            .setURL(iconUrl)
        );
      }

      if (bannerUrl) {
        embed.addFields({ name: 'Banner', value: `[Server Bannerini Ko'rish](${bannerUrl})` });
        row.addComponents(
          new ButtonBuilder()
            .setLabel('Server Banner')
            .setStyle(ButtonStyle.Link)
            .setURL(bannerUrl)
        );
      }

      if (row.components.length > 0) {
        components.push(row);
      }

      return interaction.reply({ embeds: [embed], components });
    }

    // Foydalanuvchi avatari (agar user ko'rsatilgan bo'lsa yoki 'self' bo'lsa yoki default)
    const targetUser = targetUserOption || interaction.user;
    const member = guild ? await guild.members.fetch(targetUser.id).catch(() => null) : null;

    // Asosiy avatar va serverdagi maxsus avatar
    const globalAvatar = targetUser.displayAvatarURL({ dynamic: true, size: 4096 });
    const serverAvatar = member ? member.avatarURL({ dynamic: true, size: 4096 }) : null;

    const displayUrl = serverAvatar || globalAvatar;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🖼️ ${targetUser.tag} Avatari (4096px HD)`)
      .setImage(displayUrl)
      .setFooter({ text: `Foydalanuvchi ID: ${targetUser.id}` })
      .setTimestamp();

    if (serverAvatar) {
      embed.setDescription(`*Ushbu foydalanuvchida server uchun maxsus avatar o'rnatilgan.*`);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('PNG (Tiniq)')
        .setStyle(ButtonStyle.Link)
        .setURL(targetUser.displayAvatarURL({ extension: 'png', size: 4096 })),
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

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
