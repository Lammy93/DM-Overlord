# DM-Overlord

A Discord bot and web dashboard for **AI-powered Dungeon Mastering** — import campaign PDFs, run adventures with your party, track characters and combat, sync to Obsidian, and manage everything from a D&D-themed web UI.

## Features

### Web Dashboard
- **Full SPA** with D&D parchment theme, DragonHunter font, and SVG icon set
- **Player & Admin login** with username/password authentication (PBKDF2+SHA-512 hashed)
- **Default admin account**: `Overlord` / `DM` (seeded on first run)
- **Guild selector** — filter data by Discord server
- **Collapsible sidebar** sections with persistent state

### Dice Roller
- 3D animated dice with SVG icons (d4, d6, d8, d10, d12, d20, d100)
- Die selector with +/- counters, modifier input, quick-roll presets
- Auto-clear timer and clear button
- Roll results logged to activity feed

### Campaign Management
- Create and manage multiple campaigns across servers
- **Campaign Library** view — see all campaigns across all guilds
- Inline campaign rename
- Player invites with roles (player, co-dm, observer)
- Session logging with auto-capture

### Character System
- Full D&D 5e character sheet (ability scores, combat stats, skills, proficiencies, features, inventory, spells, personality, backstory)
- **Roll20 JSON import** — import characters from standard D&D 5e JSON format
- Character portraits with image support
- **Missing Soul** status for unlinked characters
- Auto-calculated HP and AC in character wizard

### Adventure Engine
- Run adventures scene-by-scene with branching choices, skill checks, and combat
- **Adventure Lobby** — players join with character selection, DM starts when ready
- **Soul-binding embed** sent to player when character is linked
- NPC viewer and scene detail modals
- Variable tracking and choice conditions

### Combat Tracker
- Build encounters from SRD monster database (500 monsters)
- Full turn-based combat with initiative tracking
- HP tracking, conditions, damage/heal controls
- Custom combatant support

### SRD Content Database
- **500 monsters** with full stats, abilities, and source references
- **500 spells** with casting info, descriptions, and damage types
- **500 items** with rarity, type, and attunement info
- Data sourced from 193 official D&D sources (PHB, DMG, MM, Xanathar's, Tasha's, etc.)

### Map System
- Upload and view campaign maps
- Canvas-based viewer with pan, zoom, and grid overlay
- **Fog of War** with reveal/hide modes
- Map pins with labels
- **Map Drop Folder** — drop image files directly into `data/uploads/map-drop/`

### Obsidian Vault Integration
- Auto-sync characters, campaigns, sessions, encounters, and locations
- Writes to `Vault/DM-Overlord/{Campaigns,Characters,Sessions,Encounters,Locations}/`
- Automatic sync on all data changes (Discord commands and web UI)
- `Missing Soul` label for unlinked characters

### Activity Feed
- Real-time SSE live log stream in the web UI
- Filterable event log with timestamp
- All rolls, commands, and changes logged

### File Browser
- Browse all uploaded files in `data/uploads/`
- Upload files directly from the web UI
- View images and copy shareable URLs

### Player & Admin Management
- Create player accounts with `/player create`
- **Automatic DM delivery** of credentials to Discord users
- Password change on first login (enforced via `must_change_password` flag)
- Guild-scoped admins with `/admin add/remove/list`
- Player Roles page to manage campaign permissions

### Guild-Scoped Data
- All campaigns isolated by Discord server
- Guild selector in the web UI to switch between servers
- Data from different servers never mixes

### Auto Membership Check
- On startup, checks if linked players are still members of their guilds
- Unlinks characters whose players have left
- Falls back to individual REST checks if bulk fetch times out

## Web UI Pages

