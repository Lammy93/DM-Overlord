import 'dotenv/config';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import client from './client.js';
import config from './config.js';
import { startWebServer } from './web/server.js';
import { seedBaseContent } from './init/seedBaseContent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load event handlers
const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  const { default: event } = await import(`file:///${join(eventsPath, file).replace(/\\/g, '/')}`);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(chalk.gray(`Loaded event: ${event.name}`));
}

// Load commands from directories and flat files
async function loadCommandsFromDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = readdirSync(fullPath).filter(f => f.endsWith('.js'));
      for (const file of subFiles) {
        const { default: cmd } = await import(`file:///${join(fullPath, file).replace(/\\/g, '/')}`);
        if (cmd?.data) {
          client.commands.set(cmd.data.name, cmd);
          console.log(chalk.gray(`Loaded command: /${cmd.data.name}`));
        }
      }
    } else if (entry.name.endsWith('.js')) {
      const { default: cmd } = await import(`file:///${fullPath.replace(/\\/g, '/')}`);
      if (cmd?.data) {
        client.commands.set(cmd.data.name, cmd);
        console.log(chalk.gray(`Loaded command: /${cmd.data.name}`));
      }
    }
  }
}

await loadCommandsFromDir(join(__dirname, 'commands'));

// Login
if (!config.discord.token) {
  console.error(chalk.red('FATAL: DISCORD_TOKEN is not set in .env'));
  process.exit(1);
}

client.login(config.discord.token);

seedBaseContent().catch(err => console.error(chalk.red('Failed to seed base content:'), err));

startWebServer().catch(err => console.error(chalk.red('Failed to start web server:'), err));
