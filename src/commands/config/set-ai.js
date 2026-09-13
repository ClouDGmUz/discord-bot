const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-ai')
    .setDescription('Cleva AI Chatbot tizimini sozlash (yoqish yoki o\'chirish)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('status')
        .setDescription('AI Chatbot holatini tanlang')
        .setRequired(true)
        .addChoices(
          { name: '✅ Yoqish (AI suhbatdoshni faollashtirish)', value: 'enable' },
          { name: '❌ O\'chirish (AI chatni to\'xtatish)', value: 'disable' }
        )
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('AI suhbat uchun maxsus kanal (Tanlanmasa, avtomatik yaratiladi)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const isOwner = process.env.OWNER_ID && interaction.user.id === process.env.OWNER_ID.trim();
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !isOwner) {
      return interaction.reply({
        content: '❌ Ushbu buyruqdan foydalanish uchun sizda `Administrator` yoki `Manage Server` ruxsati bo\'lishi kerak.',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    const statusChoice = interaction.options.getString('status');
    let targetChannel = interaction.options.getChannel('channel');
    const guild = interaction.guild;
    const settings = storage.getGuildSettings(guild.id);
    const isEnable = statusChoice === 'enable';

    if (isEnable) {
      // Agar kanal ko'rsatilmagan bo'lsa, serverdan qidirish yoki yangi yaratish
      if (!targetChannel) {
        targetChannel = guild.channels.cache.find(c =>
          c.type === ChannelType.GuildText &&
          (c.name.includes('cleva-ai') || c.name.includes('ai-chat'))
        );

        if (!targetChannel) {
          try {
            targetChannel = await guild.channels.create({
              name: '🤖・cleva-ai',
              type: ChannelType.GuildText,
              topic: 'Cleva AI — MEGA TEAM sun\'iy intellekt yordamchisi bilan savol-javob kanali'
            });

            // Yangi kanalga kirish embedini yuborish
            const introEmbed = new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('🤖 Cleva AI — MEGA TEAM Aqlli Yordamchisi!')
              .setDescription(
                'Assalomu alaykum! Ushbu kanal **Cleva AI** bilan o\'zbek tilida bevosita muloqot qilish uchun yaratildi.\n\n' +
                '💡 **Bu yerda nimalar qila olasiz?**\n' +
                '• 🎮 O\'yinlar (CS2, Dota 2, GTA V, Minecraft, Roblox) bo\'yicha maslahat va yordam so\'rash\n' +
                '• 💻 Kompyuter, dasturlash va texnologiya bo\'yicha savollar berish\n' +
                '• 📝 Matnlar, g\'oyalar va har qanday qiziqarli mavzularda suhbatlashish\n\n' +
                '📌 **Qanday ishlatiladi?**\n' +
                'Shunchaki xabaringizni yozib yuboring — bot darhol sizga javob qaytaradi!'
              )
              .setFooter({ text: 'Cleva AI • Powered by Google Gemini' })
              .setTimestamp();

            await targetChannel.send({ embeds: [introEmbed] });
          } catch (err) {
            console.error('AI kanal yaratishda xato:', err);
            return interaction.editReply({
              content: `❌ AI kanalini yaratishda xatolik yuz berdi: ${err.message}`
            });
          }
        }
      }

      storage.updateGuildSettings(guild.id, {
        aiChat: {
          enabled: true,
          channelId: targetChannel.id
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🤖 Cleva AI Chatbot Faollashtirildi!')
        .setDescription(
          `✅ **Cleva AI muvaffaqiyatli ishga tushirildi!**\n\n` +
          `📢 **AI suhbat kanali:** <#${targetChannel.id}>\n` +
          `🧠 **Model:** Google Gemini Flash\n` +
          `💬 **Foydalanish:** <#${targetChannel.id}> kanalida istalgan savol yozilsa, bot o'zbek tilida javob beradi. Shuningdek, boshqa kanallarda botni \`@Cleva\` qilib chaqirib ham savol berish mumkin.`
        )
        .setFooter({ text: 'Cleva AI Tizimi' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } else {
      storage.updateGuildSettings(guild.id, {
        aiChat: {
          ...(settings.aiChat || {}),
          enabled: false
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🤖 Cleva AI Chatbot O\'chirildi')
        .setDescription('❌ **AI Chatbot tizimi vaqtincha to\'xtatildi.** Endi bot savollarga avtomatik javob bermaydi.')
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