| Page | Access | Description |
|------|--------|-------------|
| Dashboard | DM | Stats overview, recent campaigns |
| Campaigns | DM | Campaign list with library toggle, guild filter |
| Campaign Detail | DM | Stats, description, characters, players, sessions |
| Characters | DM | Character grid with portraits, HP, AC, search |
| Character Detail | DM/Player | Full D&D sheet with all stats |
| Character Manager | DM | Admin table with search, link/unlink, JSON import |
| Dice Roller | DM/Player | 3D SVG dice with counters, modifier, presets |
| Adventures | DM | Campaign picker, module explorer, scene modals |
| Adventure Session | DM | Lobby view or scene view with choices |
| Encounters | DM | Campaign picker, encounter list |
| Encounter Detail | DM | Combat tracker with turn order, HP bars |
| Maps | DM/Player | Campaign maps with viewer |
| SRD Browser | DM | Monsters/spells/items tables with detail pages |
| Activity | DM | Live SSE event log |
| Player Roles | DM | Per-campaign role management |
| Settings | DM | Guild settings, embed channel config |
| File Browser | DM | Upload, browse, view, copy URLs |
| My Characters | Player | Character cards for linked characters |
| My Settings | Player | Password change |

## Discord Commands

| Command | Description |
|---------|-------------|
| `/admin add <user> [role]` | Designate a guild-scoped admin (sends DM with credentials) |
| `/admin remove <user>` | Remove guild admin |
| `/admin list` | List guild admins |
| `/admin link <character-id> [user]` | Link character to Discord user (sends soul-binding embed) |
| `/admin unlink <character-id>` | Unlink character |
| `/admin whois [user]` | Show characters linked to a user |
| `/player create <username> <password> [discord-user]` | Create player account (DMs credentials) |
| `/player list` | List web UI player accounts |
| `/player remove <id>` | Deactivate a player account |
| `/player reset-password <id> <new-password>` | Reset a player's password |
| `/settings embed-channel #channel` | Set notification channel for embeds |
| `/settings view` | View server settings |
| `/dm add <user>` | Designate a global DM |
| `/dm remove <user>` | Remove global DM |
| `/roll <formula>` | Roll dice |
| `/import pdf` | Import campaign PDF |
| `/adventure start <module-id> <campaign-id>` | Create adventure lobby with join buttons |
| `/adventure choose <session-id> <choice>` | Make a choice |
| `/campaign create` | Create a campaign |
| `/campaign list` | List all campaigns (cross-guild) |
| `/character create` | Interactive character creation wizard |
| `/encounter create` | Build a combat encounter |
| `/obsidian sync-character <id>` | Sync character to Obsidian vault |

## Quick Start (Docker)

```bash
git clone https://github.com/Lammy93/DM-Overlord.git
cd DM-Overlord
cp .env.example .env
# Edit .env: set DISCORD_TOKEN, CLIENT_ID
docker compose up -d
# Register slash commands for ALL guilds (runs automatically on join)
docker exec dm-overlord node src/commands/deploy.js
```

The bot auto-registers commands for any guild it joins via the `guildCreate` event. On startup, it also syncs commands to all guilds it's already in.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | - | Discord bot token |
| `CLIENT_ID` | Yes | - | Discord application ID |
| `OPENAI_API_KEY` | No* | - | Required for PDF import AI parsing |
| `WEB_DM_PASSWORD` | No | `overlord` | Web UI admin password (legacy) |
| `WEB_PORT` | No | `3000` | Web UI port |
| `WEB_HOST` | No | `localhost` | Web UI bind host (set to `0.0.0.0` for Docker) |
| `WEB_BASE_URL` | No | `http://localhost:3000` | External URL for Discord map links |
| `OBSIDIAN_VAULT_PATH` | No | - | Absolute path to Obsidian vault |
| `DATABASE_PATH` | No | `./data/dm-overlord.db` | SQLite database location |

*PDF import requires `OPENAI_API_KEY`. Everything else works without it.

## Default Credentials

On first launch, a default admin account is created:
- **Username**: `Overlord`
- **Password**: `DM`

You can change this password after logging in. Create additional admin accounts with `/admin add` in Discord — credentials are sent via DM.

## License

MIT
