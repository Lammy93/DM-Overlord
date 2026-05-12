import { getDb } from '../db/index.js';

export function ensureGuildSettingsTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guild_id, key)
    )
  `);
}

export function setGuildSetting(guildId, key, value) {
  ensureGuildSettingsTable();
  const db = getDb();
  db.prepare(`
    INSERT INTO guild_settings (guild_id, key, value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(guildId, key, value);
}

export function getGuildSetting(guildId, key) {
  ensureGuildSettingsTable();
  const db = getDb();
  const row = db.prepare('SELECT value FROM guild_settings WHERE guild_id = ? AND key = ?').get(guildId, key);
  return row?.value || null;
}

export function deleteGuildSetting(guildId, key) {
  ensureGuildSettingsTable();
  const db = getDb();
  db.prepare('DELETE FROM guild_settings WHERE guild_id = ? AND key = ?').run(guildId, key);
}
