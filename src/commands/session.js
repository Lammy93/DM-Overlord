import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds.js';
import { startAutoSession, stopAutoSession, getActiveSession, logToActiveSession, getSessionEvents, buildSessionSummary, syncToObsidian } from '../services/sessionLog.js';
import { getCampaign, getSessionLogs, getSessionLog } from '../services/campaign.js';

export default {
  data: new SlashCommandBuilder()
    .setName('session')
    .setDescription('Live session logging with auto-capture')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start live session logging')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('session-number').setDescription('Session number').setRequired(true).setMinValue(1))
        .addStringOption(opt =>
          opt.setName('title').setDescription('Session title').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('stop')
        .setDescription('Stop live session logging')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('note')
        .setDescription('Add a quick note to the active session')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addStringOption(opt =>
          opt.setName('text').setDescription('Note content').setRequired(true))
        .addBooleanOption(opt =>
          opt.setName('dm-only').setDescription('Only visible to DM').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('highlight')
        .setDescription('Mark a highlight during the session')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addStringOption(opt =>
          opt.setName('text').setDescription('What happened?').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('interaction')
        .setDescription('Log a player interaction or NPC conversation')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addStringOption(opt =>
          opt.setName('title').setDescription('With whom?').setRequired(true))
        .addStringOption(opt =>
          opt.setName('details').setDescription('What was said or learned').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('loot')
        .setDescription('Log loot found')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addStringOption(opt =>
          opt.setName('items').setDescription('Items found').setRequired(true))
        .addStringOption(opt =>
          opt.setName('gold').setDescription('Gold amount').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('milestone')
        .setDescription('Log a milestone (quest complete, level up, discovery)')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addStringOption(opt =>
          opt.setName('title').setDescription('Milestone title').setRequired(true))
        .addStringOption(opt =>
          opt.setName('description').setDescription('What happened').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View active session status and event count')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('history')
        .setDescription('View all events logged this session')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('limit').setDescription('Number of events to show (default: 20)').setRequired(false).setMinValue(1).setMaxValue(100)))
    .addSubcommand(sub =>
      sub.setName('sync')
        .setDescription('Sync the active session to Obsidian now')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const campaignId = parseInt(interaction.options.getString('campaign-id'));

    if (isNaN(campaignId) && !['start', 'stop', 'note', 'highlight', 'interaction', 'loot', 'milestone', 'status', 'history', 'sync'].includes(sub)) {
      return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
    }

    if (sub === 'start') {
      const campaign = getCampaign(campaignId);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });

      const sessionNumber = interaction.options.getInteger('session-number');
      const title = interaction.options.getString('title');

      const result = startAutoSession(campaignId, sessionNumber, interaction.user.id, interaction.channelId, title);

      if (result.message) {
        return interaction.reply({ embeds: [infoEmbed('Already Logging', result.message)], ephemeral: true });
      }

      const embed = successEmbed('🎙️ Live Session Started',
        `Logging **${campaign.name}** — Session ${sessionNumber}${title ? ': ' + title : ''}`
      );
      embed.addFields(
        { name: 'Session ID', value: `\`${result.session.id}\``, inline: true },
        { name: 'Auto-Capture Active', value: 'HP changes, level ups, combat, and more will be auto-logged.', inline: false },
        { name: 'Quick Commands', value: '`/session note` — Add a note\n`/session highlight` — Mark a highlight\n`/session interaction` — Log NPC talks\n`/session loot` — Record treasure\n`/session stop` — End session', inline: false },
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'stop') {
      const active = getActiveSession(campaignId);
      if (!active) return interaction.reply({ embeds: [errorEmbed('No Active Session', 'No session is currently being logged.')], ephemeral: true });

      const result = stopAutoSession(campaignId, interaction.user.id);
      if (result.error) return interaction.reply({ embeds: [errorEmbed('Error', result.error)], ephemeral: true });

      const summary = buildSessionSummary(active.session.id);
      const embed = successEmbed('Session Ended',
        `Session ${active.session.session_number} concluded with ${summary?.counts?.total || 0} logged events.`
      );
      if (summary?.counts) {
        embed.addFields(
          { name: 'Combat Encounters', value: `${summary.counts.combat}`, inline: true },
          { name: 'Interactions', value: `${summary.counts.interaction}`, inline: true },
          { name: 'Milestones', value: `${summary.counts.milestone}`, inline: true },
          { name: 'Notes', value: `${summary.counts.note}`, inline: true },
          { name: 'Loot', value: `${summary.counts.loot}`, inline: true },
          { name: 'Character Updates', value: `${summary.counts.character_update}`, inline: true },
          { name: 'Next Step', value: 'Use `/session sync` to write to Obsidian vault.', inline: false },
        );
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'note') {
      const text = interaction.options.getString('text');
      const dmOnly = interaction.options.getBoolean('dm-only') || false;
      const result = logToActiveSession(campaignId, 'note', 'Note', text, interaction.user.id, interaction.member?.displayName || interaction.user.username, dmOnly);
      if (!result) return interaction.reply({ embeds: [errorEmbed('No Active Session', 'Start a session with `/session start` first.')], ephemeral: true });
      const visibility = dmOnly ? ' (DM-only)' : '';
      return interaction.reply({ embeds: [successEmbed('📌 Note Added' + visibility, text)], ephemeral: dmOnly });
    }

    if (sub === 'highlight') {
      const text = interaction.options.getString('text');
      const result = logToActiveSession(campaignId, 'milestone', '⭐ ' + text, text, interaction.user.id, interaction.member?.displayName || interaction.user.username);
      if (!result) return interaction.reply({ embeds: [errorEmbed('No Active Session', 'Start a session with `/session start` first.')], ephemeral: true });
      return interaction.reply({ embeds: [successEmbed('⭐ Highlight Recorded', text)] });
    }

    if (sub === 'interaction') {
      const title = interaction.options.getString('title');
      const details = interaction.options.getString('details');
      const result = logToActiveSession(campaignId, 'interaction', `💬 ${title}`, details, interaction.user.id, interaction.member?.displayName || interaction.user.username);
      if (!result) return interaction.reply({ embeds: [errorEmbed('No Active Session', 'Start a session with `/session start` first.')], ephemeral: true });
      return interaction.reply({ embeds: [successEmbed('💬 Interaction Logged', `**${title}**\n${details}`)] });
    }

    if (sub === 'loot') {
      const items = interaction.options.getString('items');
      const gold = interaction.options.getString('gold');
      const content = items + (gold ? ` (${gold} gp)` : '');
      const result = logToActiveSession(campaignId, 'loot', '💰 Treasure Found', content, interaction.user.id, interaction.member?.displayName || interaction.user.username);
      if (!result) return interaction.reply({ embeds: [errorEmbed('No Active Session', 'Start a session with `/session start` first.')], ephemeral: true });
      return interaction.reply({ embeds: [successEmbed('💰 Loot Recorded', content)] });
    }

    if (sub === 'milestone') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const result = logToActiveSession(campaignId, 'milestone', `🏆 ${title}`, description || title, interaction.user.id, interaction.member?.displayName || interaction.user.username);
      if (!result) return interaction.reply({ embeds: [errorEmbed('No Active Session', 'Start a session with `/session start` first.')], ephemeral: true });
      return interaction.reply({ embeds: [successEmbed('🏆 Milestone Recorded', `${title}${description ? '\n' + description : ''}`)] });
    }

    if (sub === 'status') {
      const active = getActiveSession(campaignId);
      if (!active) return interaction.reply({ embeds: [infoEmbed('No Active Session', 'No session is currently being logged. Start one with `/session start`.')], ephemeral: true });

      const summary = buildSessionSummary(active.session.id);
      const embed = infoEmbed(`🎙️ Session ${active.session.session_number} — Active`,
        `Started ${new Date(active.active.started_at).toLocaleString()} in <#${active.active.channel_id || ''}>`
      );
      embed.addFields(
        { name: 'Elapsed', value: getElapsed(active.active.started_at), inline: true },
        { name: 'Events Logged', value: `${summary?.counts?.total || 0}`, inline: true },
        { name: 'Combat', value: `${summary?.counts?.combat || 0}`, inline: true },
        { name: 'Notes', value: `${summary?.counts?.note || 0}`, inline: true },
        { name: 'Interactions', value: `${summary?.counts?.interaction || 0}`, inline: true },
        { name: 'Milestones', value: `${summary?.counts?.milestone || 0}`, inline: true },
        { name: 'Auto-Capture', value: 'HP changes, damage, healing, level ups, and combat are logged automatically.', inline: false },
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'history') {
      const active = getActiveSession(campaignId);
      if (!active) return interaction.reply({ embeds: [infoEmbed('No Active Session', 'No active session.')], ephemeral: true });

      const limit = interaction.options.getInteger('limit') || 20;
      const events = getSessionEvents(active.session.id);
      const recent = events.slice(-limit);

      if (recent.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('No Events', 'No events logged yet this session.')], ephemeral: true });
      }

      const emoji = {
        narrative: '📖', combat: '⚔️', interaction: '💬',
        character_update: '📝', loot: '💰', note: '📌',
        milestone: '⭐', roll: '🎲', location_change: '📍',
      };

      const lines = recent.map(e => {
        const em = emoji[e.type] || '•';
        const time = new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `\`${time}\` ${em} **${e.title}**${e.content ? ': ' + e.content.substring(0, 100) : ''}`;
      });

      const chunks = chunkArray(lines, 20);
      const embed = infoEmbed(`📜 Session Log — ${active.session.session_number} (${events.length} events)`,
        chunks[0].join('\n') + (events.length > limit ? `\n\n*+${events.length - limit} more — use /session history limit: 100 to see all*` : '')
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'sync') {
      const active = getActiveSession(campaignId);
      if (!active) return interaction.reply({ embeds: [errorEmbed('No Active Session', 'Start a session first.')], ephemeral: true });

      const result = await syncToObsidian(active.session.id);
      if (result.error) {
        return interaction.reply({ embeds: [errorEmbed('Sync Failed', result.error)], ephemeral: true });
      }
      return interaction.reply({ embeds: [successEmbed('📝 Synced to Obsidian', `Session written to \`${result.path}\``)] });
    }
  },
};

function getElapsed(startedAt) {
  const ms = Date.now() - new Date(startedAt).getTime();
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
