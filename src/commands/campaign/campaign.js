import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';
import { createCampaign, getCampaign, listCampaigns, updateCampaign, deleteCampaign, addPlayer, removePlayer, getCampaignPlayers, createSessionLog, getSessionLogs, addLocation, getLocations, addNote, getNotes } from '../../services/campaign.js';
import { getCampaignMaps, addMap } from '../../services/maps.js';
import { writeCampaignNote } from '../../services/obsidian.js';
import { generateMapAI } from '../../services/aiGenerator.js';
import config from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('campaign')
    .setDescription('Manage your D&D campaigns')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new campaign')
        .addStringOption(opt => opt.setName('name').setDescription('Campaign name').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Campaign description').setRequired(false))
        .addStringOption(opt => opt.setName('setting').setDescription('Campaign setting (e.g., Forgotten Realms, Homebrew)').setRequired(false))
        .addIntegerOption(opt => opt.setName('starting-level').setDescription('Starting level for characters').setRequired(false).setMinValue(1).setMaxValue(20)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List your campaigns'))
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View campaign details')
        .addStringOption(opt => opt.setName('id').setDescription('Campaign ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('update')
        .setDescription('Update campaign settings')
        .addStringOption(opt => opt.setName('id').setDescription('Campaign ID').setRequired(true))
        .addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(false))
        .addStringOption(opt => opt.setName('description').setDescription('New description').setRequired(false))
        .addStringOption(opt => opt.setName('setting').setDescription('New setting').setRequired(false))
        .addStringOption(opt => opt.setName('status').setDescription('New status').setRequired(false).addChoices(
          { name: 'Preparation', value: 'preparation' },
          { name: 'Active', value: 'active' },
          { name: 'Paused', value: 'paused' },
          { name: 'Completed', value: 'completed' },
          { name: 'Archived', value: 'archived' },
        )))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a campaign')
        .addStringOption(opt => opt.setName('id').setDescription('Campaign ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('add-player')
        .setDescription('Add a player to the campaign')
        .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addUserOption(opt => opt.setName('player').setDescription('Player to add').setRequired(true))
        .addStringOption(opt => opt.setName('role').setDescription('Player role').setRequired(false).addChoices(
          { name: 'Player', value: 'player' },
          { name: 'Co-DM', value: 'co-dm' },
          { name: 'Observer', value: 'observer' },
        )))
    .addSubcommand(sub =>
      sub.setName('remove-player')
        .setDescription('Remove a player from the campaign')
        .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addUserOption(opt => opt.setName('player').setDescription('Player to remove').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('session')
        .setDescription('Log a new session')
        .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('session-number').setDescription('Session number').setRequired(true).setMinValue(1))
        .addStringOption(opt => opt.setName('title').setDescription('Session title').setRequired(false))
        .addStringOption(opt => opt.setName('summary').setDescription('Session summary').setRequired(false))
        .addStringOption(opt => opt.setName('highlights').setDescription('Key highlights').setRequired(false))
        .addStringOption(opt => opt.setName('loot').setDescription('Loot found').setRequired(false))
        .addIntegerOption(opt => opt.setName('xp').setDescription('XP gained').setRequired(false).setMinValue(0)))
    .addSubcommand(sub =>
      sub.setName('sessions')
        .setDescription('View session logs')
        .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('note')
        .setDescription('Add a note to the campaign')
        .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addStringOption(opt => opt.setName('title').setDescription('Note title').setRequired(true))
        .addStringOption(opt => opt.setName('content').setDescription('Note content').setRequired(false))
        .addStringOption(opt => opt.setName('category').setDescription('Category').setRequired(false).addChoices(
          { name: 'General', value: 'general' },
          { name: 'Quest', value: 'quest' },
          { name: 'NPC', value: 'npc' },
          { name: 'Lore', value: 'lore' },
        )))
    .addSubcommandGroup(sub =>
      sub.setName('map').setDescription('Manage campaign maps')
        .addSubcommand(cmd =>
          cmd.setName('add')
            .setDescription('Add a map to the campaign')
            .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
            .addStringOption(opt => opt.setName('name').setDescription('Map name').setRequired(true))
            .addStringOption(opt => opt.setName('image-url').setDescription('Image URL').setRequired(true))
            .addIntegerOption(opt => opt.setName('grid-size').setDescription('Grid size in pixels (default: 50)').setRequired(false).setMinValue(10).setMaxValue(200))
            .addStringOption(opt => opt.setName('notes').setDescription('Notes about the map').setRequired(false)))
        .addSubcommand(cmd =>
          cmd.setName('list')
            .setDescription('List maps for a campaign')
            .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true)))
        .addSubcommand(cmd =>
          cmd.setName('generate')
            .setDescription('AI-generate a map with points of interest')
            .addStringOption(opt => opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
            .addStringOption(opt => opt.setName('location').setDescription('Location name to generate a map for').setRequired(true))
            .addStringOption(opt => opt.setName('description').setDescription('Brief description of the area').setRequired(false)))),
  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    if (group === 'map') {
      return handleMapSubcommand(interaction);
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const name = interaction.options.getString('name');
      const data = {
        name,
        description: interaction.options.getString('description'),
        setting: interaction.options.getString('setting'),
        dmDiscordId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        startingLevel: interaction.options.getInteger('starting-level') ?? 1,
      };
      const campaign = createCampaign(data);
      writeCampaignNote(campaign).catch(() => {});
      const embed = successEmbed('Campaign Created', `**${campaign.name}** is ready!`);
      embed.addFields(
        { name: 'ID', value: `\`${campaign.id}\``, inline: true },
        { name: 'Setting', value: campaign.setting || 'Homebrew', inline: true },
        { name: 'Starting Level', value: `${campaign.starting_level}`, inline: true },
        { name: 'Status', value: campaign.status, inline: true },
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      // Show all campaigns the DM owns across all guilds
      const campaigns = listCampaigns(interaction.user.id, 'dm');
      if (campaigns.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('No Campaigns', 'You have no campaigns yet. Use `/campaign create` to start one.')], ephemeral: true });
      }
      const list = campaigns.map(c =>
        `**${c.name}** (ID: \`${c.id}\`) — ${c.status} — ${c.current_session || 0} sessions`
      ).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Your Campaigns', list)] });
    }

    if (sub === 'info') {
      const id = parseInt(interaction.options.getString('id'), 10);
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const campaign = getCampaign(id);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
      const embed = infoEmbed(`📜 ${campaign.name}`, campaign.description || 'No description');
      embed.addFields(
        { name: 'ID', value: `\`${campaign.id}\``, inline: true },
        { name: 'Setting', value: campaign.setting || 'Homebrew', inline: true },
        { name: 'Status', value: campaign.status, inline: true },
        { name: 'Sessions', value: `${campaign.current_session || 0}`, inline: true },
        { name: 'Starting Level', value: `${campaign.starting_level}`, inline: true },
        { name: 'Players', value: `${campaign.players?.length || 0}`, inline: true },
      );
      if (campaign.players?.length > 0) {
        embed.addFields({ name: 'Party', value: campaign.players.map(p => `<@${p.discord_id}> (${p.role})`).join('\n'), inline: false });
      }
      if (campaign.characters?.length > 0) {
        embed.addFields({ name: 'Characters', value: campaign.characters.map(c => `**${c.name}** — Lvl ${c.level} ${c.race} ${c.class}`).join('\n'), inline: false });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'update') {
      const id = parseInt(interaction.options.getString('id'), 10);
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const campaign = getCampaign(id);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
      if (campaign.dm_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can update this campaign.')], ephemeral: true });
      }
      const updates = {};
      for (const field of ['name', 'description', 'setting']) {
        const val = interaction.options.getString(field);
        if (val) updates[field] = val;
      }
      const status = interaction.options.getString('status');
      if (status) updates.status = status;

      const updated = updateCampaign(id, updates);
      return interaction.reply({ embeds: [successEmbed('Campaign Updated', `**${updated.name}** has been updated.`)] });
    }

    if (sub === 'delete') {
      const id = parseInt(interaction.options.getString('id'), 10);
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const campaign = getCampaign(id);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
      if (campaign.dm_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can delete this campaign.')], ephemeral: true });
      }
      deleteCampaign(id);
      return interaction.reply({ embeds: [successEmbed('Campaign Deleted', `**${campaign.name}** has been deleted.`)] });
    }

    if (sub === 'add-player') {
      const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
      if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const campaign = getCampaign(campaignId);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
      if (campaign.dm_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can add players.')], ephemeral: true });
      }
      const player = interaction.options.getUser('player');
      const role = interaction.options.getString('role') || 'player';
      addPlayer(campaignId, player.id, player.username, role);
      return interaction.reply({ embeds: [successEmbed('Player Added', `${player} has been added to **${campaign.name}** as ${role}.`)] });
    }

    if (sub === 'remove-player') {
      const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
      if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const campaign = getCampaign(campaignId);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
      if (campaign.dm_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can remove players.')], ephemeral: true });
      }
      const player = interaction.options.getUser('player');
      removePlayer(campaignId, player.id);
      return interaction.reply({ embeds: [successEmbed('Player Removed', `${player} has been removed from **${campaign.name}**.`)] });
    }

    if (sub === 'session') {
      const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
      if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const campaign = getCampaign(campaignId);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
      if (campaign.dm_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can log sessions.')], ephemeral: true });
      }

      const sessionNumber = interaction.options.getInteger('session-number');
      const session = createSessionLog(campaignId, sessionNumber, {
        title: interaction.options.getString('title'),
        summary: interaction.options.getString('summary'),
        highlights: interaction.options.getString('highlights'),
        lootFound: interaction.options.getString('loot'),
        xpGained: interaction.options.getInteger('xp') || 0,
      });

      const embed = successEmbed(`Session ${sessionNumber} Logged`, `**${campaign.name}** — Session ${sessionNumber}`);
      if (session.title) embed.addFields({ name: 'Title', value: session.title, inline: false });
      if (session.summary) embed.addFields({ name: 'Summary', value: session.summary.substring(0, 200), inline: false });

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'sessions') {
      const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
      if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const campaign = getCampaign(campaignId);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
      const sessions = getSessionLogs(campaignId);
      if (sessions.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('No Sessions', 'No sessions logged yet.')], ephemeral: true });
      }
      const list = sessions.map(s =>
        `**Session ${s.session_number}:** ${s.title || 'Untitled'} — ${s.summary?.substring(0, 80) || 'No summary'}`
      ).join('\n');
      return interaction.reply({ embeds: [infoEmbed(`📜 ${campaign.name} — Sessions`, list)] });
    }

    if (sub === 'note') {
      const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
      if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
      const campaign = getCampaign(campaignId);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
      if (campaign.dm_discord_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can add notes.')], ephemeral: true });
      }
      const note = addNote(campaignId, {
        title: interaction.options.getString('title'),
        content: interaction.options.getString('content'),
        category: interaction.options.getString('category') || 'general',
        authorDiscordId: interaction.user.id,
      });
      return interaction.reply({ embeds: [successEmbed('Note Added', `**${note.title}** added to ${campaign.name}.`)] });
    }
  },
};

