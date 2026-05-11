import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
  },
  obsidian: {
    vaultPath: process.env.OBSIDIAN_VAULT_PATH || join(homedir(), 'obsidian-vault'),
    subfolder: process.env.OBSIDIAN_SUBFOLDER || 'DM-Overlord',
    apiPort: parseInt(process.env.OBSIDIAN_API_PORT || '27123', 10),
    apiToken: process.env.OBSIDIAN_API_TOKEN || '',
  },
  database: {
    path: process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'dm-overlord.db'),
  },
  narration: {
    style: process.env.NARRATION_STYLE || 'descriptive',
  },
  paths: {
    data: join(__dirname, 'data'),
    templates: join(__dirname, 'data', 'templates'),
  },
};
