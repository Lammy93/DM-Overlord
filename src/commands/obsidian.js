import { SlashCommandBuilder } from 'discord.js';
import { testVaultConnection, writeCampaignNote, writeCharacterNote, writeSessionNote, writeEncounterNote } from '../services/obsidian.js';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds.js';
import { getCampaign, getSessionLog } from '../services/campaign.js';
import { getCharacter } from '../services/character.js';
import { getEncounter } from '../services/encounter.js';

export default {
  data: new SlashCommandBuilder()
    .setName('obsidian')
    .setDescription('Manage Obsidian vault integration')
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Check Obsidian vault connection status'))
    .addSubcommand(sub =>
      sub.setName('sync-campaign')
        .setDescription('Sync a campaign to your Obsidian vault')
        .addStringOption(opt =>
          opt.setName('campaign-id')
            .setDescription('ID of the campaign to sync')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('sync-character')
        .setDescription('Sync a character to your Obsidian vault')
        .addStringOption(opt =>
          opt.setName('character-id')
            .setDescription('ID of the character to sync')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('sync-encounter')
        .setDescription('Sync an encounter to your Obsidian vault')
        .addStringOption(opt =>
          opt.setName('encounter-id')
            .setDescription('ID of the encounter to sync')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('sync-session')
        .setDescription('Sync a session log to your Obsidian vault')
        .addStringOption(opt =>
          opt.setName('session-id')
            .setDescription('ID of the session log to sync')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'status': {
        const result = await testVaultConnection();
        if (result.connected) {
          const embed = successEmbed('Obsidian Connected', 'Your vault is ready.');
          embed.addFields(
            { name: 'Vault Path', value: `\`${result.path}\``, inline: false },
            { name: 'Subfolder', value: `\`${result.subfolder}\``, inline: true }
          );
          return interaction.reply({ embeds: [embed] });
        }
        return interaction.reply({
          embeds: [errorEmbed('Obsidian Disconnected', `Could not connect to vault.\n\`${result.error}\``)],
          ephemeral: true,
        });
      }

      case 'sync-campaign': {
        const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
        if (isNaN(campaignId)) {
          return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid campaign ID.')], ephemeral: true });
        }
        const campaign = getCampaign(campaignId);
        if (!campaign) {
          return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });
        }
        if (campaign.dm_discord_id !== interaction.user.id) {
          const { isDm } = await import('../services/dmRoles.js');
          if (!isDm(interaction.user.id)) {
            return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the campaign DM or a global DM can sync this campaign.')], ephemeral: true });
          }
        }
        const result = await writeCampaignNote(campaign);
        if (result.success) {
          return interaction.reply({ embeds: [successEmbed('Campaign Synced', `Written to \`${result.path}\``)] });
        }
        return interaction.reply({ embeds: [errorEmbed('Sync Failed', result.error)], ephemeral: true });
      }

      case 'sync-character': {
        const charId = parseInt(interaction.options.getString('character-id'), 10);
        if (isNaN(charId)) {
          return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
        }
        const character = getCharacter(charId);
        if (!character) {
          return interaction.reply({ embeds: [errorEmbed('Not Found', 'Character not found.')], ephemeral: true });
        }
        const campaignName = character.campaign_id ? getCampaign(character.campaign_id)?.name : null;
        const result = await writeCharacterNote(character, interaction.user.username, campaignName);
        if (result.success) {
          return interaction.reply({ embeds: [successEmbed('Character Synced', `Written to \`${result.path}\``)] });
        }
        return interaction.reply({ embeds: [errorEmbed('Sync Failed', result.error)], ephemeral: true });
      }

      case 'sync-encounter': {
        const encId = parseInt(interaction.options.getString('encounter-id'), 10);
        if (isNaN(encId)) {
          return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid encounter ID.')], ephemeral: true });
        }
        const encounter = getEncounter(encId);
        if (!encounter) {
          return interaction.reply({ embeds: [errorEmbed('Not Found', 'Encounter not found.')], ephemeral: true });
        }
        const campaign = getCampaign(encounter.campaign_id);
        const result = await writeEncounterNote(encounter, campaign?.name);
        if (result.success) {
          return interaction.reply({ embeds: [successEmbed('Encounter Synced', `Written to \`${result.path}\``)] });
        }
        return interaction.reply({ embeds: [errorEmbed('Sync Failed', result.error)], ephemeral: true });
      }

      case 'sync-session': {
        const sessionId = parseInt(interaction.options.getString('session-id'), 10);
        if (isNaN(sessionId)) {
          return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid session ID.')], ephemeral: true });
        }
        const session = getSessionLog(sessionId);
        if (!session) {
          return interaction.reply({ embeds: [errorEmbed('Not Found', 'Session log not found.')], ephemeral: true });
        }
        const campaign = getCampaign(session.campaign_id);
        const result = await writeSessionNote(session, campaign?.name);
        if (result.success) {
          return interaction.reply({ embeds: [successEmbed('Session Synced', `Written to \`${result.path}\``)] });
        }
        return interaction.reply({ embeds: [errorEmbed('Sync Failed', result.error)], ephemeral: true });
      }
    }
  },
};
