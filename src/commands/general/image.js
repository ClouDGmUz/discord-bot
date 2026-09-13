const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { generateAiImage } = require('../../utils/imageGenerator');

const STYLES = {
  cyberpunk: { name: '🌆 Kiberpank', prompt: 'cyberpunk aesthetic, neon lighting, futuristic city, highly detailed, octane render' },
  anime: { name: '🌸 Anime', prompt: 'beautiful anime art style, Makoto Shinkai aesthetic, vibrant colors, clean lines, masterpiece' },
  realistic: { name: '📸 Fotorealistik', prompt: 'photorealistic, 8k resolution, cinematic lighting, ultra-detailed photography, sharp focus' },
  fantasy: { name: '🧙 Fantastika', prompt: 'fantasy digital painting, magical atmosphere, glowing runes, ethereal lighting, concept art' },
  '3d_render': { name: '🧸 3D Render', prompt: 'cute 3D render, Pixar style, Unreal Engine 5, volumetric soft lighting, smooth textures' }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Sun\'iy intellekt (Flux.1 / SDXL) orqali matndan mutlaqo bepul HD rasm yaratish')
    .addStringOption(option =>
      option
        .setName('prompt')
        .setDescription('Yaratmoqchi bo\'lgan rasmingiz tavsifi (masalan: kosmosdagi kiberpank poyga mashinasi)')
        .setRequired(true)
        .setMaxLength(500)
    )
    .addStringOption(option =>
      option
        .setName('style')
        .setDescription('Rasmning chizilish uslubi (Ixtiyoriy)')
        .setRequired(false)
        .addChoices(
          { name: '🌆 Kiberpank (Cyberpunk, neon chiroqlar)', value: 'cyberpunk' },
          { name: '🌸 Anime (Yapon animatsiya uslubi)', value: 'anime' },
          { name: '📸 Fotorealistik (8K haqiqiy surat kabi)', value: 'realistic' },
          { name: '🧙 Fantastika (Sehrli, ertaknamo)', value: 'fantasy' },
          { name: '🧸 3D Render (Pixar / Unreal Engine 5)', value: '3d_render' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const userPrompt = interaction.options.getString('prompt');
    const styleKey = interaction.options.getString('style');

    const styleInfo = styleKey && STYLES[styleKey] ? STYLES[styleKey] : null;
    const stylePrompt = styleInfo ? styleInfo.prompt : '';

    const result = await generateAiImage(userPrompt, stylePrompt);

    if (!result.success || !result.attachment) {
      return interaction.editReply({
        content: `❌ Rasm yaratishda xatolik yuz berdi: ${result.error || 'Noma\'lum xatolik'}. Iltimos, birozdan so'ng qayta urinib ko'ring.`
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎨 Cleva AI — Yangi Rasm Yaratildi!')
      .setDescription(
        `👤 **So'rovchi:** ${interaction.user}\n` +
        `📝 **Tavsif:** \`${userPrompt}\`\n` +
        `✨ **Uslub:** ${styleInfo ? styleInfo.name : 'Standart (Tabiiy)'}\n` +
        `🔍 **Detallar:** *${result.prompt.slice(0, 300)}...*`
      )
      .setImage(`attachment://${result.attachment.name}`)
      .setFooter({ text: `Cleva AI • 100% Bepul va Cheksiz (Flux.1 / SDXL)` })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
      files: [result.attachment]
    });
  }
};
