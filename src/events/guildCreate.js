import { Events, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadAllCommands() {
  const commands = [];
  const commandsDir = join(__dirname, '..', 'commands');

  async function discoverFiles(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await discoverFiles(fullPath);
      } else if (entry.name.endsWith('.js') && entry.name !== 'deploy.js') {
        try {
          const cmd = await import(`file:///${fullPath.replace(/\\/g, '/')}`);
          if (cmd.default?.data) commands.push(cmd.default.data.toJSON());
        } catch {}
      }
    }
  }
  await discoverFiles(commandsDir);
  return commands;
}

export default {
  name: Events.GuildCreate,
  async execute(guild) {
    console.log(chalk.blue(`[guild] Joined "${guild.name}" (${guild.id}) — registering commands...`));
    try {
      const rest = new REST({ version: '10' }).setToken(config.discord.token);
      const commands = await loadAllCommands();
      await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guild.id), { body: commands });
      console.log(chalk.green(`[guild] Registered ${commands.length} commands for "${guild.name}"`));
    } catch (err) {
      console.error(chalk.red(`[guild] Failed to register commands for "${guild.name}": ${err.message}`));
    }
  },
};
