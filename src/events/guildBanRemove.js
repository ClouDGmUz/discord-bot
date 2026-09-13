const logger = require('../utils/logger');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban) {
    await logger.logBanRemove(ban);
  }
};