async function handleMapSubcommand(interaction) {
  const sub = interaction.options.getSubcommand();
  const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
  if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
  const campaign = getCampaign(campaignId);
  if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });

  if (sub === 'list') {
    const maps = getCampaignMaps(campaignId);
    if (maps.length === 0) {
      return interaction.reply({ embeds: [infoEmbed('No Maps', `No maps for **${campaign.name}**. Add one with \`/campaign map add\`.`)] });
    }
    const list = maps.map(m => `**${m.name}** — ${m.notes || ''} ${m.grid_size ? `(Grid: ${m.grid_size}px)` : ''}`.trim()).join('\n');
    return interaction.reply({ embeds: [infoEmbed(`🗺️ ${campaign.name} — Maps`, list)] });
  }

  if (sub === 'add') {
    if (campaign.dm_discord_id !== interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can add maps.')], ephemeral: true });
    }
    const map = addMap(campaignId, {
      name: interaction.options.getString('name'),
      imageUrl: interaction.options.getString('image-url'),
      gridSize: interaction.options.getInteger('grid-size') || 50,
      notes: interaction.options.getString('notes'),
    });
    const baseUrl = process.env.WEB_BASE_URL || `http://localhost:${config.web?.port || 3000}`;
    return interaction.reply({ embeds: [successEmbed('Map Added', `**${map.name}** added to ${campaign.name}.\n\nView at: ${baseUrl}/#map/${map.id}`)] });
  }

  if (sub === 'generate') {
    if (campaign.dm_discord_id !== interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can generate maps.')], ephemeral: true });
    }

    await interaction.deferReply();

    const location = interaction.options.getString('location');
    const description = interaction.options.getString('description') || '';

    try {
      const result = await generateMapAI(campaignId, campaign.name, location, description);
      const embed = successEmbed('AI Map Generated', `**${result.map.name}** added to **${campaign.name}**`);
      embed.addFields(
        { name: 'Map ID', value: `\`${result.map.id}\``, inline: true },
        { name: 'Grid Size', value: `${result.map.grid_size}px`, inline: true },
        { name: 'Points of Interest', value: `${result.pins.length} pins placed`, inline: true },
        { name: 'Atmosphere', value: result.atmosphere || 'None', inline: false },
      );
      if (result.suggested_encounters?.length > 0) {
        embed.addFields({ name: 'Suggested Encounters', value: result.suggested_encounters.join(', '), inline: false });
      }
      embed.addFields(
        { name: 'View Map', value: `${process.env.WEB_BASE_URL || `http://localhost:${config.web?.port || 3000}`}/#map/${result.map.id}`, inline: false },
      );
      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      return interaction.editReply({ embeds: [errorEmbed('Generation Failed', e.message)] });
    }
  }
}
