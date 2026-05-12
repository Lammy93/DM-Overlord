import { SlashCommandBuilder } from 'discord.js';
import { rollDice } from '../services/dice.js';
import { diceEmbed } from '../utils/embeds.js';
import { getNarration } from '../services/narration.js';
import { getActiveCharacter } from '../services/activeCharacter.js';
import { logToActiveSession } from '../services/sessionLog.js';
import eventBus from '../services/eventBus.js';

export default {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice with various options')
    .addStringOption(option =>
      option.setName('formula')
        .setDescription('Dice notation (e.g., 1d20, 2d6+3)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Why are you rolling?')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('advantage')
        .setDescription('Roll with advantage (d20 only)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('disadvantage')
        .setDescription('Roll with disadvantage (d20 only)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('hidden')
        .setDescription('Only you can see the result')
        .setRequired(false)),

  async execute(interaction) {
    const formula = interaction.options.getString('formula');
    const reason = interaction.options.getString('reason');
    const advantage = interaction.options.getBoolean('advantage') || false;
    const disadvantage = interaction.options.getBoolean('disadvantage') || false;
    const hidden = interaction.options.getBoolean('hidden') || false;
    const isD20 = formula.replace(/\s/g, '').match(/^1d20([+-]\d+)?$/i);

    if (advantage && disadvantage) {
      return interaction.reply({
        content: 'You cannot roll with both advantage and disadvantage.',
        ephemeral: true,
      });
    }

    const result = rollDice(formula, { advantage, disadvantage });

    if (!result) {
      return interaction.reply({
        content: `Invalid dice formula: \`${formula}\`. Use format like \`1d20\`, \`2d6+3\`, etc.`,
        ephemeral: true,
      });
    }

    const embed = diceEmbed(result.rolls, result.formula, result.total);
    if (reason) embed.setDescription(`**${reason}**`);
    if (result.advantage !== undefined) {
      embed.addFields({
        name: result.advantage ? 'Advantage' : 'Disadvantage',
        value: `Rolled: \`${result.rolls[0]}\`, \`${result.rolls[1]}\` → Chose **${result.chosen}**`,
      });
    }
    embed.addFields({ name: 'Roller', value: interaction.user.username, inline: true });

    const narration = isD20 ? getNarrationForRoll(result.total) : null;
    if (narration) embed.addFields({ name: 'Narration', value: narration });

    if (!hidden) {
      const activeChar = getActiveCharacter(interaction.user.id);
      const playerName = interaction.member?.displayName || interaction.user.username;
      const charName = activeChar ? activeChar.name : null;
      const rollContent = charName
        ? `**${charName}** rolled ${result.formula} → **${result.total}**${reason ? ` (${reason})` : ''}`
        : `**${playerName}** rolled ${result.formula} → **${result.total}**${reason ? ` (${reason})` : ''}`;
      const userRef = charName ? `${playerName} (${charName})` : playerName;

      if (activeChar?.campaign_id) {
        logToActiveSession(
          activeChar.campaign_id,
          'roll',
          charName ? `${charName} — ${result.formula}` : `Roll — ${result.formula}`,
          rollContent,
          interaction.user.id,
          userRef,
        ).catch(() => {});
      }

      eventBus.emit('log', {
        type: 'roll',
        subtype: 'roll',
        title: `🎲 ${result.formula}`,
        content: `${userRef}: ${result.formula} → **${result.total}**${result.details ? ` (${result.details})` : ''}${reason ? ` — ${reason}` : ''}`,
        formula: result.formula,
        total: result.total,
        userId: interaction.user.id,
        username: playerName,
        characterName: charName,
        timestamp: new Date().toISOString(),
      });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: hidden,
    });
  },
};

function getNarrationForRoll(total) {
  if (total === 20) return getNarration('crit');
  if (total === 1) return 'Natural 1! That\'s... unfortunate.';
  return null;
}
