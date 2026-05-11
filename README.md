# DM-Overlord

A Discord bot that serves as your **Dungeon Master assistant** for running D&D 5e (2014 & 2024) campaigns. Features campaign management, character sheets, encounter/combat tracking, dice rolling, SRD content lookup, and **Obsidian vault integration** for session logging.

## Features

### Dice Rolling
- Standard notation (`1d20`, `2d6+3`)
- Advantage/disadvantage on d20 rolls
- Hidden rolls (DM-only)

### Campaign Management
- Create and manage multiple campaigns
- Player invites with roles (player, co-dm, observer)
- Session logging with summaries, highlights, and loot
- Campaign notes with categories

### Character Sheets
- Create characters with race, class, stats, and more
- Track HP, AC, XP, inventory, and currency
- Damage/heal tracking
- Level up with XP tracking

### Encounter Builder & Combat Tracker
- Build encounters from SRD monster database
- Custom combatants (homebrew monsters, NPCs, allies)
- Full combat tracker with turn order
- HP tracking, conditions, auto-initiative
- DM narration flavor text for hits, crits, kills

### SRD Content Database
- **Monsters**: 20+ SRD monsters with full stats, actions, and traits
- **Spells**: 25+ SRD spells with descriptions, components, and class lists
- **Items**: Armor, weapons, magic items, potions
- **Classes & Races**: Full SRD class and race data with subraces

### Obsidian Vault Integration
- Sync campaigns, characters, sessions, and encounters directly to your Obsidian vault
- Auto-generated Markdown notes with proper formatting
- Organized folder structure: `Campaigns/`, `Characters/`, `Sessions/`, `Encounters/`
- Obsidian plugin available for advanced integration

## Commands

| Command | Description |
|---------|-------------|
| `/roll <formula>` | Roll dice (optional: advantage, disadvantage, reason, hidden) |
| `/campaign create` | Create a new campaign |
| `/campaign list` | List your campaigns |
| `/campaign info <id>` | View campaign details |
| `/campaign add-player` | Invite a player to your campaign |
| `/campaign session` | Log a new session |
| `/character create` | Create a new character |
| `/character list` | List your characters |
| `/character view <id>` | View a character sheet |
| `/character damage/heal` | Track HP changes |
| `/character levelup` | Level up your character |
| `/encounter create` | Create a combat encounter |
| `/encounter add-monster` | Add SRD monsters to an encounter |
| `/encounter start` | Begin combat |
| `/encounter next` | Advance to next turn |
| `/encounter damage` | Damage a combatant |
| `/srd monster <name>` | Look up a monster from SRD |
| `/srd spell <name>` | Look up a spell |
| `/srd item <name>` | Look up an item |
| `/obsidian status` | Check Obsidian vault connection |
| `/obsidian sync-campaign` | Sync campaign to vault |
| `/obsidian sync-character` | Sync character sheet to vault |

## Quick Start (Docker — Recommended)

