import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds.js';
import { getModule, listModules, deleteModule, startAdventure, getSession, getActiveSessions, getCurrentScene, goToScene, renderSceneText, processChoice, endAdventure, setVariable } from '../services/adventure.js';
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
      const campaignId = parseInt(interaction.options.getString('campaign-id'));
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
      const moduleId = parseInt(interaction.options.getString('module-id'));
      const campaignId = parseInt(interaction.options.getString('campaign-id'));

      if (isNaN(moduleId) || isNaN(campaignId)) {
        return interaction.reply({ embeds: [errorEmbed('Invalid ID', 'Both module ID and campaign ID are required.')], ephemeral: true });
      }

      const mod = getModule(moduleId);
      if (!mod) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Module not found.')], ephemeral: true });

      const campaign = getCampaign(campaignId);
      if (!campaign) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')], ephemeral: true });

      const existingSessions = getActiveSessions(campaignId).filter(s => s.module_id === moduleId);
      if (existingSessions.length > 0) {
        return interaction.reply({ embeds: [errorEmbed('Already Running', `This adventure is already active in this campaign (Session ID: \`${existingSessions[0].id}\`). Use \`/adventure scene\` to continue.`)], ephemeral: true });
      }

      const session = startAdventure(moduleId, campaignId, interaction.user.id);
      const scene = getCurrentScene(session.id);
      const rendered = renderSceneText(scene, session);

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${mod.title}`)
        .setColor(Colors.Green)
        .setDescription(mod.description || 'Adventure started!')
        .addFields(
          { name: 'Session ID', value: `\`${session.id}\``, inline: true },
          { name: 'Current Scene', value: rendered?.title || scene?.id || 'Unknown', inline: true },
        );

      if (rendered) {
        embed.addFields({ name: 'Narration', value: rendered.text.slice(0, 1000), inline: false });
        if (rendered.choices?.length > 0) {
          const choices = rendered.choices.map((c, i) => `**${i + 1}.** ${c.label || c.text}`).join('\n');
          embed.addFields({ name: 'Choices', value: choices, inline: false });
          embed.setFooter({ text: 'Use /adventure choose to make your choice' });
        }
        if (rendered.monsters?.length > 0) {
          embed.addFields({ name: 'Enemies', value: rendered.monsters.join(', '), inline: false });
        }
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'scene') {
      const sessionId = parseInt(interaction.options.getString('session-id'));
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
      const sessionId = parseInt(interaction.options.getString('session-id'));
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
      const sessionId = parseInt(interaction.options.getString('session-id'));
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
      const moduleId = parseInt(interaction.options.getString('module-id'));
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
      const sessionId = parseInt(interaction.options.getString('session-id'));
      if (isNaN(sessionId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });

      const session = getSession(sessionId);
      if (!session) return interaction.reply({ embeds: [errorEmbed('Not Found')], ephemeral: true });

      endAdventure(sessionId, 'completed');
      return interaction.reply({ embeds: [successEmbed('Adventure Ended', 'The adventure has been concluded.')] });
    }

    if (sub === 'delete') {
      const moduleId = parseInt(interaction.options.getString('module-id'));
      if (isNaN(moduleId)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });

      const mod = getModule(moduleId);
      if (!mod) return interaction.reply({ embeds: [errorEmbed('Not Found')], ephemeral: true });

      deleteModule(moduleId);
      return interaction.reply({ embeds: [successEmbed('Module Deleted', `**${mod.title}** has been deleted.`)] });
    }
  },
};
