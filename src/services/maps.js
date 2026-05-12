import { getDb } from '../db/index.js';

export function getCampaignMaps(campaignId) {
  const db = getDb();
  return db.prepare('SELECT * FROM campaign_maps WHERE campaign_id = ? ORDER BY updated_at DESC').all(campaignId);
}

export function getMap(id) {
  const db = getDb();
  const map = db.prepare('SELECT * FROM campaign_maps WHERE id = ?').get(id);
  if (!map) return null;
  map.pins = db.prepare('SELECT * FROM map_pins WHERE map_id = ? ORDER BY created_at ASC').all(id);
  return map;
}

export function addMap(campaignId, data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO campaign_maps (campaign_id, name, image_url, width, height, grid_size, grid_offset_x, grid_offset_y, is_public, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    campaignId,
    data.name,
    data.imageUrl,
    data.width || 0,
    data.height || 0,
    data.gridSize || 50,
    data.gridOffsetX || 0,
    data.gridOffsetY || 0,
    data.isPublic !== undefined ? (data.isPublic ? 1 : 0) : 1,
    data.notes || null
  );
  return getMap(result.lastInsertRowid);
}

export function updateMap(id, data) {
  const db = getDb();
  const fields = [];
  const values = {};
  for (const [key, value] of Object.entries(data)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (['name', 'image_url', 'width', 'height', 'grid_size', 'grid_offset_x', 'grid_offset_y', 'is_public', 'is_dm_only', 'notes', 'fog_data'].includes(dbKey)) {
      const val = Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : value;
      fields.push(`${dbKey} = @${key}`);
      values[key] = val;
    }
  }
  if (fields.length === 0) return getMap(id);
  values.id = id;
  db.prepare(`UPDATE campaign_maps SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`).run(values);
  return getMap(id);
}

export function updateMapFog(id, fogData) {
  const db = getDb();
  const val = typeof fogData === 'string' ? fogData : JSON.stringify(fogData);
  db.prepare('UPDATE campaign_maps SET fog_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(val, id);
  return db.prepare('SELECT fog_data FROM campaign_maps WHERE id = ?').get(id);
}

export function deleteMap(id) {
  const db = getDb();
  db.prepare('DELETE FROM campaign_maps WHERE id = ?').run(id);
}

export function addPin(mapId, data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO map_pins (map_id, label, description, x, y, pin_type, icon)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    mapId,
    data.label || null,
    data.description || null,
    data.x,
    data.y,
    data.pinType || 'location',
    data.icon || null
  );
  return db.prepare('SELECT * FROM map_pins WHERE id = ?').get(result.lastInsertRowid);
}

export function deletePin(id) {
  const db = getDb();
  db.prepare('DELETE FROM map_pins WHERE id = ?').run(id);
}

export function updatePin(id, data) {
  const db = getDb();
  const fields = [];
  const values = {};
  for (const [key, value] of Object.entries(data)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (['label', 'description', 'x', 'y', 'pin_type', 'icon'].includes(dbKey)) {
      fields.push(`${dbKey} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length === 0) return db.prepare('SELECT * FROM map_pins WHERE id = ?').get(id);
  values.id = id;
  db.prepare(`UPDATE map_pins SET ${fields.join(', ')} WHERE id = @id`).run(values);
  return db.prepare('SELECT * FROM map_pins WHERE id = ?').get(id);
}