### Prerequisites
- Docker (Docker Desktop on Windows/Mac, or Unraid's built-in Docker)
- A Discord Application from https://discord.com/developers/applications

### Discord Bot Setup
1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name
3. Go to **Bot** tab → **Create Bot**
4. Copy the **Token** and **Client ID**
5. Enable **Message Content Intent** under Privileged Gateway Intents
6. Go to **OAuth2** → **URL Generator** → select `bot` + `applications.commands` → copy the generated URL and open it in your browser to add the bot to your server

### Option A: Run with docker-compose (easiest)

```bash
git clone https://github.com/Lammy93/DM-Overlord.git
cd DM-Overlord

# Create env file with your tokens
cp .env.example .env
# Edit .env — set DISCORD_TOKEN, CLIENT_ID, GUILD_ID

# Start the bot
docker compose up -d
```

### Option B: Run with docker run

```bash
docker run -d --name dm-overlord --restart unless-stopped \
  -e DISCORD_TOKEN=your_token \
  -e CLIENT_ID=your_client_id \
  -e GUILD_ID=your_server_id \
  -v $(pwd)/data:/app/data \
  ghcr.io/lammy93/dm-overlord:latest
```

### Register Slash Commands

After starting, run this once so Discord knows about the commands:

```bash
docker exec dm-overlord node src/commands/deploy.js
```

Your bot should now respond to `/roll 1d20`, `/campaign create`, etc.

## Quick Start (Local — Node.js)

```bash
git clone https://github.com/Lammy93/DM-Overlord.git
cd DM-Overlord

cp .env.example .env
# Edit .env — set DISCORD_TOKEN, CLIENT_ID, GUILD_ID

npm install
npm run deploy
npm start
```

## Unraid Setup

### Via Docker Compose (recommended for Unraid)

1. Install the **Compose Manager** plugin from Unraid's Community Apps
2. Create a new stack and paste the contents of `docker-compose.unraid.yml` from the repo
3. Set your environment variables (DISCORD_TOKEN, CLIENT_ID, GUILD_ID)
4. Click **Compose Up**

The bot will pull `ghcr.io/lammy93/dm-overlord:latest` automatically.

### Via Docker UI

1. **Docker** tab → **Add Container**
2. Repository: `ghcr.io/lammy93/dm-overlord:latest`
3. Add variables:

| Key | Value |
|-----|-------|
| `DISCORD_TOKEN` | Your bot token |
| `CLIENT_ID` | Your app client ID |
| `GUILD_ID` | Your Discord server ID |

4. Click **Apply**

## Obsidian Vault Integration

1. Create an `.env` file with your Obsidian vault path:

```env
OBSIDIAN_VAULT_PATH=/path/to/your/obsidian-vault
```

2. When using Docker, mount the vault as a volume:

```yaml
volumes:
  - /path/to/your/obsidian-vault:/vault:ro
```

3. Use `/obsidian status` in Discord to verify the connection
4. Use `/obsidian sync-campaign`, `/obsidian sync-character` etc. to write notes

The bot will auto-create a `DM-Overlord/` folder in your vault with subdirectories: `Campaigns/`, `Characters/`, `Sessions/`, `Encounters/`.

### Obsidian Plugin (Optional)

Copy the `obsidian-plugin/` folder into your vault's `.obsidian/plugins/` directory and enable it in Obsidian settings. Provides commands to create character templates and session notes directly from Obsidian.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | - | Discord bot token |
| `CLIENT_ID` | Yes | - | Discord application ID |
| `GUILD_ID` | No | - | Server ID for instant command registration |
| `OBSIDIAN_VAULT_PATH` | No | - | Absolute path to your Obsidian vault |
| `OBSIDIAN_SUBFOLDER` | No | `DM-Overlord` | Subfolder in vault for notes |
| `NARRATION_STYLE` | No | `descriptive` | descriptive, cinematic, minimal, or humorous |
| `LOG_LEVEL` | No | `info` | debug, info, warn, error |

## Updating

### Docker (docker-compose)
```bash
git pull
docker compose pull
docker compose up -d
```

### Docker (docker run)
```bash
docker pull ghcr.io/lammy93/dm-overlord:latest
docker stop dm-overlord
docker rm dm-overlord
# re-run the docker run command from above
```

### Local (Node.js)
```bash
git pull
npm install
node src/commands/deploy.js
npm start
```

## Project Structure

```
DM-Overlord/
├── src/
│   ├── index.js              # Entry point
│   ├── config.js             # Configuration
│   ├── client.js             # Discord client setup
│   ├── commands/             # Slash command definitions
│   │   ├── roll.js           # Dice rolling
│   │   ├── campaign/         # Campaign management
│   │   ├── character/        # Character sheets
│   │   ├── encounter/        # Combat encounters
│   │   ├── obsidian.js       # Obsidian vault sync
│   │   └── srd-cmd.js        # SRD content lookup
│   ├── events/               # Discord event handlers
│   ├── services/             # Business logic layer
│   ├── db/                   # SQLite database
│   ├── data/                 # SRD JSON data + templates
│   └── utils/                # Helpers (embeds, formatters)
├── obsidian-plugin/          # Obsidian vault plugin
├── docker-compose.yml        # Docker compose config
├── docker-compose.unraid.yml # Unraid-specific compose
├── Dockerfile                # Docker build
└── package.json
```

## License

MIT
