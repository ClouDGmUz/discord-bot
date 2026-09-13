const logger = require('../utils/logger');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    await logger.logMessageUpdate(oldMessage, newMessage);
  }
};
