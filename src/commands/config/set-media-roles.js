const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const storage = require('../../config/storage');

function buildMediaRolesEmbed(guild, mediaRoles, changesText = null) {
  const isEnabled = mediaRoles.enabled !== false;
  const rolesList = mediaRoles.roles && mediaRoles.roles.length > 0
    ? mediaRoles.roles.map(rId => `<@&${rId}>`).join(' ')
    : '*Hozircha hech qanday rol belgilanmagan.*';

  const embed = new EmbedBuilder()
    .setColor(isEnabled ? 0x57F287 : 0xED4245)
    .setTitle('📷 Rasm va GIF Yuborish Ruxsatlari (Media-Roles)')
    .setDescription(
      `${changesText ? `### 📝 O'zgarish:\n${changesText}\n\n` : ''}` +
      `**Tizim Holati:** ${isEnabled ? '🟢 **Faol (Yoqilgan)**' : '🔴 **O\'chirilgan**'}\n` +
      `*${isEnabled ? 'Faqat ruxsat berilgan rollarga ega a\'zolar rasm, video va GIF yuborishi mumkin.' : 'Barcha a\'zolar erkin rasm va GIF yuborishi mumkin.'}*\n\n` +
      `**Rasm/GIF yuborishga ruxsat etilgan rollar:**\n${rolesList}`
    )
    .addFields(
      {
        name: '🛡️ Imtiyozli A\'zolar (Cheklovsiz)',
        value: 'Server egasi, Administratorlar va Moderatorlar (`Manage Messages`) ushbu cheklovdan avtomatik ozod qilingan.',
        inline: false
      },
      {
        name: '💡 Qanday sozlash mumkin?',
        value: '• Pastdagi **Rol tanlash menyusi** orqali ruxsat beriladigan barcha rollarni belgilang.\n• Tugmalar orqali tizimni bir zumda yoqishingiz yoki tozalashingiz mumkin.',
        inline: false
      }
    )
    .setFooter({ text: 'Cleva • Media Permissions Manager' })
    .setTimestamp();

  return embed;
}

function buildMediaRolesComponents(mediaRoles) {
  const isEnabled = mediaRoles.enabled !== false;

  const roleSelectRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('media_roles_select')
      .setPlaceholder('Rasm va GIF yuborishga ruxsat etiladigan rollarni tanlang...')
      .setMinValues(0)
      .setMaxValues(15)
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('media_roles_toggle')
      .setLabel(isEnabled ? 'Tizimni O\'chirish' : 'Tizimni Yoqish')
      .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(isEnabled ? '🔴' : '🟢'),
    new ButtonBuilder()
      .setCustomId('media_roles_clear')
      .setLabel('Barcha Rollarni Tozalash')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🗑️')
  );

  return [roleSelectRow, buttonRow];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-media-roles')
    .setDescription('Faqat tanlangan rollarga rasm va GIF yuborish ruxsatini berish tizimi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addBooleanOption(option =>
      option.setName('status')
        .setDescription('Tizim holati (True = Yoqilgan, False = O\'chirilgan)')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('add_role')
        .setDescription('Ruxsat berilgan yangi rolni qo\'shish')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('remove_role')
        .setDescription('Ruxsat berilgan rolni ro\'yxatdan olib tashlash')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('clear_all')
        .setDescription('Barcha ruxsat berilgan rollarni tozalash (True)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const settings = storage.getGuildSettings(guild.id);
    let mediaRoles = {
      enabled: settings.mediaRoles?.enabled ?? false,
      roles: Array.isArray(settings.mediaRoles?.roles) ? [...settings.mediaRoles.roles] : []
    };

    const statusOpt = interaction.options.getBoolean('status');
    const addRoleOpt = interaction.options.getRole('add_role');
    const removeRoleOpt = interaction.options.getRole('remove_role');
    const clearAllOpt = interaction.options.getBoolean('clear_all');

    const changes = [];

    if (statusOpt !== null) {
      mediaRoles.enabled = statusOpt;
      changes.push(`• Tizim holati: ${statusOpt ? '🟢 **Yoqildi**' : '🔴 **O\'chirildi**'}`);
    }

    if (clearAllOpt) {
      mediaRoles.roles = [];
      changes.push('• Barcha ruxsat berilgan rollar tozalandi.');
    }

    if (addRoleOpt) {
      if (addRoleOpt.id === guild.id) {
        changes.push('• `@everyone` rolini ruxsat berilgan media roliga qo\'shib bo\'lmaydi.');
      } else if (mediaRoles.roles.includes(addRoleOpt.id)) {
        changes.push(`• ${addRoleOpt} allaqachon ruxsat berilgan rollar ro'yxatida bor.`);
      } else {
        mediaRoles.roles.push(addRoleOpt.id);
        changes.push(`• Yangi rol qo'shildi: ${addRoleOpt}`);
      }
    }

    if (removeRoleOpt) {
      if (!mediaRoles.roles.includes(removeRoleOpt.id)) {
        changes.push(`• ${removeRoleOpt} ruxsat berilgan rollar ro'yxatida yo'q edi.`);
      } else {
        mediaRoles.roles = mediaRoles.roles.filter(id => id !== removeRoleOpt.id);
        changes.push(`• Rol olib tashlandi: ${removeRoleOpt}`);
      }
    }

    if (changes.length > 0) {
      storage.updateGuildSettings(guild.id, { mediaRoles });
    }

    const embed = buildMediaRolesEmbed(guild, mediaRoles, changes.length > 0 ? changes.join('\n') : null);
    const components = buildMediaRolesComponents(mediaRoles);

    const replyMessage = await interaction.reply({
      embeds: [embed],
      components: components,
      fetchReply: true
    });

    // Interaktiv collector (5 daqiqa faol bo'ladi)
    const collector = replyMessage.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 300_000
    });

    collector.on('collect', async i => {
      const currentSettings = storage.getGuildSettings(guild.id);
      let updatedMediaRoles = {
        enabled: currentSettings.mediaRoles?.enabled ?? false,
        roles: Array.isArray(currentSettings.mediaRoles?.roles) ? [...currentSettings.mediaRoles.roles] : []
      };

      let actionText = '';

      if (i.customId === 'media_roles_select') {
        const selected = i.values.filter(rId => rId !== guild.id);
        updatedMediaRoles.roles = selected;
        actionText = `• Rollar ro'yxati yangilandi (${selected.length} ta rol tanlandi).`;
      } else if (i.customId === 'media_roles_toggle') {
        updatedMediaRoles.enabled = !updatedMediaRoles.enabled;
        actionText = `• Tizim holati o'zgartirildi: ${updatedMediaRoles.enabled ? '🟢 **Yoqildi**' : '🔴 **O\'chirildi**'}`;
      } else if (i.customId === 'media_roles_clear') {
        updatedMediaRoles.roles = [];
        actionText = '• Barcha ruxsat berilgan rollar tozalandi.';
      }

      storage.updateGuildSettings(guild.id, { mediaRoles: updatedMediaRoles });

      const newEmbed = buildMediaRolesEmbed(guild, updatedMediaRoles, actionText);
      const newComponents = buildMediaRolesComponents(updatedMediaRoles);

      await i.update({
        embeds: [newEmbed],
        components: newComponents
      }).catch(() => {});
    });

    collector.on('end', () => {
      replyMessage.edit({
        components: []
      }).catch(() => {});
    });
  }
};
