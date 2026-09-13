module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`Noma'lum buyruq chaqirildi: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`Buyruq bajarilishida xatolik (${interaction.commandName}):`, error);

      const errorPayload = {
        content: '❌ Ushbu buyruqni bajarishda kutilmagan xatolik yuz berdi!',
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorPayload).catch(() => {});
      } else {
        await interaction.reply(errorPayload).catch(() => {});
      }
    }
  }
};
