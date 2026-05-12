import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';
import crypto from 'crypto';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds.js';
import { addGuildAdmin, removeGuildAdmin, isGuildAdmin, listGuildAdmins, linkCharacter, unlinkCharacter, getPlayerCharacters } from '../services/guildAdmin.js';
import { getCharacter } from '../services/character.js';
import { writeCharacterNote } from '../services/obsidian.js';
import { getGuildSetting } from '../services/guildSettings.js';
import { createWebUser, listWebUsers } from '../services/webUsers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Manage guild admins and player-character links')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Designate a user as a guild admin')
        .addUserOption(opt => opt.setName('user').setDescription('User to make admin').setRequired(true))
        .addStringOption(opt => opt.setName('role').setDescription('Role').setRequired(false).addChoices(
          { name: 'Admin', value: 'admin' },
          { name: 'Co-DM', value: 'co-dm' },
        )))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove admin from a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all guild admins'))
    .addSubcommand(sub =>
      sub.setName('link')
        .setDescription('Link a character to a Discord user')
        .addStringOption(opt => opt.setName('character-id').setDescription('Character ID').setRequired(true))
        .addUserOption(opt => opt.setName('user').setDescription('User to link to (defaults to yourself)').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('unlink')
        .setDescription('Unlink a character from its user')
        .addStringOption(opt => opt.setName('character-id').setDescription('Character ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('whois')
        .setDescription('Show characters linked to a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to look up').setRequired(false)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getString('role') || 'admin';

      // Check if already an admin in this guild
      if (isGuildAdmin(guildId, user.id)) {
        return interaction.reply({
          embeds: [infoEmbed('Already an Admin', `${user} is already a guild admin in this server. Use \`/admin remove\` to change their role first.`)],
          ephemeral: true,
        });
      }

      addGuildAdmin(guildId, user.id, user.username, role, interaction.user.id);

      // Check if user already has a web account (from another server)
      const existingWebUser = listWebUsers().find(u => u.discord_id === user.id);
      const hasExistingAccount = !!existingWebUser;

      const vaultUrl = process.env.WEB_BASE_URL || `http://localhost:${process.env.WEB_PORT || 3000}`;

      if (!hasExistingAccount) {
        // Create new web user account with temp password
        const tempPass = crypto.randomBytes(4).toString('hex');
        createWebUser(user.username, tempPass, user.id, user.username, interaction.user.id, 'admin', true);

        const dmEmbed = new EmbedBuilder()
          .setColor(Colors.Gold)
          .setTitle('🛡️ You\'ve Been Designated as a Guild Admin!')
          .setDescription(`You have been granted **${role}** privileges in **${interaction.guild.name}**.`)
          .addFields(
            { name: 'Server', value: interaction.guild.name, inline: true },
            { name: 'Role', value: role, inline: true },
            { name: 'Web UI Login', value: `🔗 ${vaultUrl}`, inline: false },
            { name: 'Username', value: `\`${user.username}\``, inline: true },
            { name: 'Temporary Password', value: `\`${tempPass}\``, inline: true },
          )
          .setFooter({ text: 'Please change your password after first login.' })
          .setTimestamp();

        const dmSent = await user.send({ embeds: [dmEmbed] }).then(() => true).catch(() => false);

        const replyEmbed = successEmbed('Guild Admin Added',
          `${user} has been designated as a **${role}** for this server.`
        );
        if (dmSent) {
          replyEmbed.addFields({ name: 'Web Credentials Sent', value: `Login credentials have been sent to ${user} via DM.`, inline: false });
        } else {
          replyEmbed.addFields({ name: '⚠️ DM Failed', value: `Could not DM ${user}. They may have DMs disabled. Their username is \`${user.username}\` and temporary password is \`${tempPass}\`. Share this securely.`, inline: false });
        }
        return interaction.reply({ embeds: [replyEmbed] });
      } else {
        // User already has a web account — just notify about new guild, don't reset password
        const dmEmbed = new EmbedBuilder()
          .setColor(Colors.Gold)
          .setTitle('🛡️ Guild Admin Added — New Server')
          .setDescription(`You have been granted **${role}** privileges in **${interaction.guild.name}**.`)
          .addFields(
            { name: 'Server', value: interaction.guild.name, inline: true },
            { name: 'Role', value: role, inline: true },
            { name: 'Existing Account', value: 'Your existing web account credentials remain unchanged.', inline: false },
            { name: 'Web UI Login', value: `🔗 ${vaultUrl}`, inline: false },
            { name: 'Username', value: `\`${existingWebUser.username}\``, inline: true },
          )
          .setFooter({ text: 'Use your existing password to log in.' })
          .setTimestamp();

        const dmSent = await user.send({ embeds: [dmEmbed] }).then(() => true).catch(() => false);

        const replyEmbed = successEmbed('Guild Admin Added',
          `${user} is now a **${role}** in this server. They already have a web account — no password reset needed.`
        );
        if (!dmSent) {
          replyEmbed.addFields({ name: '⚠️ DM Failed', value: `Could not DM ${user}. They may have DMs disabled. Their username is \`${user.username}\`.`, inline: false });
        }
        return interaction.reply({ embeds: [replyEmbed] });
      }
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      const wasAdmin = isGuildAdmin(guildId, user.id);
      if (!wasAdmin) {
        return interaction.reply({
          embeds: [errorEmbed('Not an Admin', `${user} is not an admin in this server.`)],
          ephemeral: true,
        });
      }
      removeGuildAdmin(guildId, user.id);
      return interaction.reply({
        embeds: [successEmbed('Guild Admin Removed', `${user} is no longer an admin in this server.`)],
      });
    }

    if (sub === 'list') {
      const admins = listGuildAdmins(guildId);
      if (admins.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('Guild Admins', 'No admins designated for this server. Use `/admin add` to designate one.')],
          ephemeral: true,
        });
      }
      const list = admins.map(a =>
        `<@${a.discord_id}> — ${a.role}${a.discord_username ? ` (${a.discord_username})` : ''}`
      ).join('\n');
      return interaction.reply({
        embeds: [infoEmbed(`Server Admins (${admins.length})`, list)],
      });
    }

    if (sub === 'link') {
      await interaction.deferReply();
      const characterId = parseInt(interaction.options.getString('character-id'), 10);
      if (isNaN(characterId)) {
        return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      }
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const result = linkCharacter(targetUser.id, characterId);
      if (result.error) {
        return interaction.reply({ embeds: [errorEmbed('Link Failed', result.error)], ephemeral: true });
      }
      const character = getCharacter(characterId);
      writeCharacterNote(character).catch(() => {});

      // Send a flavorful resurrection embed to the linked user
      const soulEmoji = ['✨', '🌟', '💫', '🔮', '⚡', '🌙'][Math.floor(Math.random() * 6)];
      const realm = ['the Veil', 'the Shadowfell', 'the Astral Sea', 'the Ethereal Plane', 'the Void', 'a forgotten domain', 'the River of Souls'][Math.floor(Math.random() * 7)];
      const resurrection = ['resurrected', 'reborn', 'reclaimed', 'awakened', 'reforged', 'rekindled', 'restored to life', 'called back', 'pulled from the brink'][Math.floor(Math.random() * 9)];
      const fragment = [
        `A distant ${soulEmoji} flickers beyond ${realm} — then surges forward with impossible speed.`,
        `The fabric of reality ripples as a ${soulEmoji} pierces through ${realm}, seeking its vessel.`,
        `From the depths of ${realm}, a ${soulEmoji} rises — a soul remembered, now reclaimed.`,
        `The threads of fate twist and pull a ${soulEmoji} from ${realm}, weaving it back into the mortal coil.`,
        `A thunderous echo rolls across the planes as a ${soulEmoji} breaks free from ${realm}, drawn by destiny.`,
      ][Math.floor(Math.random() * 5)];

      const notifyEmbed = new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle(`${soulEmoji} Soul Bound — ${character?.name || 'Unknown'}`)
        .setDescription(
          `${fragment}\n\n` +
          `${targetUser} — Your soul has been **${resurrection}**!\n` +
          `You are now bound to **${character?.name || 'Unknown'}**, a **Level ${character?.level || '?'} ${character?.race || ''} ${character?.class || ''}**.`.trim()
        )
        .addFields(
          { name: '📜 Identity', value: `${character?.race || 'Unknown'} ${character?.class || 'Unknown'}`, inline: true },
          { name: '⚔️ Level', value: `${character?.level || '?'}`, inline: true },
          { name: '❤️ HP', value: `${character?.hp_current || '?'}/${character?.hp_max || '?'}`, inline: true },
          { name: '🛡️ AC', value: `${character?.armor_class || '?'}`, inline: true },
        )
        .setFooter({ text: 'May your journey be legendary.' })
        .setTimestamp();

      if (character?.image_url) notifyEmbed.setThumbnail(character.image_url);

      // Send embed to configured channel (fetch if not cached), or DM as fallback
      const embedChannelId = getGuildSetting(interaction.guildId, 'embed_channel');
      if (embedChannelId) {
        const cached = interaction.guild.channels.cache.get(embedChannelId);
        const channel = cached || await interaction.guild.channels.fetch(embedChannelId).catch(() => null);
        if (channel) {
          channel.send({ content: `${targetUser}`, embeds: [notifyEmbed] }).catch(() => {
            targetUser.send({ embeds: [notifyEmbed] }).catch(() => {});
          });
        } else {
          targetUser.send({ embeds: [notifyEmbed] }).catch(() => {});
        }
      } else {
        targetUser.send({ embeds: [notifyEmbed] }).catch(() => {});
      }

      return interaction.editReply({
        embeds: [successEmbed('Character Linked', `${soulEmoji} **${character?.name || 'Unknown'}** is now linked to ${targetUser}. A soul-binding ritual has been completed.`)],
      });
    }

    if (sub === 'unlink') {
      const characterId = parseInt(interaction.options.getString('character-id'), 10);
      if (isNaN(characterId)) {
        return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid character ID.')], ephemeral: true });
      }
      const result = unlinkCharacter(characterId);
      if (result.error) {
        return interaction.reply({ embeds: [errorEmbed('Unlink Failed', result.error)], ephemeral: true });
      }
      const character = getCharacter(characterId);
      writeCharacterNote(character).catch(() => {});
      return interaction.reply({
        embeds: [successEmbed('Character Unlinked', `<@${result.previousUser}> is no longer linked to character #${characterId}.`)],
      });
    }

    if (sub === 'whois') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const characters = getPlayerCharacters(targetUser.id);
      if (characters.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('No Characters', `${targetUser} has no linked characters.`)],
          ephemeral: true,
        });
      }
      const list = characters.map(c =>
        `**${c.name}** — Lvl ${c.level} ${c.race || ''} ${c.class || ''} (ID: \`${c.id}\`)${c.campaign_id ? ` — Campaign #${c.campaign_id}` : ''}`
      ).join('\n');
      return interaction.reply({
        embeds: [infoEmbed(`Characters — ${targetUser.username}`, list)],
      });
    }
  },
};
