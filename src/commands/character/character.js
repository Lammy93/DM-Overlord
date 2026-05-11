import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed, characterEmbed } from '../../utils/embeds.js';
import { createCharacter, getCharacter, getPlayerCharacters, getCampaignCharacters, updateCharacter, deleteCharacter, addExperience, levelUp, damageCharacter, healCharacter } from '../../services/character.js';
import { writeCharacterNote } from '../../services/obsidian.js';

export default {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('Manage your D&D characters')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new character')
        .addStringOption(opt => opt.setName('name').setDescription('Character name').setRequired(true))
        .addStringOption(opt => opt.setName('race').setDescription('Race (e.g., Human, Elf, Dwarf)').setRequired(true))
        .addStringOption(opt => opt.setName('class').setDescription('Class (e.g., Fighter, Wizard, Rogue)').setRequired(true))
        .addIntegerOption(opt => opt.setName('campaign-id').setDescription('Campaign ID to assign to').setRequired(false))
        .addIntegerOption(opt => opt.setName('level').setDescription('Starting level (default: 1)').setRequired(false).setMinValue(1).setMaxValue(20))
        .addStringOption(opt => opt.setName('background').setDescription('Character background').setRequired(false))
        .addStringOption(opt => opt.setName('alignment').setDescription('Alignment (e.g., Lawful Good, Chaotic Neutral)').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List your characters'))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View a character sheet')
        .addStringOption(opt => opt.setName('id').setDescription('Character ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('update')
        .setDescription('Update character details')
        .addStringOption(opt => opt.setName('id').setDescription('Character ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('hp-current').setDescription('Current HP').setRequired(false))
        .addIntegerOption(opt => opt.setName('hp-max').setDescription('Max HP').setRequired(false))
        .addIntegerOption(opt => opt.setName('armor-class').setDescription('Armor Class').setRequired(false))
        .addIntegerOption(opt => opt.setName('level').setDescription('Level').setRequired(false).setMinValue(1).setMaxValue(20))
        .addStringOption(opt => opt.setName('stats').setDescription('Stats JSON (e.g., {"str":15,"dex":12})').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a character')
        .addStringOption(opt => opt.setName('id').setDescription('Character ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('damage')
        .setDescription('Damage your character')
        .addStringOption(opt => opt.setName('id').setDescription('Character ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Damage amount').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('heal')
        .setDescription('Heal your character')
        .addStringOption(opt => opt.setName('id').setDescription('Character ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Healing amount').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('xp')
        .setDescription('Add experience points')
        .addStringOption(opt => opt.setName('id').setDescription('Character ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('XP to add').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('levelup')
        .setDescription('Level up your character')
        .addStringOption(opt => opt.setName('id').setDescription('Character ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('campaign')
        .setDescription('List characters in a campaign')
        .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const data = {
        name: interaction.options.getString('name'),
        race: interaction.options.getString('race'),
        class: interaction.options.getString('class'),
        campaignId: interaction.options.getInteger('campaign-id') || null,
        level: interaction.options.getInteger('level') || 1,
        background: interaction.options.getString('background'),
        alignment: interaction.options.getString('alignment'),
        playerDiscordId: interaction.user.id,
      };
      const character = createCharacter(data);
      const embed = successEmbed('Character Created', `**${character.name}** enters the world!`);
      embed.addFields(
        { name: 'ID', value: `\`${character.id}\``, inline: true },
        { name: 'Race', value: character.race || 'Unknown', inline: true },
        { name: 'Class', value: character.class || 'Unknown', inline: true },
        { name: 'Level', value: `${character.level}`, inline: true },
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const characters = getPlayerCharacters(interaction.user.id);
      if (characters.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('No Characters', 'You have no characters yet. Use `/character create` to make one.')], ephemeral: true });
      }
      const list = characters.map(c =>
        `**${c.name}** (ID: \`${c.id}\`) — Lvl ${c.level} ${c.race || ''} ${c.class || ''}`
      ).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Your Characters', list)] });
    }

    if (sub === 'view') {
      const id = parseInt(interaction.options.getString('id'));
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      const character = getCharacter(id);
      if (!character) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
      return interaction.reply({ embeds: [characterEmbed(character)] });
    }

    if (sub === 'update') {
      const id = parseInt(interaction.options.getString('id'));
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      const character = getCharacter(id);
      if (!character) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
      if (character.player_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You can only edit your own characters.')], ephemeral: true });
      }
      const updates = {};
      const hpCurrent = interaction.options.getInteger('hp-current');
      const hpMax = interaction.options.getInteger('hp-max');
      const ac = interaction.options.getInteger('armor-class');
      const level = interaction.options.getInteger('level');
      const statsStr = interaction.options.getString('stats');
      if (hpCurrent !== null) updates.hpCurrent = hpCurrent;
      if (hpMax !== null) updates.hpMax = hpMax;
      if (ac !== null) updates.armorClass = ac;
      if (level !== null) updates.level = level;
      if (statsStr) {
        try {
          updates.stats = JSON.parse(statsStr);
        } catch {
          return interaction.reply({ embeds: [errorEmbed('Invalid JSON', 'Stats must be valid JSON like {"str":15,"dex":12}')], ephemeral: true });
        }
      }
      updateCharacter(id, updates);
      return interaction.reply({ embeds: [successEmbed('Character Updated', `**${character.name}** has been updated.`)] });
    }

    if (sub === 'delete') {
      const id = parseInt(interaction.options.getString('id'));
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      const character = getCharacter(id);
      if (!character) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
      if (character.player_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You can only delete your own characters.')], ephemeral: true });
      }
      deleteCharacter(id);
      return interaction.reply({ embeds: [successEmbed('Character Deleted', `**${character.name}** has been retired.`)] });
    }

    if (sub === 'damage') {
      const id = parseInt(interaction.options.getString('id'));
      const amount = interaction.options.getInteger('amount');
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      const character = getCharacter(id);
      if (!character) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
      if (character.player_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You can only damage your own characters.')], ephemeral: true });
      }
      const updated = damageCharacter(id, amount);
      return interaction.reply({ embeds: [infoEmbed(`💥 ${character.name} took ${amount} damage!`, `HP: ${updated.hp_current}/${updated.hp_max}`)] });
    }

    if (sub === 'heal') {
      const id = parseInt(interaction.options.getString('id'));
      const amount = interaction.options.getInteger('amount');
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      const character = getCharacter(id);
      if (!character) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
      if (character.player_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You can only heal your own characters.')], ephemeral: true });
      }
      const updated = healCharacter(id, amount);
      return interaction.reply({ embeds: [infoEmbed(`💚 ${character.name} healed for ${amount}!`, `HP: ${updated.hp_current}/${updated.hp_max}`)] });
    }

    if (sub === 'xp') {
      const id = parseInt(interaction.options.getString('id'));
      const amount = interaction.options.getInteger('amount');
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      const character = getCharacter(id);
      if (!character) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
      if (character.player_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You can only add XP to your own characters.')], ephemeral: true });
      }
      const updated = addExperience(id, amount);
      return interaction.reply({ embeds: [successEmbed('XP Added', `**${character.name}** gained ${amount} XP (Total: ${updated.experience}).`)] });
    }

    if (sub === 'levelup') {
      const id = parseInt(interaction.options.getString('id'));
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      const character = getCharacter(id);
      if (!character) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
      if (character.player_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You can only level up your own characters.')], ephemeral: true });
      }
      const updated = levelUp(id);
      if (!updated) return interaction.reply({ embeds: [errorEmbed('Max Level', `${character.name} is already level 20!`)], ephemeral: true });
      return interaction.reply({ embeds: [successEmbed('Level Up!', `**${character.name}** is now level ${updated.level}!`)] });
    }

    if (sub === 'campaign') {
      const campaignId = parseInt(interaction.options.getString('campaign-id'));
      if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const characters = getCampaignCharacters(campaignId);
      if (characters.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('No Characters', 'No characters in this campaign yet.')], ephemeral: true });
      }
      const list = characters.map(c =>
        `**${c.name}** (ID: \`${c.id}\`) — Lvl ${c.level} ${c.race} ${c.class} — <@${c.player_discord_id}>`
      ).join('\n');
      return interaction.reply({ embeds: [infoEmbed(`Party — ${characters.length} characters`, list)] });
    }
  },
};
