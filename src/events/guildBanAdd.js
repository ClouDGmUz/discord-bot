const logger = require('../utils/logger');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    await logger.logBanAdd(ban);
  }
};
