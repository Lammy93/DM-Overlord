# DM-Overlord

A Discord bot and web dashboard for **AI-powered Dungeon Mastering** — import campaign PDFs, run adventures with your party, track characters and combat, sync to Obsidian, and manage everything from a D&D-themed web UI.

## Features

- **Web Dashboard** — D&D parchment-themed SPA with full character sheets, dice roller, map viewer with fog of war, adventure runner, combat tracker, SRD browser (500 monsters/spells/items), activity feed, and file browser
- **Dice Roller** — 3D animated SVG dice (d4 through d100) with modifiers and quick presets
- **Campaign Management** — multi-server campaigns with session logging, notes, and library view
- **Character System** — full D&D 5e sheets, Roll20 JSON import, auto HP/AC calculation, character portraits
- **Adventure Engine** — scene-by-scene with branching choices, skill checks, and lobby system for player joining
- **Combat Tracker** — turn-based with initiative, HP bars, conditions, and custom combatants
- **Map System** — upload maps, pan/zoom, grid overlay, fog of war reveal/hide, map pins
- **Obsidian Sync** — auto-syncs characters, campaigns, sessions, encounters, and locations to your vault
- **Player & Admin Management** — role-based access, guild-scoped admins, player accounts with DM delivery of credentials
- **Guild Isolation** — data separated by Discord server, with guild selector in the web UI

## Quick Start (Docker)

### Prerequisites
- **Docker Compose** v2 or later installed on your system
- A **Discord Application** from https://discord.com/developers/applications
  - Click **New Application** → name it
  - Go to **Bot** tab → **Create Bot** → copy **Token** and **Client ID**
  - Enable **Message Content Intent** under Privileged Gateway Intents
  - Go to **OAuth2** → **URL Generator** → check `bot` + `applications.commands` → open the URL to add the bot to your server
- (Optional) An **OpenAI API key** if you want to use PDF import

### Option 1: Pull from GitHub Container Registry (Recommended)

```bash
git clone https://github.com/Lammy93/DM-Overlord.git
cd DM-Overlord
cp .env.example .env
```

Edit `.env` and set at minimum:
```
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
```

Then start the bot:
```bash
docker compose up -d
```

This pulls the pre-built image from `ghcr.io/lammy93/dm-overlord:latest`, starts the container, and launches both the Discord bot and the web UI.

### Option 2: Build Locally

If you prefer to build the image from source instead of pulling:

```bash
# Edit docker-compose.yml: comment out "image:" and uncomment "build: ."
# Then run:
docker compose up -d --build
```

### Verify It's Running

```bash
docker compose logs dm-overlord
```

You should see `DM-Overlord Online` and the bot's username. The web UI is at `http://localhost:3000`.

## Default Login

Open the web UI and click the **Admin** tab:

| Field | Value |
|-------|-------|
| Username | `Overlord` |
| Password | `DM` |

You'll be prompted to change your password on first login. Create additional admin accounts in Discord with `/admin add @User` — credentials are sent via DM.

## Discord Commands

### Admin & Player Management
| Command | Description |
|---------|-------------|
| `/admin add <user> [role]` | Designate a guild admin (sends DM with web login credentials) |
| `/admin remove <user>` | Remove guild admin |
| `/admin list` | List guild admins |
| `/admin link <character-id> [user]` | Link a character to a Discord user |
| `/admin unlink <character-id>` | Unlink a character |
| `/admin whois [user]` | Show characters linked to a user |
| `/player create <username> <password> [discord-user]` | Create a web UI player account |
| `/player list` | List all player accounts |
| `/player remove <id>` | Deactivate a player account |
| `/player reset-password <id> <new-password>` | Reset a player's password |
| `/settings embed-channel #channel` | Set a channel for embed notifications |
| `/settings view` | View current server settings |

