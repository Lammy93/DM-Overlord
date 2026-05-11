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

CREATE TABLE IF NOT EXISTS custom_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  author_discord_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('monster','spell','item','npc','location','encounter','loot_table')),
  name TEXT NOT NULL,
  data JSON NOT NULL DEFAULT '{}',
  tags TEXT DEFAULT '[]',
  is_shared INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS adventure_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  author_discord_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  min_level INTEGER DEFAULT 1,
  max_level INTEGER DEFAULT 20,
  setting TEXT,
  scenes JSON NOT NULL DEFAULT '[]',
  variables JSON DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS adventure_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL REFERENCES adventure_modules(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  dm_discord_id TEXT NOT NULL,
  state TEXT DEFAULT 'not_started' CHECK(state IN ('not_started','running','paused','completed','abandoned')),
  current_scene_id TEXT,
  variables JSON DEFAULT '{}',
  history JSON DEFAULT '[]',
  player_states JSON DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  source_type TEXT DEFAULT 'pdf' CHECK(source_type IN ('pdf','text','json','url')),
  raw_text TEXT,
  chapters JSON DEFAULT '[]',
  npcs JSON DEFAULT '[]',
  locations JSON DEFAULT '[]',
  encounters JSON DEFAULT '[]',
  items JSON DEFAULT '[]',
  monsters JSON DEFAULT '[]',
  summary TEXT,
  parsed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  chapter_number INTEGER,
  content TEXT,
  scenes JSON DEFAULT '[]',
  is_dm_section INTEGER DEFAULT 0,
  metadata JSON DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_custom_content_campaign ON custom_content(campaign_id);
CREATE INDEX IF NOT EXISTS idx_custom_content_type ON custom_content(type);
CREATE INDEX IF NOT EXISTS idx_adventure_modules_campaign ON adventure_modules(campaign_id);
CREATE INDEX IF NOT EXISTS idx_adventure_sessions_module ON adventure_sessions(module_id);
CREATE INDEX IF NOT EXISTS idx_source_documents_campaign ON source_documents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_document_chapters_document ON document_chapters(document_id);
`;
