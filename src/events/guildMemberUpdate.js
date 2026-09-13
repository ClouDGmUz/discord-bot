const logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    await logger.logMemberUpdate(oldMember, newMember);
  }
};
