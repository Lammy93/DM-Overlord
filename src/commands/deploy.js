import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadAllCommands() {
  const commands = [];
  const commandsDir = __dirname;

  async function discoverFiles(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await discoverFiles(fullPath);
      } else if (entry.name.endsWith('.js') && entry.name !== 'deploy.js') {
        try {
          const cmd = await import(`file:///${fullPath.replace(/\\/g, '/')}`);
          if (cmd.default?.data) {
            commands.push(cmd.default.data.toJSON());
          }
        } catch (err) {
          console.error(`Error loading ${entry.name}:`, err.message);
        }
      }
    }
  }

  await discoverFiles(commandsDir);
  return commands;
}

async function deploy() {
  const commands = await loadAllCommands();
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    console.log(`Deploying ${commands.length} commands...`);
    let data;
    if (config.discord.guildId) {
      data = await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commands }
      );
    } else {
      data = await rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commands }
      );
    }
    console.log(`Registered ${data.length} commands.`);
  } catch (error) {
    console.error('Failed to deploy commands:', error);
  }
}

deploy();
