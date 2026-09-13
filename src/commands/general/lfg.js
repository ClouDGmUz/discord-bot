const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { registerLfg, buildLfgEmbed, buildLfgButtons } = require('../../utils/lfgManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('O\'yinga sheriklar (party / jamoa) yig\'ish uchun e\'lon chiqarish')
    .addStringOption(option =>
      option
        .setName('game')
        .setDescription('Qaysi o\'yinni o\'ynamoqchisiz?')
        .setRequired(true)
        .addChoices(
          { name: '🔫 CS2 (Counter-Strike 2)', value: 'CS2' },
          { name: '🛡️ Dota 2', value: 'Dota 2' },
          { name: '🚗 GTA V (GTA Online / RP)', value: 'GTA V' },
          { name: '🌳 Minecraft', value: 'Minecraft' },
          { name: '🔲 Roblox', value: 'Roblox' },
          { name: '🎯 PUBG (Battlegrounds)', value: 'PUBG' },
          { name: '⚡ Valorant', value: 'Valorant' },
          { name: '🎮 Boshqa o\'yin', value: 'Boshqa o\'yin' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('players')
        .setDescription('Jamoa jami necha kishi bo\'lishi kerak? (Siz bilan birga)')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(10)
    )
    .addChannelOption(option =>
      option
        .setName('voice_channel')
        .setDescription('O\'ynash uchun ovozli kanal (Tanlanmasa, siz o\'tirgan kanal olinadi)')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('rank')
        .setDescription('Daraja yoki mahorat talabi (Masalan: Gold Nova, Master, Har qanday)')
        .setRequired(false)
        .setMaxLength(50)
    )
    .addStringOption(option =>
      option
        .setName('note')
        .setDescription('Qo\'shimcha izoh yoki talab (Masalan: Mirage o\'ynaymiz, mikrafon bo\'lsin)')
        .setRequired(false)
        .setMaxLength(150)
    ),

  async execute(interaction) {
    const game = interaction.options.getString('game');
    const players = interaction.options.getInteger('players');
    let voiceChannel = interaction.options.getChannel('voice_channel');
    const rank = interaction.options.getString('rank');
    const note = interaction.options.getString('note');

    // Agar ovozli kanal tanlanmagan bo'lsa, foydalanuvchi hozir o'tirgan ovozli kanalni olish
    if (!voiceChannel && interaction.member.voice?.channelId) {
      voiceChannel = interaction.guild.channels.cache.get(interaction.member.voice.channelId);
    }

    const lfgId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

    const lfgData = registerLfg({
      id: lfgId,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      hostId: interaction.user.id,
      game,
      maxPlayers: players,
      participants: [interaction.user.id],
      voiceChannelId: voiceChannel ? voiceChannel.id : null,
      rank: rank || null,
      note: note || null,
      closed: false
    });

    const embed = buildLfgEmbed(lfgData, interaction.guild);
    const buttons = buildLfgButtons(lfgData);

    await interaction.reply({
      embeds: [embed],
      components: [buttons]
    });
  }
};
