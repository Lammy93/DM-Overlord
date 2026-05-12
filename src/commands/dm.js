import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds.js';
import { addDm, removeDm, isDm, listDms } from '../services/dmRoles.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Manage global DM users')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Designate a user as a Dungeon Master')
        .addUserOption(opt => opt.setName('user').setDescription('User to make a DM').setRequired(true))
        .addStringOption(opt => opt.setName('notes').setDescription('Optional notes').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove DM designation from a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to remove as DM').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all designated DMs'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const notes = interaction.options.getString('notes');
      addDm(user.id, user.username, notes);
      return interaction.reply({
        embeds: [successEmbed('DM Added', `${user} has been designated as a global Dungeon Master.`)],
      });
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      const wasDm = isDm(user.id);
      if (!wasDm) {
        return interaction.reply({
          embeds: [errorEmbed('Not a DM', `${user} is not designated as a DM.`)],
          ephemeral: true,
        });
      }
      removeDm(user.id);
      return interaction.reply({
        embeds: [successEmbed('DM Removed', `${user} is no longer a designated DM.`)],
      });
    }

    if (sub === 'list') {
      const dms = listDms();
      if (dms.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('Global DMs', 'No global DMs designated. Use `/dm add` to designate one.')],
          ephemeral: true,
        });
      }
      const list = dms.map(d => `<@${d.discord_id}> — ${d.discord_username || 'Unknown'}${d.notes ? ` (${d.notes})` : ''}`).join('\n');
      return interaction.reply({
        embeds: [infoEmbed('Global Dungeon Masters', list)],
      });
    }
  },
};