### Adventures
| Command | Description |
|---------|-------------|
| `/adventure start <module-id> <campaign-id>` | Start an adventure (creates a lobby with join buttons) |
| `/adventure scene <session-id>` | View the current scene |
| `/adventure choose <session-id> <choice>` | Make a numbered choice |
| `/adventure list <campaign-id>` | List adventure modules |
| `/adventure status <session-id>` | Check session state |
| `/adventure end <session-id>` | End an adventure |

### Characters
| Command | Description |
|---------|-------------|
| `/character create` | Interactive character creation wizard |
| `/character list` | List your characters |
| `/character view <id>` | View a full character sheet |
| `/character update <id>` | Update HP, AC, stats, etc. |
| `/character damage <id> <amount>` | Apply damage |
| `/character heal <id> <amount>` | Restore HP |
| `/character xp <id> <amount>` | Add XP |
| `/character levelup <id>` | Level up |
| `/character select <id>` | Set active character for roll logging |

### Campaigns
| Command | Description |
|---------|-------------|
| `/campaign create` | Create a new campaign |
| `/campaign list` | List your campaigns (all guilds) |
| `/campaign info <id>` | View campaign details |
| `/campaign add-player` | Invite a player |
| `/campaign remove-player` | Remove a player |
| `/campaign session` | Log a session |
| `/campaign note` | Add a campaign note |

### Encounters
| Command | Description |
|---------|-------------|
| `/encounter create` | Create a combat encounter |
| `/encounter list <campaign-id>` | List encounters |
| `/encounter view <id>` | View encounter status |
| `/encounter add-monster <encounter-id> <monster>` | Add SRD monsters |
| `/encounter start <id>` | Begin combat |
| `/encounter next <id>` | Next turn |
| `/encounter damage <combatant-id> <amount>` | Damage a combatant |
| `/encounter end <id>` | End the encounter |

### Other
| Command | Description |
|---------|-------------|
| `/roll <formula>` | Roll dice (optional: advantage, disadvantage, reason, hidden) |
| `/import pdf` | Import a campaign PDF (AI parses chapters, NPCs, items) |
| `/srd monster <name>` | Look up a monster |
| `/srd spell <name>` | Look up a spell |
| `/srd item <name>` | Look up a magic item |
| `/obsidian sync-character <id>` | Sync character to Obsidian vault |
| `/obsidian sync-campaign <id>` | Sync campaign to vault |

## Web UI Pages

| Page | Who Can Access | What It Does |
|------|----------------|--------------|
| **Dashboard** | Admin | Overview stats and recent campaigns |
| **Campaigns** | Admin | Manage campaigns with library/guild toggle |
| **Characters** | Admin | Character grid with portraits, search |
| **Character Manager** | Admin | Link/unlink characters, import from JSON |
| **Dice Roller** | Everyone | 3D dice with presets and modifier |
| **Adventures** | Admin | Browse modules, explore scenes |
| **Encounters** | Admin | Combat tracker with turn order |
| **Maps** | Everyone | View campaign maps with fog of war |
| **SRD Browser** | Admin | Browse monsters, spells, items |
| **Activity** | Admin | Live event log |
| **Player Roles** | Admin | Manage per-campaign player roles |
| **Settings** | Admin | Configure embed channel |
| **File Browser** | Admin | Upload and browse files |
| **My Characters** | Player | View your linked characters |
| **My Settings** | Player | Change your password |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | - | Your Discord bot token |
| `CLIENT_ID` | Yes | - | Your Discord application ID |
| `OPENAI_API_KEY` | No | - | Needed for `/import pdf` AI parsing |
| `WEB_PORT` | No | `3000` | Web UI port |
| `WEB_HOST` | No | `localhost` | Set to `0.0.0.0` for Docker |
| `WEB_BASE_URL` | No | `http://localhost:3000` | Public URL for Discord map links |
| `OBSIDIAN_VAULT_PATH` | No | - | Absolute path to your Obsidian vault |
| `WEB_DM_PASSWORD` | No | `overlord` | Legacy admin password fallback |

## License

MIT
