import { EmbedBuilder, Colors } from 'discord.js';
import client from '../client.js';
import { getCampaign } from './campaign.js';

export async function postToCampaignChannel(campaignId, embedOrContent) {
  try {
    const campaign = getCampaign(campaignId);
    if (!campaign?.channel_id) return;
    const channel = await client.channels.fetch(campaign.channel_id);
    if (!channel) return;
    if (typeof embedOrContent === 'string') {
      await channel.send(embedOrContent);
    } else {
      await channel.send({ embeds: [embedOrContent] });
    }
  } catch (e) {
    console.error('Discord log error:', e.message);
  }
}

export function storyEmbed(title, description, color = Colors.Gold) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: '📖 Story' });
}

export function narrationEmbed(text, sceneTitle = null) {
  const embed = new EmbedBuilder()
    .setDescription(text)
    .setColor(Colors.DarkPurple)
    .setFooter({ text: '🎭 Narration' });
  if (sceneTitle) embed.setTitle(sceneTitle);
  return embed;
}

export function characterSpeechEmbed(characterName, text, imageUrl = null) {
  const embed = new EmbedBuilder()
    .setDescription(`*"${text}"*`)
    .setColor(Colors.Blurple)
    .setAuthor({ name: characterName, iconURL: imageUrl || undefined })
    .setFooter({ text: '💬 Conversation' });
  return embed;
}

export function dmNoteEmbed(content) {
  return new EmbedBuilder()
    .setTitle('📝 DM Note')
    .setDescription(content)
    .setColor(Colors.DarkRed)
    .setFooter({ text: 'DM Only' });
}

export async function logChoiceToDiscord(campaignId, characterName, choiceText, sceneTitle) {
  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`🎯 Choice Made`)
    .setDescription(`**${characterName}** chose: *${choiceText}*`)
    .setFooter({ text: sceneTitle || 'Adventure' });
  await postToCampaignChannel(campaignId, embed);
}

export async function logSceneTransition(campaignId, sceneTitle, sceneText) {
  const embed = narrationEmbed(sceneText, sceneTitle);
  await postToCampaignChannel(campaignId, embed);
}

export async function logCombatSummary(campaignId, encounterName, summary) {
  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Combat: ${encounterName}`)
    .setDescription(summary)
    .setColor(Colors.Red)
    .setFooter({ text: 'Combat Log' });
  await postToCampaignChannel(campaignId, embed);
}
