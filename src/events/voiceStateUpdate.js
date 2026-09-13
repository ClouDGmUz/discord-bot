const logger = require('../utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    await logger.logVoiceStateUpdate(oldState, newState);
  }
};
