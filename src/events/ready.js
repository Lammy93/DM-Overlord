import { Events, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { checkPlayerMembership } from '../init/checkPlayerMembership.js';
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
      if (entry.isDirectory()) { await discoverFiles(fullPath); }
      else if (entry.name.endsWith('.js') && entry.name !== 'deploy.js') {
        try { const cmd = await import(`file:///${fullPath.replace(/\\/g, '/')}`); if (cmd.default?.data) commands.push(cmd.default.data.toJSON()); } catch {}
      }
    }
  }
  await discoverFiles(commandsDir);
  return commands;
}

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(chalk.green.bold('╔══════════════════════════════════╗'));
    console.log(chalk.green.bold('║       DM-Overlord Online         ║'));
    console.log(chalk.green.bold('╚══════════════════════════════════╝'));
    console.log(chalk.cyan(`Logged in as ${chalk.bold(client.user.tag)}`));
    console.log(chalk.cyan(`Serving ${chalk.bold(client.guilds.cache.size)} guilds`));
    console.log(chalk.cyan(`Commands: ${chalk.bold(client.commands.size)} loaded`));
    client.user.setActivity('Dungeons & Dragons', { type: 3 });

    // Sync commands to all guilds the bot is already in (handles joins while offline)
    setTimeout(async () => {
      try {
        const rest = new REST({ version: '10' }).setToken(config.discord.token);
        const commands = await loadAllCommands();
        for (const guild of client.guilds.cache.values()) {
          try {
            await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guild.id), { body: commands });
            console.log(chalk.gray(`[cmds] Registered for "${guild.name}" (${guild.id})`));
          } catch (e) {
            console.log(chalk.yellow(`[cmds] Failed for "${guild.name}": ${e.message}`));
          }
        }
        console.log(chalk.cyan(`[cmds] Commands synced to ${client.guilds.cache.size} guilds`));
      } catch (err) {
        console.error(chalk.red(`[cmds] Sync error: ${err.message}`));
      }
    }, 3000);

    // Run membership check after a delay to let guild caches populate
    setTimeout(() => {
      checkPlayerMembership(client).catch(err => {
        console.error(chalk.red('[membership] Error during membership check:'), err.message);
      });
    }, 8000);
  },
};
