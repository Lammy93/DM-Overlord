# DM-Overlord

A Discord bot that serves as your **AI-powered Dungeon Master assistant** for running D&D 5e (2014 & 2024) campaigns. Import campaign PDFs, auto-parse them into structured adventures, run your party through scenes with choices and combat, track characters and encounters, and sync everything to Obsidian.

## Features

### 📚 PDF Campaign Import
- Upload any D&D campaign book PDF
- AI extracts chapters, scenes, NPCs, locations, monsters, and items
- Converts into a structured, playable adventure module
- Supports any campaign book — WoTC or homebrew

### 🎮 Adventure Engine
- Run your party through the adventure scene-by-scene
- DM narrates, players choose from numbered options
- Supports skill checks, combat encounters, and branching paths
- Tracks party state, variables, and history
- Branching choices with success/fail conditions

### 🎲 Dice Rolling
- Standard notation (`1d20`, `2d6+3`)
- Advantage/disadvantage on d20 rolls
- Hidden rolls (DM-only)
- DM flavor narration on crits and fails

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
- Build encounters from built-in SRD monster database
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

### Import & Adventures
| Command | Description |
|---------|-------------|
| `/import pdf <file>` | Upload a campaign PDF, AI parses it into structured data |
| `/import list` | List imported source documents |
| `/import view <id>` | View parsed document details (chapters, NPCs, etc.) |
| `/import convert <doc-id> <campaign-id>` | Convert parsed document into a playable adventure module |
| `/adventure list <campaign-id>` | List available adventure modules |
| `/adventure start <module-id> <campaign-id>` | Begin running an adventure for your party |
| `/adventure scene <session-id>` | View current scene narration and choices |
| `/adventure choose <session-id> <number>` | Make a numbered choice and advance the story |
| `/adventure status <session-id>` | View session state, history, and variables |
| `/adventure info <module-id>` | View module details (scenes, NPCs, monsters) |
| `/adventure end <session-id>` | Conclude an adventure session |

### Dice & Gameplay
| Command | Description |
|---------|-------------|
| `/roll <formula>` | Roll dice (optional: advantage, disadvantage, reason, hidden) |
| `/srd monster <name>` | Look up a monster from SRD |
| `/srd spell <name>` | Look up a spell |
| `/srd item <name>` | Look up an item |
| `/srd monsters-by-cr <cr>` | List monsters by challenge rating |

### Campaign Management
| Command | Description |
|---------|-------------|
| `/campaign create` | Create a new campaign |
| `/campaign list` | List your campaigns |
| `/campaign info <id>` | View campaign details |
| `/campaign update <id>` | Update campaign settings |
| `/campaign add-player` | Invite a player to your campaign |
| `/campaign remove-player` | Remove a player |
| `/campaign session` | Log a new session |
| `/campaign sessions` | View session logs |
| `/campaign note` | Add a campaign note |

### Character Management
| Command | Description |
|---------|-------------|
| `/character create` | Create a new character |
| `/character list` | List your characters |
| `/character view <id>` | View a character sheet |
| `/character update <id>` | Update HP, AC, stats, etc. |
| `/character damage <id> <amount>` | Apply damage |
| `/character heal <id> <amount>` | Restore HP |
| `/character xp <id> <amount>` | Add experience points |
| `/character levelup <id>` | Level up |

### Combat Encounters
| Command | Description |
|---------|-------------|
| `/encounter create` | Create a combat encounter |
| `/encounter list <campaign-id>` | List encounters |
| `/encounter view <id>` | View encounter status |
| `/encounter add-monster` | Add SRD monsters to an encounter |
| `/encounter add-custom` | Add a custom combatant |
| `/encounter start <id>` | Begin combat with initiative |
| `/encounter next <id>` | Advance to next turn |
| `/encounter damage <combatant-id> <amount>` | Damage a combatant |
| `/encounter condition <combatant-id> <condition>` | Add a condition |
| `/encounter end <id>` | End the encounter |

### Obsidian Integration
| Command | Description |
|---------|-------------|
| `/obsidian status` | Check Obsidian vault connection |
| `/obsidian sync-campaign <id>` | Sync campaign notes to vault |
| `/obsidian sync-character <id>` | Sync character sheet to vault |
| `/obsidian sync-session <id>` | Sync session log to vault |
| `/obsidian sync-encounter <id>` | Sync encounter record to vault |

## Quick Start (Docker)

