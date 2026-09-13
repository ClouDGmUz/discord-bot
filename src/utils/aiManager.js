/**
 * Cleva AI Manager — Google Gemini API integratsiyasi
 */

const SYSTEM_PROMPT = `Siz "Cleva" nomli o'zbek tilida gapiradigan, aqlli, juda do'stona va samimiy sun'iy intellektsiz.
Siz "MEGA TEAM" Discord serverining rasmiy AI yordamchisisiz.
Vazifangiz:
- Server a'zolariga o'yinlar (CS2, Dota 2, GTA V, Minecraft, Roblox va boshqalar), kompyuter texnologiyalari, dasturlash va har qanday savollarda samimiy, aniq va ixcham yordam berish.
- O'zbek tilida (lotin yozuvida) chiroyli, ravon va imlo qoidalariga rioya qilgan holda javob bering.
- Javoblarni haddan tashqari cho'zmasdan, lo'nda va chiroyli formatda (Discord markdown, ro'yxatlar, mos emojilar bilan) taqdim eting.
- Foydalanuvchilar bilan do'stona, samimiy va xushmuomala bo'ling.`;

// Suhbat konteksti (xotira) kesh: channelId -> Array<{ role, parts: [{ text }] }>
const conversationHistory = new Map();

// Faol ishlaydigan modelni keshda saqlash
let cachedWorkingModel = 'gemini-3.6-flash';

/**
 * Google AI Studio dan mavjud faol modellarni avtomat aniqlash
 */
async function discoverWorkingModel(apiKey) {
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(listUrl);
    if (res.ok) {
      const data = await res.json();
      const models = data?.models || [];

      // 1. 'generateContent' ni qo'llaydigan va 'flash' bo'lgan modelni topish
      const flashModel = models.find(m =>
        m.supportedGenerationMethods?.includes('generateContent') &&
        m.name?.toLowerCase().includes('flash')
      );
      if (flashModel) {
        cachedWorkingModel = flashModel.name.replace('models/', '');
        console.log(`[GEMINI AVTOMAT TOPILDI]: ${cachedWorkingModel}`);
        return cachedWorkingModel;
      }

      // 2. Aks holda ixtiyoriy 'generateContent' modeli
      const anyModel = models.find(m => m.supportedGenerationMethods?.includes('generateContent'));
      if (anyModel) {
        cachedWorkingModel = anyModel.name.replace('models/', '');
        console.log(`[GEMINI MODEL TOPILDI]: ${cachedWorkingModel}`);
        return cachedWorkingModel;
      }
    } else {
      const errText = await res.text();
      console.warn('[GEMINI LIST MODELS OGOHLANTIRISH]:', errText);
    }
  } catch (err) {
    console.error('[GEMINI LIST MODELS XATOSI]:', err.message);
  }
  return cachedWorkingModel || 'gemini-3.6-flash';
}

/**
 * Gemini API ga so'rov yuborish
 */
async function callGemini(contents, systemPrompt = SYSTEM_PROMPT) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return { error: 'API_KEY_MISSING' };
  }

  const cleanKey = apiKey.trim();
  const candidateModels = [
    cachedWorkingModel,
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash-latest'
  ].filter(Boolean);

  // Unikal modellarni saralash
  const uniqueModels = [...new Set(candidateModels)];

  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const payload = {
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          cachedWorkingModel = model;
          return { text };
        }
      } else {
        const errorText = await res.text();
        console.warn(`[GEMINI API OGOHLANTIRISH] Model: ${model}, Status: ${res.status}, Javob:`, errorText);
      }
    } catch (err) {
      console.error(`[GEMINI FETCH XATOSI] Model: ${model}:`, err.message);
    }
  }

  // Agar barcha ma'lum modellar 404 bersa, Google dan ro'yxatni so'rab eng yangisini olamiz
  try {
    const discovered = await discoverWorkingModel(cleanKey);
    if (discovered && !uniqueModels.includes(discovered)) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${discovered}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text };
      }
    }
  } catch (err) {
    console.error('[GEMINI DISCOVERY EXECUTION XATOSI]:', err);
  }

  return { error: 'API_ERROR' };
}

/**
 * Foydalanuvchi savoliga AI orqali javob olish (kontekst bilan)
 */
async function askClevaAI(channelId, userPrompt, userName = 'A\'zo') {
  const promptText = `${userName}: ${userPrompt}`;

  let history = conversationHistory.get(channelId) || [];

  history.push({
    role: 'user',
    parts: [{ text: promptText }]
  });

  // Xotirada oxirgi 8 ta xabarni (4 ta suhbat almashinuvi) saqlash
  if (history.length > 8) {
    history = history.slice(-8);
  }

  const result = await callGemini(history);

  if (result.error === 'API_KEY_MISSING') {
    return '⚠️ **Cleva AI sozlanmagan:** Botda `GEMINI_API_KEY` kiritilmagan. Iltimos, ma\'muriyat Render boshqaruv panelida `GEMINI_API_KEY` ni kiritsin.';
  }

  if (result.error || !result.text) {
    return '😔 Kechirasiz, sun\'iy intellekt xizmatiga ulanishda vaqtinchalik uzilish bo\'ldi. Iltimos, birozdan so\'ng qayta urinib ko\'ring.';
  }

  // Model javobini xotiraga qo'shish
  history.push({
    role: 'model',
    parts: [{ text: result.text }]
  });
  conversationHistory.set(channelId, history);

  return result.text;
}

/**
 * Xotirani tozalash
 */
function clearConversationHistory(channelId) {
  conversationHistory.delete(channelId);
}

/**
 * 2000 belgidan oshgan xabarlarni bo'laklash
 */
function splitMessage(text, maxLength = 1950) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let sliceIndex = remaining.lastIndexOf('\n', maxLength);
    if (sliceIndex === -1 || sliceIndex < maxLength / 2) {
      sliceIndex = maxLength;
    }
    chunks.push(remaining.slice(0, sliceIndex).trim());
    remaining = remaining.slice(sliceIndex).trim();
  }
  return chunks;
}

module.exports = {
  askClevaAI,
  clearConversationHistory,
  splitMessage
};
