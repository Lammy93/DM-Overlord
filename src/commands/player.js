import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds.js';
import { createWebUser, listWebUsers, deleteWebUser, resetWebUserPassword } from '../services/webUsers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('player')
    .setDescription('Manage web UI player accounts')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a web UI player account')
        .addStringOption(opt => opt.setName('username').setDescription('Login username').setRequired(true))
        .addStringOption(opt => opt.setName('password').setDescription('Login password').setRequired(true))
        .addUserOption(opt => opt.setName('discord-user').setDescription('Linked Discord user (optional)').setRequired(false))
        .addStringOption(opt => opt.setName('display-name').setDescription('Display name (defaults to username)').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all web UI player accounts'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Deactivate a player account')
        .addIntegerOption(opt => opt.setName('id').setDescription('User ID from /player list').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('reset-password')
        .setDescription('Reset a player\'s password')
        .addIntegerOption(opt => opt.setName('id').setDescription('User ID from /player list').setRequired(true))
        .addStringOption(opt => opt.setName('new-password').setDescription('New password').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const username = interaction.options.getString('username');
      const password = interaction.options.getString('password');
      const discordUser = interaction.options.getUser('discord-user');
      const displayName = interaction.options.getString('display-name');

      if (password.length < 4) {
        return interaction.reply({ embeds: [errorEmbed('Weak Password', 'Password must be at least 4 characters.')], ephemeral: true });
      }

      const result = createWebUser(username, password, discordUser?.id || null, displayName || discordUser?.username || null, interaction.user.id);
      if (result.error) {
        return interaction.reply({ embeds: [errorEmbed('Create Failed', result.error)], ephemeral: true });
      }

      const vaultUrl = process.env.WEB_BASE_URL || `http://localhost:${process.env.WEB_PORT || 3000}`;

      if (discordUser) {
        // Send DM to the linked Discord user
        const dmEmbed = new (await import('discord.js')).EmbedBuilder()
          .setColor(0x35a3d9)
          .setTitle('🎮 Player Account Created')
          .setDescription(`A player account has been created for you.`)
          .addFields(
            { name: 'Web UI Login', value: `🔗 ${vaultUrl}`, inline: false },
            { name: 'Username', value: `\`${username}\``, inline: true },
            { name: 'Password', value: `\`${password}\``, inline: true },
          )
          .setFooter({ text: 'You will be prompted to change your password on first login.' })
          .setTimestamp();

        const dmSent = await discordUser.send({ embeds: [dmEmbed] }).then(() => true).catch(() => false);

        if (dmSent) {
          return interaction.reply({
            embeds: [successEmbed('Player Account Created', `**${username}** can now log in. Credentials sent to ${discordUser} via DM.`)],
            flags: MessageFlags.Ephemeral,
          });
        } else {
          return interaction.reply({
            embeds: [successEmbed('Player Account Created', `**${username}** can now log in.`)],
            content: `⚠️ Could not DM ${discordUser}. They may have DMs disabled.\nUsername: \`${username}\`\nPassword: \`${password}\``,
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        // No Discord user linked — show credentials in the reply
        const embed = successEmbed('Player Account Created',
          `**${username}** can now log in at the web UI.`
        );
        embed.addFields(
          { name: 'Username', value: `\`${username}\``, inline: true },
          { name: 'Password', value: `\`${password}\``, inline: true },
        );
        if (displayName) embed.addFields({ name: 'Display Name', value: displayName, inline: true });
        embed.setFooter({ text: '⚠️ This password is temporary. The player will be prompted to change it on first login.' });
        return interaction.reply({ embeds: [embed] });
      }
    }

    if (sub === 'list') {
      const users = listWebUsers();
      if (users.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('Player Accounts', 'No web UI player accounts yet. Use `/player create` to add one.')],
          ephemeral: true,
        });
      }
      const list = users.map(u =>
        `**#${u.id}** — \`${u.username}\`${u.display_name !== u.username ? ` (${u.display_name})` : ''}${u.discord_id ? ` — <@${u.discord_id}>` : ''}${u.is_active ? '' : ' — ❌ Inactive'}`
      ).join('\n');
      return interaction.reply({
        embeds: [infoEmbed(`Player Accounts (${users.length})`, list)],
      });
    }

    if (sub === 'remove') {
      const id = interaction.options.getInteger('id');
      deleteWebUser(id);
      return interaction.reply({
        embeds: [successEmbed('Account Deactivated', `User #${id} has been deactivated.`)],
      });
    }

    if (sub === 'reset-password') {
      const id = interaction.options.getInteger('id');
      const newPassword = interaction.options.getString('new-password');
      if (newPassword.length < 4) {
        return interaction.reply({ embeds: [errorEmbed('Weak Password', 'Password must be at least 4 characters.')], ephemeral: true });
      }
      const result = resetWebUserPassword(id, newPassword);
      if (result.error) {
        return interaction.reply({ embeds: [errorEmbed('Reset Failed', result.error)], ephemeral: true });
      }
      return interaction.reply({
        embeds: [successEmbed('Password Reset', `Password for user #${id} has been changed to \`${newPassword}\`.`)],
      });
    }
  },
};
