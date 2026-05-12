import { Events, MessageFlags } from 'discord.js';
import { handleWizardComponent, handleWizardModal } from '../services/characterWizard.js';
import eventBus from '../services/eventBus.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: 'Command not found.', flags: MessageFlags.Ephemeral });
      }
      try {
        await command.execute(interaction);

        const sub = interaction.options.getSubcommand(false);
        const group = interaction.options.getSubcommandGroup(false);
        const cmdPath = [interaction.commandName, group, sub].filter(Boolean).join(' ');

        eventBus.emit('log', {
          type: 'command',
          subtype: 'slash',
          title: `/${cmdPath}`,
          content: `${interaction.user.username} ran /${cmdPath}`,
          commandName: interaction.commandName,
          subcommand: sub,
          group: group,
          userId: interaction.user.id,
          username: interaction.user.username,
          guildId: interaction.guildId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        const reply = {
          content: 'An error occurred while executing that command.',
          flags: MessageFlags.Ephemeral,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command?.autocomplete) {
        if (!interaction.responded) interaction.respond([]).catch(() => {});
        return;
      }
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`Error in autocomplete for ${interaction.commandName}:`, error);
        if (!interaction.responded) interaction.respond([]).catch(() => {});
      }
      return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('charwizard_')) {
        try {
          await handleWizardComponent(interaction);
        } catch (error) {
          console.error('Wizard component error:', error);
          const reply = { content: 'Something went wrong in the wizard.', flags: MessageFlags.Ephemeral };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        }
        return;
      }

      // Adventure lobby character picker
      if (interaction.customId.startsWith('adventure_pickchar:')) {
        const sessionId = parseInt(interaction.customId.split(':')[1], 10);
        const [charId, charName] = interaction.values[0].split(':');
        const playerName = interaction.member?.displayName || interaction.user.username;
        const { lobbyJoin, getSession, getModule, getLobbyMessageId } = await import('../services/adventure.js');
        const result = lobbyJoin(sessionId, interaction.user.id, playerName, parseInt(charId, 10), charName);
        if (result.error) {
          return interaction.reply({ embeds: [errorEmbed('Join Failed', result.error)], flags: MessageFlags.Ephemeral });
        }

        // Try to update the original lobby message with the new player list
        try {
          const updatedSession = getSession(sessionId);
          const messageId = getLobbyMessageId(updatedSession);
          if (messageId) {
            const mod = getModule(updatedSession.module_id);
            const players = Object.values(updatedSession.playerStates || {});
            const playerText = players.length ? players.map(p => `<@${p.discordId}> — ${p.characterName || 'Unknown'}`).join('\n') : 'None yet.';
            const replyEmbed = new (await import('discord.js')).EmbedBuilder()
              .setTitle(`⚔️ ${mod?.title || 'Adventure'}`)
              .setColor(0xc9a84c)
              .setDescription(mod?.description || 'An adventure awaits!')
              .addFields(
                { name: '🎯 Levels', value: `${mod?.min_level || 1} — ${mod?.max_level || 20}`, inline: true },
                { name: 'Session ID', value: `\`${sessionId}\``, inline: true },
                { name: '👤 Players Joined', value: playerText, inline: false },
              );
            const msg = await interaction.channel.messages.fetch(messageId);
            const disabledRow1 = new (await import('discord.js')).ActionRowBuilder().addComponents(
              (await import('discord.js')).ButtonBuilder.from(interaction.message.components[0]?.components[0]).setDisabled(false),
              (await import('discord.js')).ButtonBuilder.from(interaction.message.components[0]?.components[1]).setDisabled(false),
            );
            const disabledRow2 = new (await import('discord.js')).ActionRowBuilder().addComponents(
              (await import('discord.js')).ButtonBuilder.from(interaction.message.components[1]?.components[0]).setDisabled(false),
            );
            await msg.edit({ embeds: [replyEmbed], components: [disabledRow1, disabledRow2] }).catch(() => {});
          }
        } catch {}

        return interaction.update({ content: `✅ You joined as **${charName}**!`, components: [] });
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('charwizard_modal_')) {
        try {
          await handleWizardModal(interaction);
        } catch (error) {
          console.error('Wizard modal error:', error);
          const reply = { content: 'Something went wrong in the wizard.', flags: MessageFlags.Ephemeral };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        }
      }
      return;
    }
  },
};
