const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-active-role')
    .setDescription('Kunlik faol a\'zolarga avtomat rol berish va kirmasa olib tashlash tizimini sozlaydi')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Kunlik faollik normasini bajarganlarga beriladigan maxsus rol')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('voice_minutes')
        .setDescription('Talab qilinadigan kunlik ovozli vaqt (daqiqada, masalan: 45)')
        .setMinValue(1)
        .setMaxValue(720)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('messages_count')
        .setDescription('Talab qilinadigan kunlik xabarlar soni (masalan: 20)')
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Faollikni qanday hisoblash kerak?')
        .addChoices(
          { name: '🎙️ Ovoz YOKI 💬 Chat (Birortasi bajarilsa yetarli)', value: 'voice_or_messages' },
          { name: '🎙️ Faqat ovozli xona vaqti', value: 'voice_only' },
          { name: '💬 Faqat chatdagi xabarlar soni', value: 'messages_only' },
          { name: '⚡ Ovoz VA Chat (Ikkalasi ham bajarilishi shart)', value: 'voice_and_messages' }
        )
        .setRequired(false)
    )
    .addChannelOption(option =>
      option.setName('log_channel')
        .setDescription('Tabriknoma va rol yangilanishlari chiqadigan kanal')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('send_message')
        .setDescription('Rol berilganda xabar jo\'natish (False = aytib o\'tirmay, jim beradi)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('silent')
        .setDescription('Jim rejim: aytib o\'tirmasdan rol berish (True = xabarsiz, jim beradi)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('clear_log_channel')
        .setDescription('Tabriknoma kanalini o\'chirib tashlash (tozalash)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('status')
        .setDescription('Tizim holati (True = Yoqish, False = To\'xtatib turish)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('disable')
        .setDescription('Faollik roli tizimini butunlay o\'chirib qo\'yish')
        .setRequired(false)
    ),

  async execute(interaction) {
    const { guild } = interaction;
    const role = interaction.options.getRole('role');
    const voiceMinutes = interaction.options.getInteger('voice_minutes');
    const messagesCount = interaction.options.getInteger('messages_count');
    const mode = interaction.options.getString('mode');
    const logChannel = interaction.options.getChannel('log_channel');
    const sendMessageOpt = interaction.options.getBoolean('send_message');
    const silentOpt = interaction.options.getBoolean('silent');
    const clearLogChannel = interaction.options.getBoolean('clear_log_channel');
    const status = interaction.options.getBoolean('status');
    const disable = interaction.options.getBoolean('disable');

    const settings = storage.getActiveRoleSettings(guild.id);

    // 1. BUTUNLAY O'CHIRISH (Disable)
    if (disable) {
      storage.updateActiveRoleSettings(guild.id, {
        enabled: false,
        roleId: null,
        logChannelId: null
      });

      const disableEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔴 Kunlik Faollik Roli Tizimi O\'chirildi')
        .setDescription('Serverda kunlik faollik bo\'yicha rol berish tizimi to\'xtatildi.')
        .setFooter({ text: 'Qayta yoqish uchun: /set-active-role role:[Rol]' })
        .setTimestamp();

      return interaction.reply({ embeds: [disableEmbed] });
    }

    // 2. PARAMETR KIRITILMAGAN BO'LSA — JORIY HOLATNI KO'RSATISH
    if (
      !role &&
      voiceMinutes === null &&
      messagesCount === null &&
      !mode &&
      !logChannel &&
      status === null &&
      sendMessageOpt === null &&
      silentOpt === null &&
      !clearLogChannel
    ) {
      const isEnabled = settings.enabled && settings.roleId;
      const isSilent = settings.sendMessage === false || settings.silent === true;
      const sendMsgText = isSilent
        ? '🔇 **Jim rejim (Aytib o\'tirmay beradi, xabarsiz)**'
        : (settings.logChannelId ? `📢 **Yoqilgan (<#${settings.logChannelId}> ga yuboriladi)**` : '⚠️ **Kanal belgilanmagan (xabar yuborilmaydi)**');

      const modeNames = {
        voice_or_messages: '🎙️ Ovoz YOKI 💬 Chat (Birortasi yetarli)',
        voice_only: '🎙️ Faqat ovozli xonada o\'tirish',
        messages_only: '💬 Faqat chatda xabar yozish',
        voice_and_messages: '⚡ Ovoz VA Chat (Ikkalasi ham shart)'
      };

      const statusEmbed = new EmbedBuilder()
        .setColor(isEnabled ? 0x57F287 : 0xFEE75C)
        .setTitle('⚙️ Kunlik Faollik Roli Tizimi Sozlamalari')
        .setDescription(
          `**Tizim Holati:** ${isEnabled ? '🟢 **Faol (Yoqilgan)**' : '🔴 **O\'chirilgan / Sozlanmagan**'}\n\n` +
          `• 🎖️ **Beriladigan Rol:** ${settings.roleId ? `<@&${settings.roleId}>` : '*Belgilanmagan*'}\n` +
          `• 🎙️ **Talab qilinadigan ovoz:** **${settings.voiceMinutes || 45} daqiqa**\n` +
          `• 💬 **Talab qilinadigan xabar:** **${settings.messageCount || 20} ta**\n` +
          `• 🎯 **Hisoblash Tartibi:** ${modeNames[settings.mode] || modeNames.voice_or_messages}\n` +
          `• 📢 **E'lon / Log Kanali:** ${settings.logChannelId ? `<#${settings.logChannelId}>` : '*O\'rnatilmagan*'}\n` +
          `• 🔕 **Xabar / Bildirishnoma:** ${sendMsgText}\n` +
          `• ⏳ **Ertasiga kirmasa:** Rol avtomatik olib tashlanadi (Inactivity Removal)`
        )
        .addFields({
          name: '💡 Qanday sozlash mumkin?',
          value:
            '• **Tezkor yoqish:** `/set-active-role role:@Faol voice_minutes:45 messages_count:20`\n' +
            '• **Jim rejim (aytib o\'tirmaslik):** `/set-active-role send_message:False` *(yoki `silent:True`)*\n' +
            '• **Xabarlarni qayta yoqish:** `/set-active-role send_message:True`\n' +
            '• **Faqat ovozli xona uchun:** `/set-active-role role:@Faol mode:voice_only voice_minutes:60`\n' +
            '• **O\'chirish:** `/set-active-role disable:True`'
        })
        .setFooter({ text: 'Cleva • Daily Active Role System' })
        .setTimestamp();

      return interaction.reply({ embeds: [statusEmbed] });
    }

    // 3. YANGI SOZLAMALARNI SAQLASH
    await interaction.deferReply();

    // Bot ierarxiyasini tekshirish
    if (role) {
      const botMember = guild.members.me;
      if (botMember && botMember.roles.highest.position <= role.position) {
        return interaction.editReply({
          content: `❌ Botning roli (**${botMember.roles.highest.name}**) siz tanlagan roldan (**${role.name}**) pastda yoki teng! Iltimos, server sozlamalarida bot rolini yuqoriroqqa qo'ying.`
        });
      }
    }

    const updatePayload = {};
    if (role) updatePayload.roleId = role.id;
    if (voiceMinutes !== null) updatePayload.voiceMinutes = voiceMinutes;
    if (messagesCount !== null) updatePayload.messageCount = messagesCount;
    if (mode) updatePayload.mode = mode;
    if (logChannel) updatePayload.logChannelId = logChannel.id;
    if (clearLogChannel) updatePayload.logChannelId = null;

    if (sendMessageOpt !== null) {
      updatePayload.sendMessage = sendMessageOpt;
      updatePayload.silent = !sendMessageOpt;
    }
    if (silentOpt !== null) {
      updatePayload.sendMessage = !silentOpt;
      updatePayload.silent = silentOpt;
    }

    if (status !== null) updatePayload.enabled = status;
    else if (role || updatePayload.roleId || settings.roleId) updatePayload.enabled = true;

    const updated = storage.updateActiveRoleSettings(guild.id, updatePayload);

    const modeLabels = {
      voice_or_messages: '🎙️ Ovoz YOKI 💬 Chat (Birortasi yetarli)',
      voice_only: '🎙️ Faqat ovozli xonada o\'tirish',
      messages_only: '💬 Faqat chatda xabar yozish',
      voice_and_messages: '⚡ Ovoz VA Chat (Ikkalasi ham shart)'
    };

    const isSilent = updated.sendMessage === false || updated.silent === true;
    const sendMsgDisplay = isSilent
      ? '🔇 **Jim rejim (Aytib o\'tirmay, xabarsiz beradi)**'
      : (updated.logChannelId ? `📢 **Yoqilgan (<#${updated.logChannelId}> ga yuboriladi)**` : '⚠️ **Kanal belgilanmagan (xabar yuborilmaydi)**');

    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Kunlik Faollik Roli Tizimi Muvaffaqiyatli Sozlandi!')
      .setDescription(
        'Serverda kunlik mezonlarni bajargan a\'zolarga avtomatik rol beriladi va keyingi kuni kirmasa avtomatik olib tashlanadi.\n\n' +
        `• 🎖️ **Faollik Roli:** ${updated.roleId ? `<@&${updated.roleId}>` : '*Belgilanmagan*'}\n` +
        `• 🟢 **Holati:** ${updated.enabled ? 'Yoqilgan' : 'O\'chirilgan'}\n` +
        `• 🎙️ **Kunlik ovoz normasi:** **${updated.voiceMinutes} daqiqa**\n` +
        `• 💬 **Kunlik xabar normasi:** **${updated.messageCount} ta**\n` +
        `• 🎯 **Hisoblash tartibi:** ${modeLabels[updated.mode] || modeLabels.voice_or_messages}\n` +
        `• 📢 **Tabriknoma kanali:** ${updated.logChannelId ? `<#${updated.logChannelId}>` : '*O\'rnatilmagan*'}\n` +
        `• 🔕 **Xabar / Bildirishnoma:** ${sendMsgDisplay}`
      )
      .addFields({
        name: '🚀 Tizim qoidalari:',
        value:
          `1. A\'zo mezonni bajarsa — unga **darhol** rol beriladi ${isSilent ? '*(jim rejimda, aytib o\'tirmasdan)*' : '*(va tabriknoma jo\'natiladi)*'};\n` +
          `2. Agar a\'zo ertasi kuni kirmasa yoki faol bo\'lmasa — roldan **avtomatik** mahrum etiladi ${isSilent ? '*(jim rejimda)*' : ''};\n` +
          '3. Har bir a\'zo o\'z faolligini istalgan payt **/activity** buyrug\'i orqali tekshirib borishi mumkin.'
      })
      .setFooter({ text: 'Cleva • Daily Active Role System' })
      .setTimestamp();

    return interaction.editReply({ embeds: [successEmbed] });
  }
};
