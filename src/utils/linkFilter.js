/**
 * Anti-Link va Domen Oq Ro'yxati (Whitelist) filtri
 * Klipy, Tenor, Giphy kabi GIF platformalari va serverning o'z invite havolalarini
 * tekshirish va begona spam/reklama linklarini aniqlash moduli.
 */

const DEFAULT_WHITELIST = [
  'klipy.com',
  'klipy.co',
  'tenor.com',
  'tenor.co',
  'giphy.com',
  'gph.is',
  'discordapp.com',
  'discordapp.net',
  'discord.com',
  'gfycat.com',
  'redgifs.com',
  'imgur.com',
  'fwVyfrtP4h' // Serverning rasmiy taklif kodi (discord.gg/fwVyfrtP4h)
];

// Discord va veb-sayt havolalarini qidirish uchun regex
const LINK_REGEX = /(?:https?:\/\/[^\s]+)|(?:discord\.(?:gg|io|me|li)\/[^\s]+)|(?:discordapp?\.com\/invite\/[^\s]+)/gi;

/**
 * Matndagi havolani atrofidagi belgilardan tozalash
 */
function cleanLink(raw) {
  if (!raw) return '';
  let cleaned = raw.trim();
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(/^[<(\['"]+/, '').replace(/[>)\]'",.!?:;]+$/, '');
  }
  return cleaned;
}

/**
 * Matn ichidan barcha havolalarni ajratib olish
 */
function extractLinks(text) {
  if (!text) return [];
  const matches = text.match(LINK_REGEX);
  if (!matches) return [];
  return matches.map(cleanLink).filter(l => l.length > 0);
}

/**
 * Domen yoki invite kiritmasini normalizatsiya qilish (masalan: "https://youtube.com/" -> "youtube.com")
 */
function normalizeDomainOrInvite(input) {
  if (!input) return '';
  let cleaned = input.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//, '');

  if (cleaned.startsWith('discord.gg/')) {
    const code = cleaned.replace(/^discord\.gg\//, '').split('/')[0].split('?')[0].trim();
    return code ? `discord.gg/${code}` : '';
  }

  cleaned = cleaned.split('/')[0].trim();
  cleaned = cleaned.replace(/^www\./, '');
  return cleaned;
}

/**
 * Alohida bitta havola oq ro'yxatda bor-yo'qligini tekshirish
 */
function isWhitelisted(rawLink, customWhitelist = []) {
  let urlStr = rawLink.trim();
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = 'https://' + urlStr;
  }

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;

  // Discord taklif havolalari (Invite links)
  const isDiscordInvite = 
    hostname === 'discord.gg' ||
    hostname === 'discord.me' ||
    hostname === 'discord.io' ||
    hostname === 'discord.li' ||
    ((hostname === 'discord.com' || hostname === 'discordapp.com') && pathname.toLowerCase().startsWith('/invite/'));

  if (isDiscordInvite) {
    const inviteCode = pathname.replace(/^\/(?:invite\/)?/, '').split('/')[0].split('?')[0].toLowerCase();
    
    // Serverning o'z takliflari va custom ruxsat berilgan invitelar
    const allowedInvites = ['fwVyfrtP4h', ...customWhitelist]
      .map(w => w.toLowerCase().replace(/^https?:\/\//, '').replace(/^discord\.gg\//, '').trim());

    return allowedInvites.some(code => code === inviteCode);
  }

  // Agar havola to'g'ridan-to'g'ri .gif yoki .gifv kabi media faylga bo'lsa
  const lowerPath = pathname.toLowerCase();
  if (lowerPath.endsWith('.gif') || lowerPath.endsWith('.gifv') || lowerPath.endsWith('.webp')) {
    return true;
  }

  // Standart va serverning maxsus domenlari
  const allDomains = [
    ...DEFAULT_WHITELIST.filter(w => w.includes('.') && !w.includes('discord.gg/')),
    ...customWhitelist.filter(w => w.includes('.') && !w.includes('discord.gg/'))
  ].map(d => d.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim());

  // Domen to'liq mos kelishi yoki subdomain bo'lishi kerak (masalan: media.klipy.com -> klipy.com)
  return allDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
}

/**
 * Xabar ichidagi barcha havolalarni tekshirish
 */
function checkMessageLinks(text, customWhitelist = []) {
  const links = extractLinks(text);
  if (links.length === 0) {
    return { hasLinks: false, isViolation: false, illegalLinks: [], allowedLinks: [] };
  }

  const illegalLinks = [];
  const allowedLinks = [];

  for (const link of links) {
    if (isWhitelisted(link, customWhitelist)) {
      allowedLinks.push(link);
    } else {
      illegalLinks.push(link);
    }
  }

  return {
    hasLinks: true,
    isViolation: illegalLinks.length > 0,
    illegalLinks,
    allowedLinks
  };
}

/**
 * Xabarda rasm, video yoki GIF bor-yo'qligini tekshirish
 */
function hasMediaContent(message) {
  if (!message) return { hasMedia: false };

  // 1. Biriktirilgan fayllar (Attachments)
  if (message.attachments && (message.attachments.size > 0 || message.attachments.length > 0)) {
    const attValues = message.attachments.values
      ? Array.from(message.attachments.values())
      : (Array.isArray(message.attachments) ? message.attachments : []);

    const hasMediaAtt = attValues.some(att => {
      const ct = att.contentType?.toLowerCase() || '';
      const name = att.name?.toLowerCase() || '';
      return (
        ct.startsWith('image/') ||
        ct.startsWith('video/') ||
        /\.(gif|gifv|png|jpe?g|webp|mp4|mov|webm)$/i.test(name)
      );
    });
    if (hasMediaAtt) {
      return { hasMedia: true, type: 'attachment' };
    }
  }

  // 2. Matndagi GIF yoki media havolalari
  if (message.content) {
    const links = extractLinks(message.content);
    const gifDomains = [
      'klipy.com', 'klipy.co', 'tenor.com', 'tenor.co',
      'giphy.com', 'gph.is', 'gfycat.com', 'redgifs.com', 'imgur.com'
    ];

    for (const link of links) {
      let urlStr = link.trim();
      if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        urlStr = 'https://' + urlStr;
      }
      try {
        const parsed = new URL(urlStr);
        const hostname = parsed.hostname.toLowerCase();
        const pathname = parsed.pathname.toLowerCase();

        // .gif, .gifv, .webp, .png, .jpg kabi to'g'ridan-to'g'ri fayl linklari
        if (/\.(gif|gifv|webp|png|jpe?g|mp4)$/i.test(pathname)) {
          return { hasMedia: true, type: 'link', link };
        }

        // GIF xizmatlari (Klipy, Tenor, Giphy va hk.)
        if (gifDomains.some(d => hostname === d || hostname.endsWith('.' + d))) {
          return { hasMedia: true, type: 'gif', link };
        }
      } catch {}
    }
  }

  return { hasMedia: false };
}

module.exports = {
  DEFAULT_WHITELIST,
  LINK_REGEX,
  cleanLink,
  extractLinks,
  normalizeDomainOrInvite,
  isWhitelisted,
  checkMessageLinks,
  hasMediaContent
};

