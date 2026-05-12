import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed, characterEmbed } from '../../utils/embeds.js';
import { createCharacter, getCharacter, getPlayerCharacters, getCampaignCharacters, updateCharacter, deleteCharacter, addExperience, levelUp, damageCharacter, healCharacter } from '../../services/character.js';
import { writeCharacterNote } from '../../services/obsidian.js';
import { startWizard } from '../../services/characterWizard.js';
import { setActiveCharacter, getActiveCharacter, clearActiveCharacter } from '../../services/activeCharacter.js';
import { generateCharacterSheet } from '../../services/pdfSheet.js';
import { AttachmentBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('Manage your D&D characters')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Interactive character creation wizard')
        .addIntegerOption(opt => opt.setName('campaign-id').setDescription('Campaign ID to assign to').setRequired(false)))
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
        .addStringOption(opt => opt.setName('stats').setDescription('Stats JSON (e.g., {"str":15,"dex":12})').setRequired(false))
        .addStringOption(opt => opt.setName('image').setDescription('Portrait image URL').setRequired(false)))
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
      sub.setName('pdf')
        .setDescription('Download a PDF character sheet')
        .addStringOption(opt => opt.setName('id').setDescription('Character ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('image')
        .setDescription('Set character portrait image')
        .addStringOption(opt => opt.setName('id').setDescription('Character ID').setRequired(true))
        .addStringOption(opt => opt.setName('url').setDescription('Image URL for portrait').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('campaign')
        .setDescription('List characters in a campaign')
        .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('select')
        .setDescription('Set your active character for this session')
        .addStringOption(opt => opt.setName('id').setDescription('Character ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      return startWizard(interaction);
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
      const imageUrl = interaction.options.getString('image');
      const statsStr = interaction.options.getString('stats');
      if (hpCurrent !== null) updates.hpCurrent = hpCurrent;
      if (hpMax !== null) updates.hpMax = hpMax;
      if (ac !== null) updates.armorClass = ac;
      if (level !== null) updates.level = level;
      if (imageUrl) updates.imageUrl = imageUrl;
      if (statsStr) {
        try {
          updates.stats = JSON.parse(statsStr);
        } catch {
          return interaction.reply({ embeds: [errorEmbed('Invalid JSON', 'Stats must be valid JSON like {"str":15,"dex":12}')], ephemeral: true });
        }
      }
      updateCharacter(id, updates);
      writeCharacterNote(getCharacter(id)).catch(() => {});
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

    const userRef = interaction.member?.displayName || interaction.user.username;

    if (sub === 'damage') {
      const id = parseInt(interaction.options.getString('id'));
      const amount = interaction.options.getInteger('amount');
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      const character = getCharacter(id);
      if (!character) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
      if (character.player_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You can only damage your own characters.')], ephemeral: true });
      }
      const updated = damageCharacter(id, amount, `${interaction.user.username} (${character.name})`);
      writeCharacterNote(getCharacter(id)).catch(() => {});
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
      const updated = healCharacter(id, amount, `${interaction.user.username} (${character.name})`);
      writeCharacterNote(getCharacter(id)).catch(() => {});
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
      const updated = addExperience(id, amount, `${interaction.user.username} (${character.name})`);
      writeCharacterNote(getCharacter(id)).catch(() => {});
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
      const updated = levelUp(id, `${interaction.user.username} (${character.name})`);
      if (!updated) return interaction.reply({ embeds: [errorEmbed('Max Level', `${character.name} is already level 20!`)], ephemeral: true });
      writeCharacterNote(getCharacter(id)).catch(() => {});
      return interaction.reply({ embeds: [successEmbed('Level Up!', `**${character.name}** is now level ${updated.level}!`)] });
    }

    if (sub === 'pdf') {
      await interaction.deferReply({ flags: 64 });
      const id = parseInt(interaction.options.getString('id'));
      if (isNaN(id)) return interaction.editReply({ embeds: [errorEmbed('Invalid ID')] });
      const character = getCharacter(id);
      if (!character) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'Character not found.')] });
      try {
        const pdfBuffer = await generateCharacterSheet(id);
        const attachment = new AttachmentBuilder(pdfBuffer, { name: `${character.name.replace(/[^a-z0-9]/gi, '_')}.pdf` });
        await interaction.editReply({ content: `**${character.name}** — Character Sheet`, files: [attachment] });
      } catch (err) {
        console.error('PDF generation error:', err);
        await interaction.editReply({ embeds: [errorEmbed('PDF Error', 'Failed to generate character sheet.')] });
      }
      return;
    }

    if (sub === 'image') {
      const id = parseInt(interaction.options.getString('id'));
      const url = interaction.options.getString('url');
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
      const character = getCharacter(id);
      if (!character) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
      if (character.player_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You can only edit your own characters.')], ephemeral: true });
      }
      updateCharacter(id, { imageUrl: url });
      const embed = successEmbed('Portrait Updated', `**${character.name}** now has a portrait!`);
      embed.setThumbnail(url);
      return interaction.reply({ embeds: [embed] });
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

    if (sub === 'select') {
      const id = parseInt(interaction.options.getString('id'));
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      const character = getCharacter(id);
      if (!character) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
      if (character.player_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You can only select your own characters.')], ephemeral: true });
      }
      setActiveCharacter(interaction.user.id, id);
      return interaction.reply({ embeds: [successEmbed('Character Selected', `You are now playing as **${character.name}** (Lvl ${character.level} ${character.race} ${character.class}).\n\nDice rolls and session events will be logged under this character.`)] });
    }
  },
};
