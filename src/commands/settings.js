import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds.js';
import { setGuildSetting, getGuildSetting, deleteGuildSetting } from '../services/guildSettings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configure bot settings for this server')
    .addSubcommand(sub =>
      sub.setName('embed-channel')
        .setDescription('Set the channel for embed notifications (soul binding, etc.)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('The channel to send embeds to')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current server settings'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'embed-channel') {
      const channel = interaction.options.getChannel('channel');
      setGuildSetting(guildId, 'embed_channel', channel.id);
      return interaction.reply({
        embeds: [successEmbed('Embed Channel Set', `Embeds will be sent to ${channel}.`)],
      });
    }

    if (sub === 'view') {
      const embedChannelId = getGuildSetting(guildId, 'embed_channel');
      const lines = [];
      if (embedChannelId) {
        const ch = interaction.guild.channels.cache.get(embedChannelId);
        lines.push(`**Embed Channel:** ${ch || `#${embedChannelId}`}`);
      } else {
        lines.push('**Embed Channel:** Not set (embeds will be sent via DM)');
      }
      return interaction.reply({
        embeds: [infoEmbed('Server Settings', lines.join('\n') || 'No settings configured.')],
        ephemeral: true,
      });
    }
  },
};
