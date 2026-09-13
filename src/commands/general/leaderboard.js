const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Serverdagi eng faol a\'zolarning TOP-10 reytingini ko\'rish'),

  async execute(interaction) {
    const guild = interaction.guild;
    const { list, enabled } = storage.getLeaderboard(guild.id, 10);

    if (!enabled) {
      const disabledEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('ℹ️ Level & XP Tizimi O\'chirilgan')
        .setDescription(
          'Ushbu serverda Level & XP tizimi hozirda faol emas.\n\n' +
          '👑 **Administratorlar:** `/set-level status:Yoqish` buyrug\'i orqali tizimni faollashtirishi mumkin.'
        )
        .setTimestamp();

      return interaction.reply({ embeds: [disabledEmbed] });
    }

    if (list.length === 0) {
      return interaction.reply({
        content: 'ℹ️ Hozircha serverda faollik ko\'rsatgan a\'zolar mavjud emas. Chatda birinchi bo\'lib yozing!'
      });
    }

    const medals = ['🥇', '🥈', '🥉'];

    const description = list
      .map((entry, index) => {
        const medal = medals[index] || `\`#${index + 1}\``;
        return `${medal} <@${entry.id}> — **${entry.level}-daraja** (${entry.xp} XP) • *${entry.messages} ta xabar*`;
      })
      .join('\n\n');

    const leaderboardEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`🏆 ${guild.name} — Eng Faol A'zolar (TOP-10)`)
      .setDescription(description)
      .setFooter({ text: 'Cleva Leaderboard • Chatda yozing va yuqoriga ko\'tariling!' })
      .setTimestamp();

    return interaction.reply({ embeds: [leaderboardEmbed] });
  }
};
