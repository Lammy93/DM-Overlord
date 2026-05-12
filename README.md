# DM-Overlord

A Discord bot and web dashboard for **AI-powered Dungeon Mastering** — import campaign PDFs, run adventures with your party, track characters and combat, sync to Obsidian, and manage everything from a D&D-themed web UI.

## Quick Start (Docker)

### Prerequisites
- Docker Compose v2 or later
- A Discord Application from https://discord.com/developers/applications
  - Create **Bot** → copy **Token** and **Client ID**
  - Enable **Message Content Intent** under Privileged Gateway Intents

### Setup

```bash
git clone https://github.com/Lammy93/DM-Overlord.git
cd DM-Overlord
cp .env.example .env
# Edit .env: set DISCORD_TOKEN, CLIENT_ID
docker compose up -d
```

The first time you run this, the bot will pull the latest image from GitHub Container Registry. Once running, open `http://localhost:3000` for the web UI.

### Default Login
- **Username**: `Overlord`
- **Password**: `DM`

Log in via the **Admin** tab. Change your password after first login. Create additional accounts with `/admin add` in Discord — the new admin receives their credentials via DM.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | - | Discord bot token |
| `CLIENT_ID` | Yes | - | Discord application ID |
| `OPENAI_API_KEY` | No | - | Required for PDF import AI parsing |
| `WEB_PORT` | No | `3000` | Web UI port |
| `WEB_HOST` | No | `localhost` | Set to `0.0.0.0` for Docker |
| `OBSIDIAN_VAULT_PATH` | No | - | Path to your Obsidian vault for auto-sync |

## Connecting the Bot to Your Server

1. Go to https://discord.com/developers/applications
2. Select your app → **OAuth2** → **URL Generator**
3. Check `bot` + `applications.commands`
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

Commands register automatically when the bot joins. Use `/roll 1d20` to test.

## Web UI

Open `http://localhost:3000` in your browser. The web dashboard has pages for:

- **Dashboard** — overview stats
- **Campaigns** — manage campaigns, view session logs
- **Characters** — full D&D 5e character sheets
- **Dice Roller** — 3D animated dice
- **Adventures** — run scene-by-scene adventures
- **Encounters** — combat tracker with turn order
- **Maps** — upload maps with fog of war
- **SRD Browser** — browse 500 monsters, 500 spells, 500 items
- **Activity** — live event log
- **Settings** — configure embed channels

## License

MIT
