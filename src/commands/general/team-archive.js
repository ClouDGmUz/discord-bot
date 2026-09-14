const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const storage = require('../../config/storage');
const {
  createTeamCardEmbed,
  showTeamCardModal
} = require('../../utils/teamArchiveManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team-archive')
    .setDescription('MEGA TEAM a\'zolarining dosye kartochkalari va rasmiy arxivi')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub.setName('card')
        .setDescription('O\'z kartochkangizni yoki (rahbariyat uchun) a\'zo kartochkasini to\'ldirish / tahrirlash')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Kartochkasi to\'ldiriladigan a\'zo (Faqat Rahbariyat uchun)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('A\'zoning rasmiy kartochkasi va ma\'lumotlarini ko\'rish')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Ma\'lumotlarini ko\'rmoqchi bo\'lgan a\'zo (bo\'sh qoldirilsa o\'zingiz)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Arxivlangan barcha jamoa a\'zolari ro\'yxatini ko\'rish')
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('A\'zo kartochkasini arxivdan o\'chirish (Faqat Rahbariyat)')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Arxivdan o\'chiriladigan a\'zo')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const { guild, user, member } = interaction;
    const subcommand = interaction.options.getSubcommand();
    const settings = storage.getGuildSettings(guild.id);
    const headRoleId = settings.teamArchive?.headRoleId;
    const moderRoleId = settings.teamArchive?.moderRoleId;

    const isHead = (headRoleId && member.roles.cache.has(headRoleId)) || member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = isHead || (moderRoleId && member.roles.cache.has(moderRoleId));
    const allowPublicView = settings.teamArchive?.allowPublicView !== false;
    const canViewOthers = isStaff || allowPublicView;

    // 1. SUBCOMMAND: card (To'ldirish / Tahrirlash)
    if (subcommand === 'card') {
      const targetUser = interaction.options.getUser('user');

      if (targetUser && targetUser.id !== user.id && !isHead) {
        return interaction.reply({
          content: '❌ Boshqa a\'zoning kartochkasini faqat Rahbariyat to\'ldirishi yoki tahrirlashi mumkin!',
          flags: MessageFlags.Ephemeral
        });
      }

      const effectiveTargetId = targetUser ? targetUser.id : user.id;
      const existingData = storage.getTeamMember(guild.id, effectiveTargetId);

      await showTeamCardModal(interaction, existingData, effectiveTargetId);
      return;
    }

    // 2. SUBCOMMAND: view (Kartochkani ko'rish)
    if (subcommand === 'view') {
      const targetUser = interaction.options.getUser('user') || user;

      // Agar boshqaning kartochkasini ko'rmoqchi bo'lsa va ruxsat berilmagan bo'lsa
      if (targetUser.id !== user.id && !canViewOthers) {
        return interaction.reply({
          content: '❌ Jamoa a\'zolari dosyelari maxfiy qilib sozlangan (Faqat Rahbariyat / Moderatorlar ko\'ra oladi).',
          flags: MessageFlags.Ephemeral
        });
      }

      const memberData = storage.getTeamMember(guild.id, targetUser.id);
      if (!memberData) {
        return interaction.reply({
          content: targetUser.id === user.id
            ? '⚠️ Sizning kartochkangiz hali to\'ldirilmagan. To\'ldirish uchun `/team-archive card` buyrug\'ini yozing.'
            : `⚠️ <@${targetUser.id}> a'zosining kartochkasi hali to'ldirilmagan.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      const embed = createTeamCardEmbed(targetMember, memberData, targetUser);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`team_card_edit_btn_${targetUser.id}`)
          .setLabel('✏️ Tahrirlash')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    // 3. SUBCOMMAND: list (Barcha a'zolar ro'yxati)
    if (subcommand === 'list') {
      if (!canViewOthers) {
        return interaction.reply({
          content: '❌ Arxivdagi a\'zolar ro\'yxati maxfiy qilib sozlangan (Faqat Rahbariyat / Moderatorlar ko\'ra oladi).',
          flags: MessageFlags.Ephemeral
        });
      }

      const allMembers = storage.getAllTeamMembers(guild.id);
      const memberEntries = Object.entries(allMembers);

      if (memberEntries.length === 0) {
        return interaction.reply({
          content: 'ℹ️ Hozircha hech qanday a\'zo kartochkasi arxivlanmagan.',
          flags: MessageFlags.Ephemeral
        });
      }

      const lines = memberEntries.map(([uid, data], index) => {
        const game = data.mainGameRole ? ` • 🎮 ${data.mainGameRole}` : '';
        const pos = data.teamPosition ? ` [${data.teamPosition}]` : '';
        return `**${index + 1}.** <@${uid}> — **${data.fullName || 'Noma\'lum'}**${pos}${game}`;
      });

      // Embedda bo'lib chiqarish
      const listEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📁 MEGA TEAM Arxivlangan A'zolari (${memberEntries.length} ta)`)
        .setDescription(lines.slice(0, 25).join('\n'))
        .setFooter({ text: 'MEGA TEAM ARCHIVE • Batafsil dosye uchun: /team-archive view [user]' })
        .setTimestamp();

      return interaction.reply({
        embeds: [listEmbed],
        flags: MessageFlags.Ephemeral
      });
    }

    // 4. SUBCOMMAND: remove (Arxivdan o'chirish)
    if (subcommand === 'remove') {
      if (!isHead) {
        return interaction.reply({
          content: '❌ A\'zoni arxivdan o\'chirish faqat Rahbariyat huquqiga kiradi!',
          flags: MessageFlags.Ephemeral
        });
      }

      const targetUser = interaction.options.getUser('user');
      const removed = storage.removeTeamMember(guild.id, targetUser.id);

      if (!removed) {
        return interaction.reply({
          content: `⚠️ <@${targetUser.id}> a'zosining kartochkasi arxivda topilmadi.`,
          flags: MessageFlags.Ephemeral
        });
      }

      return interaction.reply({
        content: `✅ <@${targetUser.id}> (${removed.fullName || targetUser.tag}) a'zosining kartochkasi arxivdan muvaffaqiyatli o'chirildi.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