### Prerequisites
- Docker (Docker Desktop on Windows/Mac, or Unraid's built-in Docker)
- A Discord Application from https://discord.com/developers/applications
- An OpenAI API key from https://platform.openai.com/api-keys (for PDF parsing)

### Discord Bot Setup
1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it
3. Go to **Bot** tab → **Create Bot** → copy **Token** and **Client ID**
4. Enable **Message Content Intent** under Privileged Gateway Intents
5. Go to **OAuth2** → **URL Generator** → select `bot` + `applications.commands` → open URL to add bot to server

### Run with Docker Compose

```bash
git clone https://github.com/Lammy93/DM-Overlord.git
cd DM-Overlord

cp .env.example .env
# Edit .env: set DISCORD_TOKEN, CLIENT_ID, GUILD_ID, OPENAI_API_KEY

docker compose up -d

# Register slash commands (run once)
docker exec dm-overlord node src/commands/deploy.js
```

### Run with Docker CLI

```bash
docker run -d --name dm-overlord --restart unless-stopped \
  -e DISCORD_TOKEN=your_token \
  -e CLIENT_ID=your_client_id \
  -e GUILD_ID=your_server_id \
  -e OPENAI_API_KEY=sk-your_key \
  -v $(pwd)/data:/app/data \
  ghcr.io/lammy93/dm-overlord:latest
```

### Run Locally (Node.js)

```bash
git clone https://github.com/Lammy93/DM-Overlord.git
cd DM-Overlord

cp .env.example .env
# Edit .env

npm install
npm run deploy
npm start
```

## Unraid Setup

### Via Docker Compose (recommended)
1. Install **Compose Manager** from Unraid's Community Apps
2. Create a new stack, paste `docker-compose.unraid.yml` from the repo
3. Set environment variables (DISCORD_TOKEN, CLIENT_ID, GUILD_ID, OPENAI_API_KEY)
4. Click **Compose Up** — pulls `ghcr.io/lammy93/dm-overlord:latest`

### Via Docker UI
1. **Docker** tab → **Add Container**
2. Repository: `ghcr.io/lammy93/dm-overlord:latest`
3. Add variables: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `OPENAI_API_KEY`

## Importing a Campaign Book

### Step 1: Upload the PDF
```
/import pdf
```
Attach your campaign PDF. The bot extracts text and sends it to OpenAI for structural analysis (chapters, scenes, NPCs, locations, monsters, items).

### Step 2: Review the parsed data
```
/import view <document-id>
```
Check what was extracted — chapters, NPCs, locations, etc.

### Step 3: Convert to adventure module
```
/import convert <document-id> <campaign-id>
```
Turns the parsed data into a playable adventure with scenes and choices.

### Step 4: Run the adventure
```
/adventure start <module-id> <campaign-id>
```
The bot narrates the first scene. Players pick choices with `/adventure choose`.

### Example Module Structure
Adventures are stored as structured JSON with scenes containing narration text, choices with conditions, skill checks, combat encounters, and loot. The AI extracts this automatically from PDFs, or you can write your own:

```json
{
  "title": "The Lost Mine",
  "scenes": [
    {
      "id": "cave_entrance",
      "title": "Cave Entrance",
      "type": "exploration",
      "text": "Darkness pours from the cave mouth...",
      "choices": [
        { "text": "Enter quietly", "nextScene": "goblin_ambush", "requiredCheck": { "skill": "stealth", "dc": 12 } },
        { "text": "Light a torch", "nextScene": "cave_lit" }
      ]
    }
  ]
}
```

## Obsidian Vault Setup

1. Set `OBSIDIAN_VAULT_PATH` in `.env` to your vault's absolute path
2. When using Docker, mount the vault:
   ```yaml
   volumes:
     - /path/to/your/obsidian-vault:/vault:ro
   ```
3. Use `/obsidian status` to verify connection
4. Use `/obsidian sync-campaign`, `/obsidian sync-character`, etc. to write notes

The bot auto-creates a `DM-Overlord/` folder with subdirectories: `Campaigns/`, `Characters/`, `Sessions/`, `Encounters/`.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | - | Discord bot token |
| `CLIENT_ID` | Yes | - | Discord application ID |
| `GUILD_ID` | No | - | Server ID for instant command registration |
| `OPENAI_API_KEY` | No* | - | OpenAI API key (required for PDF import) |
| `AI_MODEL` | No | `gpt-4o-mini` | AI model for parsing ($0.01/book) |
| `OBSIDIAN_VAULT_PATH` | No | - | Absolute path to your Obsidian vault |
| `OBSIDIAN_SUBFOLDER` | No | `DM-Overlord` | Subfolder in vault for notes |
| `NARRATION_STYLE` | No | `descriptive` | descriptive, cinematic, minimal, humorous |
| `LOG_LEVEL` | No | `info` | debug, info, warn, error |

*Required for `/import pdf` and `/adventure` commands that use AI. Everything else works without it.

## Updating

### Docker
```bash
git pull
docker compose pull
docker compose up -d
```

### Local
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
│   ├── index.js               # Entry point
│   ├── config.js              # Configuration
│   ├── client.js              # Discord client setup
│   ├── commands/              # Slash commands
│   │   ├── roll.js            # Dice rolling
│   │   ├── import-cmd.js      # PDF import & AI parsing
│   │   ├── adventure.js       # Adventure engine runner
│   │   ├── campaign/          # Campaign management
│   │   ├── character/         # Character sheets
│   │   ├── encounter/         # Combat encounters
│   │   ├── obsidian.js        # Obsidian vault sync
│   │   └── srd-cmd.js         # SRD content lookup
│   ├── events/                # Discord event handlers
│   ├── services/              # Business logic
│   │   ├── dice.js            # Dice engine
│   │   ├── campaign.js        # Campaign CRUD
│   │   ├── character.js       # Character CRUD
│   │   ├── encounter.js       # Combat tracker
│   │   ├── adventure.js       # Adventure engine
│   │   ├── aiParser.js        # OpenAI integration
│   │   ├── pdfParser.js       # PDF text extraction
│   │   ├── sourceDocs.js      # Source document storage
│   │   ├── content.js         # Custom content manager
│   │   ├── obsidian.js        # Vault file writer
│   │   ├── srd.js             # SRD data queries
│   │   └── narration.js       # DM flavor text
│   ├── db/                    # SQLite database layer
│   ├── data/                  # SRD JSON + templates
│   └── utils/                 # Embeds, formatters, validators
├── obsidian-plugin/           # Obsidian vault plugin
├── docker-compose.yml
├── docker-compose.unraid.yml
├── Dockerfile
└── package.json
```

## License

MIT
