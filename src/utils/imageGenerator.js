const { AttachmentBuilder } = require('discord.js');

/**
 * Promptni Gemini orqali ingliz tiliga va professional ko'rinishga keltirish
 */
async function enhancePromptWithGemini(userPrompt, style = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return style ? `${userPrompt}, ${style}` : userPrompt;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey.trim()}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Translate and enhance the following image description into a high quality English text-to-image prompt. Keep it concise (1-2 sentences), highly descriptive of visual elements, lighting, and detail. Do not include any explanations, prefixes, or quotes, return ONLY the raw prompt text.\n\nDescription: "${userPrompt}"\n${style ? `Style: ${style}` : ''}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const textParts = parts.filter(p => !p.thought && p.text).map(p => p.text);
      const enhanced = textParts.join('').trim().replace(/^["']|["']$/g, '');
      if (enhanced && enhanced.length > 5) {
        return enhanced;
      }
    }
  } catch (err) {
    console.warn('[PROMPT ENHANCE OGOHLANTIRISH]:', err.message);
  }

  return style ? `${userPrompt}, ${style}` : userPrompt;
}

/**
 * Pollinations (Flux.1) orqali mutlaqo bepul va cheksiz rasm yaratish
 */
async function generateAiImage(userPrompt, stylePrompt = '') {
  try {
    // 1. Promptni boyitish
    const finalPrompt = await enhancePromptWithGemini(userPrompt, stylePrompt);

    // 2. Tasodifiy seed orqali har safar yangi unikal rasm olish
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

    console.log(`[RASM SO'ROVI]: Prompt: "${finalPrompt}"`);

    // 3. Rasmni yuklab olish (Buffer)
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'ClevaDiscordBot/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Rasm servisi xatosi (Status: ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const attachment = new AttachmentBuilder(buffer, {
      name: `cleva-${Date.now()}.png`
    });

    return {
      success: true,
      attachment,
      prompt: finalPrompt,
      originalPrompt: userPrompt
    };
  } catch (error) {
    console.error('[RASM YARATISHDA XATO]:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateAiImage
};
