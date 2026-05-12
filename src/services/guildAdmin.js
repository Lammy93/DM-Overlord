import { getDb } from '../db/index.js';

export function ensureGuildAdminsTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      discord_id TEXT NOT NULL,
      discord_username TEXT,
      role TEXT DEFAULT 'admin' CHECK(role IN ('admin', 'co-dm')),
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guild_id, discord_id)
    )
  `);
}

export function addGuildAdmin(guildId, discordId, discordUsername = null, role = 'admin', createdBy = null) {
  ensureGuildAdminsTable();
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO guild_admins (guild_id, discord_id, discord_username, role, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(guildId, discordId, discordUsername, role, createdBy);
  return db.prepare('SELECT * FROM guild_admins WHERE guild_id = ? AND discord_id = ?').get(guildId, discordId);
}

export function removeGuildAdmin(guildId, discordId) {
  ensureGuildAdminsTable();
  const db = getDb();
  db.prepare('DELETE FROM guild_admins WHERE guild_id = ? AND discord_id = ?').run(guildId, discordId);
}

export function isGuildAdmin(guildId, discordId) {
  ensureGuildAdminsTable();
  const db = getDb();
  return !!db.prepare('SELECT 1 FROM guild_admins WHERE guild_id = ? AND discord_id = ?').get(guildId, discordId);
}

export function listGuildAdmins(guildId) {
  ensureGuildAdminsTable();
  const db = getDb();
  return db.prepare('SELECT * FROM guild_admins WHERE guild_id = ? ORDER BY created_at ASC').all(guildId);
}

export function linkCharacter(discordId, characterId) {
  const db = getDb();
  if (!discordId || discordId === '') return { error: 'discordId is required.' };
  const existing = db.prepare('SELECT id, player_discord_id FROM characters WHERE id = ?').get(characterId);
  if (!existing) return { error: 'Character not found.' };
  if (existing.player_discord_id && existing.player_discord_id !== '' && existing.player_discord_id !== discordId) {
    return { error: `Character is already linked to <@${existing.player_discord_id}>. Unlink them first.` };
  }
  db.prepare('UPDATE characters SET player_discord_id = ? WHERE id = ?').run(discordId, characterId);
  return { success: true };
}

export function unlinkCharacter(characterId) {
  const db = getDb();
  const existing = db.prepare('SELECT id, player_discord_id FROM characters WHERE id = ?').get(characterId);
  if (!existing) return { error: 'Character not found.' };
  if (!existing.player_discord_id || existing.player_discord_id === '') return { error: 'Character is not linked to any user.' };
  db.prepare("UPDATE characters SET player_discord_id = '' WHERE id = ?").run(characterId);
  return { success: true, previousUser: existing.player_discord_id };
}

export function getPlayerCharacters(discordId) {
  const db = getDb();
  return db.prepare('SELECT id, name, race, class, level, campaign_id FROM characters WHERE player_discord_id = ?').all(discordId);
}
