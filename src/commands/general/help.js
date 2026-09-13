const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Botdagi barcha buyruqlar va ularning vazifalari haqida ma\'lumot'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Discord Bot Buyruqlar Qo\'llanmasi')
      .setDescription('Quyida botdagi barcha mavjud slash buyruqlar keltirilgan:')
      .addFields(
        {
          name: '🛡️ Moderatsiya Buyruqlari',
          value: [
            '`/give-role` — Foydalanuvchiga belgilangan rolni berish',
            '`/remove-role-from` — 1-rolni 2-roli bor barcha a\'zolardan olib tashlash',
            '`/mute` — Foydalanuvchini vaqtinchalik ovozini o\'chirish (Timeout)',
            '`/unmute` — Mute jazo muddatini bekor qilish',
            '`/del-warn` — Xabarni o\'chirib foydalanuvchiga ogohlantirish (warn) berish',
            '`/clear` — Chatdagi xabarlarni ommaviy tozalash (1-100 ta)'
          ].join('\n')
        },
        {
          name: '⚙️ Server Sozlamalari',
          value: [
            '`/set-log` — Barcha server voqealari (xabar o\'chishi, a\'zo kirishi va h.k.) yoziladigan log kanalini belgilash',
            '`/set-welcome` — Yangi a\'zolar kirganda xabar yuboriladigan kanal va matnni sozlash'
          ].join('\n')
        },
        {
          name: 'ℹ️ Umumiy Buyruqlar',
          value: [
            '`/avatar` — Foydalanuvchi yoki Server rasmini 4096px tiniq sifatda ko\'rish',
            '`/roles` — Serverdagi barcha rollar ro\'yxati va a\'zolar soni',
            '`/server-info` — Server haqida to\'liq ma\'lumotlar va statistika',
            '`/user-info` — Foydalanuvchi profili, kirgan vaqti va ogohlantirishlari',
            '`/help` — Ushbu yordam oynasini chiqarish'
          ].join('\n')
        }
      )
      .setFooter({ text: `So'rovchi: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
