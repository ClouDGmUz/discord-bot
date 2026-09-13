const logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    await logger.logMemberLeave(member);
  }
};
