const logger = require('../utils/logger');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    await logger.logMessageDelete(message);
  }
};
