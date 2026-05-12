import { getDb } from '../db/index.js';

export function ensureDmRolesTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS dm_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL UNIQUE,
      discord_username TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function addDm(discordId, discordUsername = null, notes = null) {
  ensureDmRolesTable();
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO dm_users (discord_id, discord_username, notes)
    VALUES (?, ?, ?)
  `).run(discordId, discordUsername, notes);
  return db.prepare('SELECT * FROM dm_users WHERE discord_id = ?').get(discordId);
}

export function removeDm(discordId) {
  ensureDmRolesTable();
  const db = getDb();
  db.prepare('DELETE FROM dm_users WHERE discord_id = ?').run(discordId);
}

export function isDm(discordId) {
  ensureDmRolesTable();
  const db = getDb();
  return !!db.prepare('SELECT 1 FROM dm_users WHERE discord_id = ?').get(discordId);
}

export function listDms() {
  ensureDmRolesTable();
  const db = getDb();
  return db.prepare('SELECT * FROM dm_users ORDER BY created_at ASC').all();
}
