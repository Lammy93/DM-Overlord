import { getDb } from '../db/index.js';

export function addCustomContent(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO custom_content (campaign_id, author_discord_id, type, name, data, tags, is_shared)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.campaignId || null,
    data.authorDiscordId,
    data.type,
    data.name,
    JSON.stringify(data.data || {}),
    JSON.stringify(data.tags || []),
    data.isShared ? 1 : 0
  );
  return db.prepare('SELECT * FROM custom_content WHERE id = ?').get(result.lastInsertRowid);
}

export function getCustomContent(id) {
  const db = getDb();
  const content = db.prepare('SELECT * FROM custom_content WHERE id = ?').get(id);
  if (!content) return null;
  return parseContentFields(content);
}

export function listCustomContent(campaignId, type = null) {
  const db = getDb();
  let query = 'SELECT * FROM custom_content WHERE campaign_id = ?';
  const params = [campaignId];
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...params).map(parseContentFields);
}

export function searchCustomContent(campaignId, query, type = null) {
  const db = getDb();
  let sql = 'SELECT * FROM custom_content WHERE campaign_id = ? AND name LIKE ?';
  const params = [campaignId, `%${query}%`];
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  return db.prepare(sql).all(...params).map(parseContentFields);
}

export function deleteCustomContent(id) {
  const db = getDb();
  db.prepare('DELETE FROM custom_content WHERE id = ?').run(id);
}

export function validateContentJson(json, type) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const validators = {
      monster: validateMonster,
      spell: validateSpell,
      item: validateItem,
      npc: validateNpc,
      location: validateLocation,
      encounter: validateEncounterData,
      loot_table: validateLootTable,
    };
    const validator = validators[type];
    if (!validator) return { valid: false, error: `Unknown type: ${type}` };
    return validator(data);
  } catch {
    return { valid: false, error: 'Invalid JSON' };
  }
}

function validateMonster(data) {
  if (!data.name && !data.ac && !data.hp) return { valid: true, data };
  const required = ['ac', 'hp'];
  for (const field of required) {
    if (data[field] === undefined) return { valid: false, error: `Monster missing field: ${field}` };
  }
  return { valid: true, data: { ...data, type: 'monster' } };
}

function validateSpell(data) {
  return { valid: true, data: { ...data, type: 'spell' } };
}

function validateItem(data) {
  return { valid: true, data: { ...data, type: 'item' } };
}

function validateNpc(data) {
  if (!data.name && !data.description) return { valid: false, error: 'NPC must have name' };
  return { valid: true, data: { ...data, type: 'npc' } };
}

function validateLocation(data) {
  if (!data.name) return { valid: false, error: 'Location must have name' };
  return { valid: true, data: { ...data, type: 'location' } };
}

function validateEncounterData(data) {
  if (!data.name) return { valid: false, error: 'Encounter must have name' };
  const monsters = data.monsters || [];
  if (monsters.length === 0) return { valid: false, error: 'Encounter must have at least one monster' };
  return { valid: true, data: { ...data, type: 'encounter' } };
}

function validateLootTable(data) {
  if (!data.items || data.items.length === 0) return { valid: false, error: 'Loot table must have items' };
  return { valid: true, data: { ...data, type: 'loot_table' } };
}

function parseContentFields(content) {
  return {
    ...content,
    data: parseField(content.data, {}),
    tags: parseField(content.tags, []),
  };
}

function parseField(field, fallback) {
  if (!field) return fallback;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return fallback;
  }
}
