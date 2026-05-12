import { SlashCommandBuilder, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds.js';
import { getModule, listModules, deleteModule, startAdventure, getSession, getActiveSessions, getCurrentScene, renderSceneText, processChoice, endAdventure, lobbyJoin, lobbyLeave, lobbySetReady, lobbyStart, setLobbyMessageId, getLobbyMessageId } from '../services/adventure.js';
import { getCampaign } from '../services/campaign.js';
import { getNarration } from '../services/narration.js';

export default {
  data: new SlashCommandBuilder()
    .setName('adventure')
    .setDescription('Run an adventure module with your party')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List adventure modules for a campaign')
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start running an adventure module')
        .addStringOption(opt =>
          opt.setName('module-id').setDescription('Adventure module ID').setRequired(true))
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('scene')
        .setDescription('View the current scene')
        .addStringOption(opt =>
          opt.setName('session-id').setDescription('Adventure session ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('choose')
        .setDescription('Make a choice in the adventure')
        .addStringOption(opt =>
          opt.setName('session-id').setDescription('Adventure session ID').setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('choice').setDescription('Choice number to pick').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Check adventure session status')
        .addStringOption(opt =>
          opt.setName('session-id').setDescription('Adventure session ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View module details')
        .addStringOption(opt =>
          opt.setName('module-id').setDescription('Module ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End an adventure session')
        .addStringOption(opt =>
          opt.setName('session-id').setDescription('Adventure session ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete an adventure module')
        .addStringOption(opt =>
          opt.setName('module-id').setDescription('Module ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);
      if (isNaN(campaignId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });

      const modules = listModules(campaignId);
      if (modules.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('No Modules', 'No adventure modules for this campaign. Import a campaign book with `/import pdf` first.')], ephemeral: true });
      }

      const activeSessions = getActiveSessions(campaignId);
      const activeModuleIds = new Set(activeSessions.map(s => s.module_id));

      const list = modules.map(m => {
        const hasActive = activeModuleIds.has(m.id);
        const scenes = m.scenes?.length || 0;
        const chapterCount = [...new Set((m.scenes || []).map(s => s.chapterTitle).filter(Boolean))].length;
        return `**${m.title}** (ID: \`${m.id}\`) — ${scenes} scenes — ${chapterCount > 0 ? `${chapterCount} chapters — ` : ''}${hasActive ? '🟢 Active' : '⚪ Inactive'}`;
      }).join('\n');

      return interaction.reply({ embeds: [infoEmbed('Adventure Modules', list)] });
    }

    if (sub === 'start') {
      const moduleId = parseInt(interaction.options.getString('module-id'), 10);
      const campaignId = parseInt(interaction.options.getString('campaign-id'), 10);

      if (isNaN(moduleId) || isNaN(campaignId)) {
        return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Both module ID and campaign ID are required.')], ephemeral: true });
      }

      const mod = getModule(moduleId);
      if (!mod) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Module not found.')], ephemeral: true });

      const campaign = getCampaign(campaignId);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });

      const session = startAdventure(moduleId, campaignId, interaction.user.id);

      // Show lobby embed
      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${mod.title}`)
        .setColor(Colors.Gold)
        .setDescription(mod.description || 'An adventure awaits!')
        .addFields(
          { name: '📖 Adventure', value: mod.title, inline: true },
          { name: '🎯 Levels', value: `${mod.min_level || 1} — ${mod.max_level || 20}`, inline: true },
          { name: '👥 Recommended Players', value: '3 — 6', inline: true },
          { name: '📜 Setting', value: mod.setting || 'Unknown', inline: true },
          { name: 'Session ID', value: `\`${session.id}\``, inline: false },
          { name: '👤 Players Joined', value: 'None yet. Click **Join** to sign up!', inline: false },
        )
        .setFooter({ text: 'DM can start once everyone is ready.' });

      const joinBtn = new ButtonBuilder()
        .setCustomId(`adventure_join:${session.id}`)
        .setLabel('Join Adventure')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⚔️');

      const leaveBtn = new ButtonBuilder()
        .setCustomId(`adventure_leave:${session.id}`)
        .setLabel('Leave')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🚪');

      const startBtn = new ButtonBuilder()
        .setCustomId(`adventure_start:${session.id}`)
        .setLabel('Start Adventure (DM)')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎬');

      const row1 = new ActionRowBuilder().addComponents(joinBtn, leaveBtn);
      const row2 = new ActionRowBuilder().addComponents(startBtn);

      const reply = await interaction.reply({ embeds: [embed], components: [row1, row2] });
      setLobbyMessageId(session.id, reply.id);

      // Update the lobby message with player info as they join — set up a collector for 5 minutes
      const filter = (i) => i.customId.startsWith(`adventure_`) && i.customId.endsWith(`:${session.id}`);
      const collector = reply.createMessageComponentCollector({ filter, time: 300000 });

      collector.on('collect', async (i) => {
        const [action] = i.customId.split(':');

        if (action === 'adventure_join') {
          // Get player's characters for selection
          const { getPlayerCharacters } = await import('../services/character.js');
          const chars = getPlayerCharacters(i.user.id);
          if (chars.length === 0) {
            return i.reply({ embeds: [errorEmbed('No Characters', 'You have no characters. Create one with `/character create` first.')], ephemeral: true });
          }

          const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = await import('discord.js');
          const select = new StringSelectMenuBuilder()
            .setCustomId(`adventure_pickchar:${session.id}`)
            .setPlaceholder('Choose your character...')
            .addOptions(chars.map(ch => new StringSelectMenuOptionBuilder()
              .setLabel(ch.name)
              .setDescription(`Lvl ${ch.level} ${ch.race || ''} ${ch.class || ''}`.trim())
              .setValue(`${ch.id}:${ch.name}`)
            ));
          return i.reply({ content: 'Select a character for this adventure:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
        }

        if (action === 'adventure_leave') {
          lobbyLeave(session.id, i.user.id);
          const updated = getSession(session.id);
          const players = Object.values(updated?.playerStates || {});
          const playerText = players.length ? players.map(p => `<@${p.discordId}> — ${p.characterName || 'Unknown'}`).join('\n') : 'None yet. Click **Join** to sign up!';
          embed.spliceFields(2, 1, { name: '👤 Players Joined', value: playerText, inline: false });
          await i.update({ embeds: [embed], components: [row1, row2] });
          return;
        }

        if (action === 'adventure_start') {
          if (i.user.id !== session.dm_discord_id) {
            const { isGuildAdmin } = await import('../services/guildAdmin.js');
            const campaign = await (await import('../services/campaign.js')).getCampaign(session.campaign_id);
            const guildAdmin = campaign?.guild_id ? isGuildAdmin(campaign.guild_id, i.user.id) : false;
            if (!guildAdmin) {
              return i.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM or a guild admin can start the adventure.')], ephemeral: true });
            }
          }
          const result = lobbyStart(session.id, i.user.id);
          if (result.error) return i.reply({ embeds: [errorEmbed('Error', result.error)], ephemeral: true });

          // Start the adventure — show first scene
          const sceneEmbed = new EmbedBuilder()
            .setTitle(`🎬 ${mod.title} — Adventure Begins!`)
            .setColor(Colors.Green)
            .setDescription(result.scene?.text?.slice(0, 2000) || 'The adventure begins!');

          if (result.scene) {
            if (result.scene.title) sceneEmbed.addFields({ name: 'Scene', value: result.scene.title, inline: true });
            if (result.scene.choices?.length > 0) {
              const choices = result.scene.choices.map((c, i) => `**${i + 1}.** ${c.label || c.text}`).join('\n');
              sceneEmbed.addFields({ name: 'Choices', value: choices, inline: false });
            }
            if (result.scene.monsters?.length > 0) {
              sceneEmbed.addFields({ name: '⚔️ Enemies', value: result.scene.monsters.join(', '), inline: false });
            }
          }
          sceneEmbed.setFooter({ text: `Session ID: ${session.id} | Use /adventure choose` });

          await i.update({ embeds: [sceneEmbed], components: [] });
          collector.stop();
        }
      });

      collector.on('end', () => {
        // Disable buttons after timeout
        const disabledRow1 = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(joinBtn).setDisabled(true),
          ButtonBuilder.from(leaveBtn).setDisabled(true),
        );
        const disabledRow2 = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(startBtn).setDisabled(true),
        );
        reply.edit({ components: [disabledRow1, disabledRow2] }).catch(() => {});
      });
    }

    if (sub === 'scene') {
      const sessionId = parseInt(interaction.options.getString('session-id'), 10);
      if (isNaN(sessionId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });

      const session = getSession(sessionId);
      if (!session) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Session not found.')], ephemeral: true });

      const scene = getCurrentScene(sessionId);
      const rendered = renderSceneText(scene, session);

      const embed = new EmbedBuilder()
        .setTitle(rendered?.title || 'Current Scene')
        .setColor(Colors.Blurple);

      if (rendered) {
        embed.setDescription(rendered.text.slice(0, 2000));
        if (rendered.choices?.length > 0) {
          const choices = rendered.choices.map((c, i) => `**${i + 1}.** ${c.label || c.text}`).join('\n');
          embed.addFields({ name: 'Choices', value: choices, inline: false });
        }
        if (rendered.monsters?.length > 0) {
          embed.addFields({ name: 'Enemies', value: rendered.monsters.join(', '), inline: true });
        }
        if (rendered.environment) {
          embed.addFields({ name: 'Environment', value: rendered.environment, inline: true });
        }
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'choose') {
      const sessionId = parseInt(interaction.options.getString('session-id'), 10);
      const choiceNum = interaction.options.getInteger('choice');

      if (isNaN(sessionId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });

      const session = getSession(sessionId);
      if (!session) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Session not found.')], ephemeral: true });

      const mod = getModule(session.module_id);
      const scene = getCurrentScene(sessionId);
      const rendered = renderSceneText(scene, session);

      if (!rendered?.choices || choiceNum < 1 || choiceNum > rendered.choices.length) {
        return interaction.reply({ embeds: [errorEmbed('Invalid Choice', `Pick 1-${rendered?.choices?.length || 0}.`)], ephemeral: true });
      }

      const choice = rendered.choices[choiceNum - 1];
      const result = processChoice(sessionId, choice.id);

      if (result.error) {
        return interaction.reply({ embeds: [infoEmbed('Choice Result', result.error)], ephemeral: false });
      }

      if (result.nextScene) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setDescription(`**${result.choice}**`);

        if (result.nextScene.text) {
          embed.addFields({ name: result.nextScene.title || 'Continuing...', value: result.nextScene.text.slice(0, 1500), inline: false });
        }

        if (result.nextScene.choices?.length > 0) {
          const choices = result.nextScene.choices.map((c, i) => `**${i + 1}.** ${c.label || c.text}`).join('\n');
          embed.addFields({ name: 'Choices', value: choices, inline: false });
        }

        if (result.nextScene.monsters?.length > 0) {
          embed.addFields({ name: '⚔️ Combat!', value: `Enemies: ${result.nextScene.monsters.join(', ')}`, inline: false });
          embed.setFooter({ text: 'Use /encounter create to run this combat' });
        }

        return interaction.reply({ embeds: [embed] });
      }

      return interaction.reply({ embeds: [successEmbed(result.choice, 'Choice recorded.')] });
    }

    if (sub === 'status') {
      const sessionId = parseInt(interaction.options.getString('session-id'), 10);
      if (isNaN(sessionId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });

      const session = getSession(sessionId);
      if (!session) return interaction.reply({ embeds: [errorEmbed('Not Found')], ephemeral: true });

      const mod = getModule(session.module_id);
      const scene = getCurrentScene(sessionId);

      const embed = infoEmbed('Adventure Status', `**${mod?.title || 'Unknown'}** — ${session.state}`);
      embed.addFields(
        { name: 'Session ID', value: `\`${session.id}\``, inline: true },
        { name: 'State', value: session.state, inline: true },
        { name: 'Current Scene', value: scene?.title || scene?.id || 'None', inline: true },
        { name: 'Steps Taken', value: `${session.history?.length || 0}`, inline: true },
        { name: 'Variables', value: Object.keys(session.variables || {}).length > 0 ? Object.entries(session.variables).slice(0, 5).map(([k, v]) => `\`${k}\`: ${JSON.stringify(v)}`).join('\n') : 'None', inline: false },
      );

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'info') {
      const moduleId = parseInt(interaction.options.getString('module-id'), 10);
      if (isNaN(moduleId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });

      const mod = getModule(moduleId);
      if (!mod) return interaction.reply({ embeds: [errorEmbed('Not Found')], ephemeral: true });

      const sceneTypes = {};
      for (const s of (mod.scenes || [])) {
        sceneTypes[s.type || 'narrative'] = (sceneTypes[s.type || 'narrative'] || 0) + 1;
      }
      const typeSummary = Object.entries(sceneTypes).map(([k, v]) => `${k}: ${v}`).join(', ');

      const npcCount = mod.variables?.npcs?.length || 0;
      const monsterCount = mod.variables?.monsters?.length || 0;

      const embed = infoEmbed(`📖 ${mod.title}`, mod.description || '');
      embed.addFields(
        { name: 'Module ID', value: `\`${mod.id}\``, inline: true },
        { name: 'Scenes', value: `${mod.scenes?.length || 0}`, inline: true },
        { name: 'Scene Types', value: typeSummary || 'N/A', inline: false },
        { name: 'NPCs', value: `${npcCount}`, inline: true },
        { name: 'Monsters', value: `${monsterCount}`, inline: true },
        { name: 'Level Range', value: `${mod.min_level || 1}-${mod.max_level || 20}`, inline: true },
      );

      if (mod.scenes?.length > 0) {
        const firstScenes = mod.scenes.slice(0, 5).map(s => `• ${s.title || s.id}${s.type ? ` (${s.type})` : ''}`).join('\n');
        embed.addFields({ name: 'First Scenes', value: firstScenes + (mod.scenes.length > 5 ? `\n*+${mod.scenes.length - 5} more*` : ''), inline: false });
      }

      if (npcCount > 0) {
        const npcList = mod.variables.npcs.slice(0, 5).map(n => `• ${n.name}${n.role ? ` — ${n.role}` : ''}`).join('\n');
        embed.addFields({ name: 'Notable NPCs', value: npcList + (npcCount > 5 ? `\n*+${npcCount - 5} more*` : ''), inline: false });
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'end') {
      const sessionId = parseInt(interaction.options.getString('session-id'), 10);
      if (isNaN(sessionId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });

      const session = getSession(sessionId);
      if (!session) return interaction.reply({ embeds: [errorEmbed('Not Found')], ephemeral: true });

      const mod = getModule(session.module_id);
      if (mod?.campaign_id) {
        const campaign = getCampaign(mod.campaign_id);
        if (campaign && campaign.dm_discord_id !== interaction.user.id) {
          return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can end this adventure.')], ephemeral: true });
        }
      }

      endAdventure(sessionId, 'completed');
      return interaction.reply({ embeds: [successEmbed('Adventure Ended', 'The adventure has been concluded.')] });
    }

    if (sub === 'delete') {
      const moduleId = parseInt(interaction.options.getString('module-id'), 10);
      if (isNaN(moduleId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });

      const mod = getModule(moduleId);
      if (!mod) return interaction.reply({ embeds: [errorEmbed('Not Found')], ephemeral: true });

      if (mod.campaign_id) {
        const campaign = getCampaign(mod.campaign_id);
        if (campaign && campaign.dm_discord_id !== interaction.user.id) {
          return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only the DM can delete this module.')], ephemeral: true });
        }
      }

      deleteModule(moduleId);
      return interaction.reply({ embeds: [successEmbed('Module Deleted', `**${mod.title}** has been deleted.`)] });
    }
  },
};
