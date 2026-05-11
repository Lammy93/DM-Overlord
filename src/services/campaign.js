import { getDb } from '../db/index.js';

export function createCampaign(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO campaigns (name, description, setting, dm_discord_id, guild_id, channel_id, starting_level)
    VALUES (@name, @description, @setting, @dmDiscordId, @guildId, @channelId, @startingLevel)
  `);
  const result = stmt.run({
    name: data.name,
    description: data.description || null,
    setting: data.setting || null,
    dmDiscordId: data.dmDiscordId,
    guildId: data.guildId || null,
    channelId: data.channelId || null,
    startingLevel: data.startingLevel || 1,
  });
  return getCampaign(result.lastInsertRowid);
}

export function getCampaign(id) {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  if (!campaign) return null;
  campaign.players = db.prepare('SELECT * FROM campaign_players WHERE campaign_id = ?').all(id);
  campaign.characters = db.prepare('SELECT id, name, race, class, level, player_discord_id FROM characters WHERE campaign_id = ?').all(id);
  return campaign;
}

export function listCampaigns(discordId, role = 'dm') {
  const db = getDb();
  if (role === 'dm') {
    return db.prepare('SELECT * FROM campaigns WHERE dm_discord_id = ? ORDER BY updated_at DESC').all(discordId);
  }
  const campaigns = db.prepare(`
    SELECT c.* FROM campaigns c
    JOIN campaign_players cp ON c.id = cp.campaign_id
    WHERE cp.discord_id = ? ORDER BY c.updated_at DESC
  `).all(discordId);
  return campaigns;
}

export function updateCampaign(id, data) {
  const db = getDb();
  const fields = [];
  const values = {};
  for (const [key, value] of Object.entries(data)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    fields.push(`${dbKey} = @${key}`);
    values[key] = value;
  }
  if (fields.length === 0) return getCampaign(id);
  values.id = id;
  fields.push('updated_at = CURRENT_TIMESTAMP');
  db.prepare(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = @id`).run(values);
  return getCampaign(id);
}

export function deleteCampaign(id) {
  const db = getDb();
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
}

export function addPlayer(campaignId, discordId, discordUsername, role = 'player') {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO campaign_players (campaign_id, discord_id, discord_username, role)
    VALUES (?, ?, ?, ?)
  `).run(campaignId, discordId, discordUsername, role);
}

export function removePlayer(campaignId, discordId) {
  const db = getDb();
  db.prepare('DELETE FROM campaign_players WHERE campaign_id = ? AND discord_id = ?').run(campaignId, discordId);
}

export function getCampaignPlayers(campaignId) {
  const db = getDb();
  return db.prepare('SELECT * FROM campaign_players WHERE campaign_id = ?').all(campaignId);
}

export function createSessionLog(campaignId, sessionNumber, data = {}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO session_logs (campaign_id, session_number, title, summary, location, dm_notes, highlights, loot_found, xp_gained, log_content, obsidian_note_id)
    VALUES (@campaignId, @sessionNumber, @title, @summary, @location, @dmNotes, @highlights, @lootFound, @xpGained, @logContent, @obsidianNoteId)
  `);
  const result = stmt.run({
    campaignId,
    sessionNumber,
    title: data.title || null,
    summary: data.summary || null,
    location: data.location || null,
    dmNotes: data.dmNotes || null,
    highlights: data.highlights || null,
    lootFound: data.lootFound || null,
    xpGained: data.xpGained || 0,
    logContent: data.logContent || null,
    obsidianNoteId: data.obsidianNoteId || null,
  });
  updateCampaign(campaignId, { currentSession: sessionNumber });
  return db.prepare('SELECT * FROM session_logs WHERE id = ?').get(result.lastInsertRowid);
}

export function getSessionLogs(campaignId) {
  const db = getDb();
  return db.prepare('SELECT * FROM session_logs WHERE campaign_id = ? ORDER BY session_number DESC').all(campaignId);
}

export function getSessionLog(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM session_logs WHERE id = ?').get(id);
}

export function addLocation(campaignId, data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO campaign_locations (campaign_id, name, type, description, parent_location_id, is_public)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(campaignId, data.name, data.type || null, data.description || null, data.parentLocationId || null, data.isPublic !== false ? 1 : 0);
  return db.prepare('SELECT * FROM campaign_locations WHERE id = ?').get(result.lastInsertRowid);
}

export function getLocations(campaignId) {
  const db = getDb();
  return db.prepare('SELECT * FROM campaign_locations WHERE campaign_id = ?').all(campaignId);
}

export function addNote(campaignId, data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO campaign_notes (campaign_id, author_discord_id, title, content, category, is_dm_only, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    campaignId,
    data.authorDiscordId || null,
    data.title,
    data.content || null,
    data.category || 'general',
    data.isDmOnly ? 1 : 0,
    JSON.stringify(data.tags || [])
  );
  return db.prepare('SELECT * FROM campaign_notes WHERE id = ?').get(result.lastInsertRowid);
}

export function getNotes(campaignId, includeDmOnly = false) {
  const db = getDb();
  if (includeDmOnly) {
    return db.prepare('SELECT * FROM campaign_notes WHERE campaign_id = ? ORDER BY created_at DESC').all(campaignId);
  }
  return db.prepare('SELECT * FROM campaign_notes WHERE campaign_id = ? AND is_dm_only = 0 ORDER BY created_at DESC').all(campaignId);
}
