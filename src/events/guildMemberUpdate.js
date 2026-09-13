const logger = require('../utils/logger');
const { updateGuildStats } = require('../utils/statsUpdater');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    await logger.logMemberUpdate(oldMember, newMember);

    // Foydalanuvchi serverni boost qilganda yoki bekor qilganda statsni darhol yangilash
    if (oldMember.premiumSince !== newMember.premiumSince) {
      updateGuildStats(newMember.guild, true);
    }
  }
};
