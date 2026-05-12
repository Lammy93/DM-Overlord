import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed, encounterEmbed } from '../../utils/embeds.js';
import { createEncounter, getEncounter, listEncounters, updateEncounter, addCombatant, removeCombatant, startEncounter, nextTurn, damageCombatant, addCondition, removeCondition, endEncounter } from '../../services/encounter.js';
import { getCampaign } from '../../services/campaign.js';
import { getSrdMonster, searchMonsters } from '../../services/srd.js';
import { getNarration, generateEncounterDescription } from '../../services/narration.js';
import { generateEncounterAI } from '../../services/aiGenerator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('encounter')
    .setDescription('Build and run combat encounters')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new encounter')
        .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('Encounter name').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Description of the encounter').setRequired(false))
        .addStringOption(opt => opt.setName('environment').setDescription('Environment (e.g., forest, dungeon)').setRequired(false))
        .addStringOption(opt => opt.setName('difficulty').setDescription('Difficulty rating').setRequired(false).addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' },
          { name: 'Deadly', value: 'deadly' },
        )))
    .addSubcommand(sub =>
      sub.setName('generate')
        .setDescription('AI-generate a balanced encounter')
        .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addStringOption(opt => opt.setName('environment').setDescription('Environment (e.g., forest, dungeon, cave)').setRequired(false))
        .addStringOption(opt => opt.setName('difficulty').setDescription('Difficulty rating').setRequired(false).addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' },
          { name: 'Deadly', value: 'deadly' },
        ))
        .addIntegerOption(opt => opt.setName('party-level').setDescription('Average party level (default: campaign starting level)').setRequired(false).setMinValue(1).setMaxValue(20))
        .addIntegerOption(opt => opt.setName('party-size').setDescription('Number of party members (default: 4)').setRequired(false).setMinValue(1).setMaxValue(10)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List encounters for a campaign')
        .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View encounter details')
        .addStringOption(opt => opt.setName('id').setDescription('Encounter ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('add-monster')
        .setDescription('Add a monster to the encounter')
        .addStringOption(opt => opt.setName('encounter-id').setDescription('Encounter ID').setRequired(true))
        .addStringOption(opt => opt.setName('monster').setDescription('Monster name from SRD').setRequired(true))
        .addIntegerOption(opt => opt.setName('count').setDescription('Number to add (default: 1)').setRequired(false).setMinValue(1).setMaxValue(50)))
    .addSubcommand(sub =>
      sub.setName('add-custom')
        .setDescription('Add a custom combatant')
        .addStringOption(opt => opt.setName('encounter-id').setDescription('Encounter ID').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('Combatant name').setRequired(true))
        .addIntegerOption(opt => opt.setName('hp').setDescription('Hit points').setRequired(true).setMinValue(1))
        .addIntegerOption(opt => opt.setName('ac').setDescription('Armor Class').setRequired(true).setMinValue(1))
        .addStringOption(opt => opt.setName('type').setDescription('Type').setRequired(false).addChoices(
          { name: 'Monster', value: 'monster' },
          { name: 'Ally', value: 'ally' },
          { name: 'Neutral', value: 'neutral' },
        )))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a combatant from the encounter')
        .addStringOption(opt => opt.setName('combatant-id').setDescription('Combatant ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start the encounter (rolls initiative)')
        .addStringOption(opt => opt.setName('id').setDescription('Encounter ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('next')
        .setDescription('Advance to the next turn')
        .addStringOption(opt => opt.setName('id').setDescription('Encounter ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('damage')
        .setDescription('Damage a combatant')
        .addStringOption(opt => opt.setName('combatant-id').setDescription('Combatant ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Damage amount').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('condition')
        .setDescription('Add a condition to a combatant')
        .addStringOption(opt => opt.setName('combatant-id').setDescription('Combatant ID').setRequired(true))
        .addStringOption(opt => opt.setName('condition').setDescription('Condition (e.g., poisoned, blinded, prone)').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End the encounter')
        .addStringOption(opt => opt.setName('id').setDescription('Encounter ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
      if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const campaign = getCampaign(campaignId);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
      if (campaign.dm_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can create encounters.')], ephemeral: true });
      }
      const encounter = createEncounter({
        campaignId,
        name: interaction.options.getString('name'),
        description: interaction.options.getString('description'),
        environment: interaction.options.getString('environment'),
        difficulty: interaction.options.getString('difficulty') || 'medium',
      });
      const embed = successEmbed('Encounter Created', `**${encounter.name}** is ready for **${campaign.name}**`);
      embed.addFields(
        { name: 'ID', value: `\`${encounter.id}\``, inline: true },
        { name: 'Difficulty', value: encounter.difficulty, inline: true },
        { name: 'Environment', value: encounter.environment || 'None', inline: true },
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'generate') {
      const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
      if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const campaign = getCampaign(campaignId);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
      if (campaign.dm_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can generate encounters.')], ephemeral: true });
      }

      await interaction.deferReply();

      const env = interaction.options.getString('environment') || 'wilderness';
      const difficulty = interaction.options.getString('difficulty') || 'medium';
      const partyLevel = interaction.options.getInteger('party-level') || campaign.starting_level || 1;
      const partySize = interaction.options.getInteger('party-size') || 4;

      try {
        const result = await generateEncounterAI(campaignId, partyLevel, partySize, env, difficulty);
        const embed = successEmbed('AI Encounter Generated', `**${result.encounter.name}** ready for **${campaign.name}**`);
        embed.addFields(
          { name: 'Encounter ID', value: `\`${result.encounter.id}\``, inline: true },
          { name: 'Difficulty', value: difficulty, inline: true },
          { name: 'Environment', value: env, inline: true },
          { name: 'Party', value: `Level ${partyLevel} · ${partySize} players`, inline: true },
          { name: 'Monsters', value: result.monsters.map(m => `${m.name} x${m.count}`).join(', ') || 'None', inline: false },
        );
        if (result.loot) embed.addFields({ name: 'Loot', value: result.loot.substring(0, 200), inline: false });
        if (result.xp_reward) embed.addFields({ name: 'XP Reward', value: `${result.xp_reward}`, inline: true });
        if (result.dm_notes) embed.addFields({ name: 'DM Notes', value: result.dm_notes.substring(0, 200), inline: false });
        if (result.environmental_features?.length > 0) {
          embed.addFields({ name: 'Environmental Features', value: result.environmental_features.join(', '), inline: false });
        }
        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ embeds: [errorEmbed('Generation Failed', e.message)] });
      }
    }

    if (sub === 'list') {
      const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
      if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const encounters = listEncounters(campaignId);
      if (encounters.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('No Encounters', 'No encounters for this campaign yet.')], ephemeral: true });
      }
      const list = encounters.map(e =>
        `**${e.name}** (ID: \`${e.id}\`) — ${e.status} — ${e.difficulty}`
      ).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Encounters', list)] });
    }

    if (sub === 'view') {
      const id = parseInt(interaction.options.getString('id'), 10);
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid encounter ID.')], ephemeral: true });
      const encounter = getEncounter(id);
      if (!encounter) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Encounter not found.')], ephemeral: true });
      return interaction.reply({ embeds: [encounterEmbed(encounter, encounter.combatants)] });
    }

    if (sub === 'add-monster') {
      const encounterId = parseInt(interaction.options.getString('encounter-id'), 10);
      if (isNaN(encounterId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid encounter ID.')], ephemeral: true });
      const encounter = getEncounter(encounterId);
      if (!encounter) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Encounter not found.')], ephemeral: true });
      const monsterName = interaction.options.getString('monster');
      const monster = getSrdMonster(monsterName);
      if (!monster) {
        const suggestions = searchMonsters(monsterName).slice(0, 5);
        const msg = suggestions.length > 0
          ? `Monster not found. Did you mean: ${suggestions.map(m => `\`${m.name}\``).join(', ')}?`
          : `Monster "${monsterName}" not found in SRD.`;
        return interaction.reply({ content: msg, ephemeral: true });
      }
      const count = interaction.options.getInteger('count') || 1;
      const added = [];
      for (let i = 0; i < count; i++) {
        const name = count > 1 ? `${monster.name} ${i + 1}` : monster.name;
        const dexBonus = monster.stats?.dex != null ? Math.floor((monster.stats.dex - 10) / 2) : 0;
        const initiative = Math.floor(Math.random() * 20) + 1 + dexBonus;
        const combatant = addCombatant(encounterId, {
          name,
          type: 'monster',
          monsterId: monster.id,
          hpMax: monster.hp,
          ac: monster.ac,
          initiative,
        });
        added.push(combatant);
      }
      const embed = successEmbed('Monsters Added', `${count} ${monster.name}${count > 1 ? 's' : ''} added to **${encounter.name}**!`);
      embed.addFields(
        { name: 'Encounter', value: `\`${encounter.id}\``, inline: true },
        { name: 'Total Combatants', value: `${(encounter.combatants?.length || 0) + count}`, inline: true },
      );
      const desc = generateEncounterDescription(monster, count);
      if (desc) embed.setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'add-custom') {
      const encounterId = parseInt(interaction.options.getString('encounter-id'), 10);
      if (isNaN(encounterId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
      const encounter = getEncounter(encounterId);
      if (!encounter) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Encounter not found.')], ephemeral: true });
      const combatant = addCombatant(encounterId, {
        name: interaction.options.getString('name'),
        type: interaction.options.getString('type') || 'monster',
        hpMax: interaction.options.getInteger('hp'),
        ac: interaction.options.getInteger('ac'),
        initiative: Math.floor(Math.random() * 20) + 1,
      });
      return interaction.reply({ embeds: [successEmbed('Combatant Added', `**${combatant.name}** added to ${encounter.name}.`)] });
    }

    if (sub === 'remove') {
      const combatantId = parseInt(interaction.options.getString('combatant-id'), 10);
      if (isNaN(combatantId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
      const result = removeCombatant(combatantId);
      if (!result) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Combatant not found.')], ephemeral: true });
      return interaction.reply({ embeds: [successEmbed('Combatant Removed', 'Combatant has been removed.')] });
    }

    if (sub === 'start') {
      const id = parseInt(interaction.options.getString('id'), 10);
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
      const encounter = getEncounter(id);
      if (!encounter) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Encounter not found.')], ephemeral: true });
      if (!encounter.combatants || encounter.combatants.length === 0) {
        return interaction.reply({ embeds: [errorEmbed('No Combatants', 'Add combatants before starting.')], ephemeral: true });
      }
      const updated = startEncounter(id);
      const startNarration = getNarration('encounter_start');
      const embed = successEmbed('⚔️ Combat Started!', startNarration || `**${encounter.name}** has begun!`);
      const firstCombatant = updated.combatants.find(c => c.id === updated.initiativeOrder[0]);
      embed.addFields(
        { name: 'Round', value: `${updated.round}`, inline: true },
        { name: 'Combatants', value: `${updated.combatants.length}`, inline: true },
        { name: 'First Turn', value: firstCombatant ? `**${firstCombatant.name}**` : 'Unknown', inline: true },
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'next') {
      const id = parseInt(interaction.options.getString('id'), 10);
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
      const encounter = getEncounter(id);
      if (!encounter) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Encounter not found.')], ephemeral: true });
      if (encounter.status !== 'active') {
        return interaction.reply({ embeds: [errorEmbed('Not Started', 'Start the encounter first with `/encounter start`.')], ephemeral: true });
      }
      const updated = nextTurn(id);
      const currentCombatant = updated.combatants.find(c => c.id === updated.initiativeOrder[updated.currentTurn]);
      const embed = infoEmbed('Next Turn', `**Round ${updated.round}** — It's **${currentCombatant?.name || 'Unknown'}**'s turn!`);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'damage') {
      const combatantId = parseInt(interaction.options.getString('combatant-id'), 10);
      const amount = interaction.options.getInteger('amount');
      if (isNaN(combatantId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
      const updated = damageCombatant(combatantId, amount);
      if (!updated) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Combatant not found.')], ephemeral: true });
      const hitNarration = getNarration(updated.hp_current <= 0 ? 'kill' : 'hit');
      const embed = infoEmbed(`💥 ${updated.name} took ${amount} damage!`, hitNarration || '');
      embed.addFields({ name: 'HP', value: `${updated.hp_current}/${updated.hp_max}`, inline: true });
      if (updated.hp_current <= 0) {
        embed.addFields({ name: 'Status', value: '❌ Defeated', inline: true });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'condition') {
      const combatantId = parseInt(interaction.options.getString('combatant-id'), 10);
      const condition = interaction.options.getString('condition').toLowerCase();
      if (isNaN(combatantId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
      const updated = addCondition(combatantId, condition);
      if (!updated) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Combatant not found.')], ephemeral: true });
      return interaction.reply({ embeds: [infoEmbed('Condition Added', `**${updated.name}** is now **${condition}**.`)] });
    }

    if (sub === 'end') {
      const id = parseInt(interaction.options.getString('id'), 10);
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
      const encounter = getEncounter(id);
      if (!encounter) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Encounter not found.')], ephemeral: true });
      endEncounter(id, 'completed');
      const embed = successEmbed('Encounter Ended', `**${encounter.name}** has concluded!`);
      embed.addFields({ name: 'Total Rounds', value: `${encounter.round || 0}`, inline: true });
      const combatants = encounter.combatants || [];
      const alive = combatants.filter(c => c.hp_current > 0).length;
      embed.addFields({ name: 'Survivors', value: `${alive}/${combatants.length}`, inline: true });
      return interaction.reply({ embeds: [embed] });
    }
  },
};
