const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-ticket')
    .setDescription('Yordam va murojaatlar (Ticket) tizimini sozlaydi va tugmali panelni joylashtiradi')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Tugmali ticket paneli joylashadigan asosiy kanal')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('category')
        .setDescription('Yangi ochiladigan ticketlar qaysi kategoriya ichida ochilsin?')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('support_role')
        .setDescription('Murojaatlarni ko\'ra oladigan moderator/support roli (ixtiyoriy)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const category = interaction.options.getChannel('category');
    const supportRole = interaction.options.getRole('support_role');
    const guild = interaction.guild;

    // Bot ruxsatlarini tekshirish
    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ Botda kanallarni boshqarish (**Manage Channels**) ruxsati yo\'q! Ticket tizimi ishlashi uchun botga ushbu ruxsatni bering.',
        ephemeral: true
      });
    }

    // Sozlamalarni saqlash
    storage.updateGuildSettings(guild.id, {
      ticketChannelId: channel.id,
      ticketCategoryId: category.id,
      supportRoleId: supportRole ? supportRole.id : null
    });

    // Asosiy kanalda chiqadigan chiroyli panel
    const panelEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📩 Qo\'llab-quvvatlash va Murojaat Markazi')
      .setDescription(
        'Savollaringiz, takliflaringiz yoki shikoyatlaringiz bormi?\n\n' +
        'Pastdagi **"Murojaat Ochish"** tugmasini bosing. Siz va ma\'muriyat uchun maxsus shaxsiy kanal ochiladi.\n\n' +
        '⚡ *Iltimos, behuda murojaat ochmang.*'
      )
      .setFooter({ text: `${guild.name} • Qo'llab-quvvatlash xizmati` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('📩 Murojaat Ochish')
        .setStyle(ButtonStyle.Primary)
    );

    try {
      await channel.send({ embeds: [panelEmbed], components: [row] });

      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Ticket Tizimi Muvaffaqiyatli Sozlandi')
        .addFields(
          { name: 'Asosiy Panel Kanali', value: `<#${channel.id}>`, inline: true },
          { name: 'Ticketlar Kategoriyasi', value: `**${category.name}**`, inline: true },
          { name: 'Support Roli', value: supportRole ? `${supportRole}` : 'Faqat Adminlar', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (error) {
      console.error('Set-ticket xatosi:', error);
      await interaction.reply({
        content: `❌ Xatolik yuz berdi: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
