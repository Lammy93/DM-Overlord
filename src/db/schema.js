export default `
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  setting TEXT,
  status TEXT DEFAULT 'preparation' CHECK(status IN ('preparation', 'active', 'paused', 'completed', 'archived')),
  dm_discord_id TEXT NOT NULL,
  guild_id TEXT,
  channel_id TEXT,
  starting_level INTEGER DEFAULT 1,
  current_session INTEGER DEFAULT 0,
  homebrew_rules TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  discord_username TEXT,
  role TEXT DEFAULT 'player' CHECK(role IN ('player', 'co-dm', 'observer')),
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, discord_id)
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  player_discord_id TEXT NOT NULL,
  name TEXT NOT NULL,
  race TEXT,
  class TEXT,
  subclass TEXT,
  level INTEGER DEFAULT 1,
  background TEXT,
  alignment TEXT,
  experience INTEGER DEFAULT 0,
  stats JSON DEFAULT '{}',
  skills JSON DEFAULT '{}',
  hp_current INTEGER,
  hp_max INTEGER,
  hp_temp INTEGER DEFAULT 0,
  armor_class INTEGER,
  initiative_bonus INTEGER DEFAULT 0,
  speed INTEGER DEFAULT 30,
  inspiration INTEGER DEFAULT 0,
  proficiencies JSON DEFAULT '[]',
  features JSON DEFAULT '[]',
  spells JSON DEFAULT '{}',
  inventory JSON DEFAULT '[]',
  copper INTEGER DEFAULT 0,
  silver INTEGER DEFAULT 0,
  electrum INTEGER DEFAULT 0,
  gold INTEGER DEFAULT 10,
  platinum INTEGER DEFAULT 0,
  personality_traits TEXT,
  ideals TEXT,
  bonds TEXT,
  flaws TEXT,
  backstory TEXT,
  appearance TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS encounters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  environment TEXT,
  difficulty TEXT,
  status TEXT DEFAULT 'prepared' CHECK(status IN ('prepared', 'active', 'completed', 'abandoned')),
  initiative_order JSON DEFAULT '[]',
  current_turn INTEGER DEFAULT 0,
  round INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS encounter_combatants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  encounter_id INTEGER NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('player', 'ally', 'monster', 'neutral')),
  monster_id TEXT,
  character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
  initiative INTEGER,
  ac INTEGER,
  hp_current INTEGER,
  hp_max INTEGER,
  hp_temp INTEGER DEFAULT 0,
  conditions TEXT DEFAULT '[]',
  is_concentrating INTEGER DEFAULT 0,
  concentration_spell TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  title TEXT,
  summary TEXT,
  location TEXT,
  dm_notes TEXT,
  highlights TEXT,
  loot_found TEXT,
  xp_gained INTEGER DEFAULT 0,
  log_content TEXT,
  obsidian_note_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  description TEXT,
  parent_location_id INTEGER REFERENCES campaign_locations(id) ON DELETE SET NULL,
  is_public INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  author_discord_id TEXT,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT DEFAULT 'general',
  is_dm_only INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_dm ON campaigns(dm_discord_id);
CREATE INDEX IF NOT EXISTS idx_characters_player ON characters(player_discord_id);
CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_encounters_campaign ON encounters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_campaign ON session_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_players_campaign ON campaign_players(campaign_id);
`;
