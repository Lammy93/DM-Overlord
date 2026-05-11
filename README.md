# DM-Overlord

A Discord bot that serves as your **Dungeon Master assistant** for running D&D 5e (2014 & 2024) campaigns. Features campaign management, character sheets, encounter/combat tracking, dice rolling, SRD content lookup, and **Obsidian vault integration** for session logging.

## Features

### 🎲 Dice Rolling
- Standard notation (`1d20`, `2d6+3`)
- Advantage/disadvantage on d20 rolls
- Hidden rolls (DM-only)

### 📜 Campaign Management
- Create and manage multiple campaigns
- Player invites with roles (player, co-dm, observer)
- Session logging with summaries, highlights, and loot
- Campaign notes with categories

### 🧙 Character Sheets
- Create characters with race, class, stats, and more
- Track HP, AC, XP, inventory, and currency
- Damage/heal tracking
- Level up with XP tracking

### ⚔️ Encounter Builder & Combat Tracker
- Build encounters from SRD monster database
- Custom combatants (homebrew monsters, NPCs, allies)
- Full combat tracker with turn order
- HP tracking, conditions, auto-initiative
- DM narration flavor text for hits, crits, kills

### 📖 SRD Content Database
- **Monsters**: 20+ SRD monsters with full stats, actions, and traits
- **Spells**: 25+ SRD spells with descriptions, components, and class lists
- **Items**: Armor, weapons, magic items, potions
- **Classes & Races**: Full SRD class and race data with subraces

### 📝 Obsidian Vault Integration
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

## Setup

### Prerequisites
- Node.js 18+ or Docker
- A Discord Application (from https://discord.dev)

### Discord Bot Setup
1. Go to https://discord.com/developers/applications
2. Create a new application → Bot → Create Bot
3. Copy the **Token** and **Client ID**
4. Enable these Privileged Gateway Intents:
   - `MESSAGE CONTENT INTENT`
   - `SERVER MEMBERS INTENT` (optional)

### Installation

1. Clone the repo:
```bash
git clone <repo-url>
cd DM-Overlord
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your Discord token and Obsidian vault path
```

4. Deploy slash commands:
```bash
npm run deploy
```

5. Start the bot:
```bash
npm start
```

### Docker
```bash
docker build -t dm-overlord .
docker run -d \
  --name dm-overlord \
  -e DISCORD_TOKEN=your_token \
  -e CLIENT_ID=your_client_id \
  -v /path/to/data:/app/data \
  -v /path/to/obsidian-vault:/vault:ro \
  dm-overlord
```

### Obsidian Vault Setup
1. Set `OBSIDIAN_VAULT_PATH` in `.env` to your vault's absolute path
2. The bot will auto-create `DM-Overlord/` subfolder with subdirectories
3. Use `/obsidian status` to verify connection
4. (Optional) Install the DM-Overlord plugin from the `obsidian-plugin/` folder

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `CLIENT_ID` | Yes | Discord application ID |
| `GUILD_ID` | No | Guild ID for instant command registration |
| `OBSIDIAN_VAULT_PATH` | No | Absolute path to Obsidian vault |
| `NARRATION_STYLE` | No | descriptive, cinematic, minimal, or humorous |

## Project Structure
```
DM-Overlord/
├── src/
│   ├── index.js              # Entry point
│   ├── config.js             # Configuration
│   ├── client.js             # Discord client
│   ├── commands/             # Slash commands
│   │   ├── roll.js
│   │   ├── campaign.js
│   │   ├── character.js
│   │   ├── encounter.js
│   │   ├── obsidian.js
│   │   └── srd-cmd.js
│   ├── events/               # Event handlers
│   ├── services/             # Business logic
│   │   ├── dice.js
│   │   ├── campaign.js
│   │   ├── character.js
│   │   ├── encounter.js
│   │   ├── obsidian.js
│   │   ├── srd.js
│   │   └── narration.js
│   ├── db/                   # Database layer
│   ├── data/                 # SRD content & templates
│   └── utils/                # Helpers
├── obsidian-plugin/          # Obsidian vault plugin
├── Dockerfile
└── package.json
```

## License
MIT
