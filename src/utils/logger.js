const { EmbedBuilder } = require('discord.js');
const storage = require('../config/storage');

async function sendLog(guild, embed) {
  try {
    if (!guild) return;
    const settings = storage.getGuildSettings(guild.id);
    if (!settings.logChannelId) return;

    const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await channel.send({ embeds: [embed] }).catch((err) => {
      console.error(`Log xabari yuborishda xatolik (${guild.name}):`, err.message);
    });
  } catch (error) {
    console.error('Logger xatosi:', error);
  }
}

module.exports = {
  sendLog,

  // Xabar o'chirilganda
  async logMessageDelete(message) {
    if (!message.guild || message.author?.bot) return;

    const embed = new EmbedBuilder()
      .setColor(0xED4245) // Qizil
      .setTitle('🗑️ Xabar O\'chirildi')
      .setDescription(`**Muallif:** ${message.author ? `${message.author.tag} (<@${message.author.id}>)` : 'Noma\'lum'}\n**Kanal:** <#${message.channelId}>\n**Xabar:**\n${message.content ? message.content.slice(0, 1900) : '*(Matn yo\'q yoki faqat rasm/fayl bo\'lgan)*'}`)
      .setFooter({ text: `Foydalanuvchi ID: ${message.author?.id || 'Noma\'lum'}` })
      .setTimestamp();

    if (message.attachments?.size > 0) {
      const files = message.attachments.map(a => a.url).join('\n');
      embed.addFields({ name: 'Fayllar', value: files.slice(0, 1024) });
    }

    await sendLog(message.guild, embed);
  },

  // Xabar tahrirlanganda
  async logMessageUpdate(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // embed yoki preview yangilangan bo'lishi mumkin

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C) // Sariq
      .setTitle('✏️ Xabar Tahrirlandi')
      .setDescription(`**Muallif:** ${newMessage.author.tag} (<@${newMessage.author.id}>)\n**Kanal:** <#${newMessage.channelId}>\n[Xabarga o'tish](${newMessage.url})`)
      .addFields(
        { name: 'Eski matn:', value: oldMessage.content ? oldMessage.content.slice(0, 1024) : '*(Bo\'sh)*' },
        { name: 'Yangi matn:', value: newMessage.content ? newMessage.content.slice(0, 1024) : '*(Bo\'sh)*' }
      )
      .setFooter({ text: `Foydalanuvchi ID: ${newMessage.author.id}` })
      .setTimestamp();

    await sendLog(newMessage.guild, embed);
  },

  // Yangi a'zo kirganda
  async logMemberJoin(member) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287) // Yashil
      .setTitle('📥 Yangi A\'zo Qo\'shildi')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`${member.user.tag} (<@${member.user.id}>) serverga kirdi.`)
      .addFields(
        { name: 'Hisob ochilgan sana', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Serverdagi a\'zolar soni', value: `${member.guild.memberCount}`, inline: true }
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    await sendLog(member.guild, embed);
  },

  // A'zo serverdan chiqqanda / chiqarilganda
  async logMemberLeave(member) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245) // Qizil
      .setTitle('📤 A\'zo Serverdan Chiqdi')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`${member.user.tag} (<@${member.user.id}>) serverni tark etdi.`)
      .addFields(
        { name: 'Qolgan a\'zolar soni', value: `${member.guild.memberCount}`, inline: true }
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    await sendLog(member.guild, embed);
  },

  // A'zoga rol berilishi yoki olinishi
  async logMemberUpdate(oldMember, newMember) {
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size === 0 && removedRoles.size === 0 && oldMember.nickname === newMember.nickname) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2) // Blurple
      .setTitle('👤 A\'zo Profili O\'zgardi')
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`**Foydalanuvchi:** ${newMember.user.tag} (<@${newMember.id}>)`)
      .setTimestamp()
      .setFooter({ text: `ID: ${newMember.id}` });

    if (addedRoles.size > 0) {
      embed.addFields({
        name: '➕ Berilgan rollar',
        value: addedRoles.map(r => `<@&${r.id}>`).join(', ')
      });
    }

    if (removedRoles.size > 0) {
      embed.addFields({
        name: '➖ Olib tashlangan rollar',
        value: removedRoles.map(r => `<@&${r.id}>`).join(', ')
      });
    }

    if (oldMember.nickname !== newMember.nickname) {
      embed.addFields({
        name: '📛 Taxallus (Nickname) o\'zgardi',
        value: `**Eski:** ${oldMember.nickname || 'Asl ismi'}\n**Yangi:** ${newMember.nickname || 'Asl ismi'}`
      });
    }

    await sendLog(newMember.guild, embed);
  },

  // Ban qilinganda
  async logBanAdd(ban) {
    const embed = new EmbedBuilder()
      .setColor(0x992D22) // Qora qizil
      .setTitle('🔨 Foydalanuvchi Ban Qilindi')
      .setThumbnail(ban.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`${ban.user.tag} (<@${ban.user.id}>) serverdan chetlatildi (ban).`)
      .addFields({ name: 'Sabab', value: ban.reason || 'Sabab ko\'rsatilmagan' })
      .setFooter({ text: `ID: ${ban.user.id}` })
      .setTimestamp();

    await sendLog(ban.guild, embed);
  },

  // Bandan chiqarilganda
  async logBanRemove(ban) {
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🔓 Foydalanuvchi Bandan Chiqarildi')
      .setThumbnail(ban.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`${ban.user.tag} (<@${ban.user.id}>) ning bandan chiqarildi.`)
      .setFooter({ text: `ID: ${ban.user.id}` })
      .setTimestamp();

    await sendLog(ban.guild, embed);
  },

  // Ovozli kanal hodisalari
  async logVoiceStateUpdate(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    let desc = '';
    let color = 0x5865F2;

    if (!oldState.channelId && newState.channelId) {
      // Kanalga kirdi
      desc = `🔊 ${member.user.tag} (<@${member.id}>) **<#${newState.channelId}>** ovozli kanaliga kirdi.`;
      color = 0x57F287;
    } else if (oldState.channelId && !newState.channelId) {
      // Kanaldan chiqdi
      desc = `🔇 ${member.user.tag} (<@${member.id}>) **<#${oldState.channelId}>** ovozli kanalidan chiqdi.`;
      color = 0xED4245;
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      // Boshqa kanalga ko'chdi
      desc = `🔀 ${member.user.tag} (<@${member.id}>) ovozli kanalni o'zgartirdi:\n**Eski:** <#${oldState.channelId}>\n**Yangi:** <#${newState.channelId}>`;
      color = 0xFEE75C;
    } else {
      return; // Stream yoki ovozni o'chirish kabi mayda harakatlarni o'tkazib yuboramiz
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎙️ Ovozli Kanal Harakati')
      .setDescription(desc)
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    await sendLog(member.guild, embed);
  },

  // Moderatsiya amallari logi (/mute, /give-role, /del-warn va h.k.)
  async logModAction(guild, actionName, moderator, targetUser, reason = null, extra = null) {
    const embed = new EmbedBuilder()
      .setColor(0xEB459E) // Pushti/Magenta
      .setTitle(`🛡️ Moderatsiya Amali: ${actionName}`)
      .setDescription(`**Moderator:** ${moderator.tag} (<@${moderator.id}>)\n**Nishon:** ${targetUser.tag} (<@${targetUser.id}>)`)
      .setTimestamp()
      .setFooter({ text: `Moderator ID: ${moderator.id}` });

    if (reason) {
      embed.addFields({ name: 'Sabab', value: reason });
    }
    if (extra) {
      embed.addFields({ name: 'Qo\'shimcha', value: extra });
    }

    await sendLog(guild, embed);
  }
};
