import chalk from 'chalk';
import { getDb } from '../db/index.js';
import { writeCharacterNote } from '../services/obsidian.js';
import { getCharacter } from '../services/character.js';
import config from '../config.js';

async function checkMemberViaRest(guildId, userId) {
  if (!config.discord.token) return null;
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${config.discord.token}` },
    });
    if (res.ok) return true;
    if (res.status === 404) return false;
    return null; // other error, skip
  } catch {
    return null;
  }
}

export async function checkPlayerMembership(client) {
  console.log(chalk.blue('[membership] Checking player guild membership...'));
  const db = getDb();

  const campaigns = db.prepare('SELECT id, name, guild_id FROM campaigns WHERE guild_id IS NOT NULL').all();
  if (campaigns.length === 0) {
    console.log(chalk.gray('[membership] No guild-linked campaigns found, skipping.'));
    return;
  }

  let totalUnlinked = 0;

  for (const campaign of campaigns) {
    const guild = client.guilds.cache.get(campaign.guild_id);
    if (!guild) {
      console.log(chalk.yellow(`[membership] Bot is not in guild ${campaign.guild_id}, skipping campaign #${campaign.id} "${campaign.name}"`));
      continue;
    }

    const characters = db.prepare("SELECT id, name, player_discord_id FROM characters WHERE campaign_id = ? AND player_discord_id IS NOT NULL AND player_discord_id != ''").all(campaign.id);
    if (characters.length === 0) continue;

    for (const character of characters) {
      let stillInGuild = false;
      const result = await checkMemberViaRest(campaign.guild_id, character.player_discord_id);
      if (result === true) {
        stillInGuild = true;
      } else if (result === false) {
        stillInGuild = false;
      } else {
        // REST check failed (e.g., bot lacks permissions) — skip this character
        console.log(chalk.gray(`[membership] Could not verify membership for ${character.player_discord_id} in "${guild.name}", skipping.`));
        continue;
      }

      if (!stillInGuild) {
        console.log(chalk.yellow(`[membership] Player ${character.player_discord_id} not found in guild "${guild.name}" — unlinking character "${character.name}" (ID: ${character.id})`));
        db.prepare("UPDATE characters SET player_discord_id = '' WHERE id = ?").run(character.id);
        const updated = getCharacter(character.id);
        writeCharacterNote(updated).catch(() => {});
        totalUnlinked++;
      }
    }
  }

  if (totalUnlinked > 0) {
    console.log(chalk.blue(`[membership] Unlinked ${totalUnlinked} character(s) whose players left their guilds.`));
  } else {
    console.log(chalk.green('[membership] All linked characters still have valid guild membership.'));
  }
}
