import { getDb } from '../db/index.js';
import { getSrdMonster } from './srd.js';

export function createEncounter(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO encounters (campaign_id, name, description, environment, difficulty, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.campaignId,
    data.name,
    data.description || null,
    data.environment || null,
    data.difficulty || 'medium',
    data.status || 'prepared'
  );
  return getEncounter(result.lastInsertRowid);
}

export function getEncounter(id) {
  const db = getDb();
  const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(id);
  if (!encounter) return null;
  encounter.combatants = db.prepare('SELECT * FROM encounter_combatants WHERE encounter_id = ? ORDER BY sort_order ASC').all(id);
  encounter.initiativeOrder = parseField(encounter.initiative_order, []);
  return encounter;
}

export function listEncounters(campaignId) {
  const db = getDb();
  return db.prepare('SELECT * FROM encounters WHERE campaign_id = ? ORDER BY updated_at DESC').all(campaignId);
}

export function updateEncounter(id, data) {
  const db = getDb();
  const fields = [];
  const values = {};
  for (const [key, value] of Object.entries(data)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    const val = Array.isArray(value) ? JSON.stringify(value) : value;
    fields.push(`${dbKey} = @${key}`);
    values[key] = val;
  }
  if (fields.length === 0) return getEncounter(id);
  values.id = id;
  fields.push('updated_at = CURRENT_TIMESTAMP');
  db.prepare(`UPDATE encounters SET ${fields.join(', ')} WHERE id = @id`).run(values);
  return getEncounter(id);
}

export function addCombatant(encounterId, data) {
  const db = getDb();
  const monster = data.monsterId ? getSrdMonster(data.monsterId) : null;
  const hpMax = data.hpMax || monster?.hp || 10;
  const ac = data.ac || monster?.ac || 10;
  const stmt = db.prepare(`
    INSERT INTO encounter_combatants (encounter_id, name, type, monster_id, character_id, initiative, ac, hp_current, hp_max, hp_temp, conditions, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    encounterId,
    data.name,
    data.type || 'monster',
    data.monsterId || null,
    data.characterId || null,
    data.initiative || 0,
    ac,
    hpMax,
    hpMax,
    0,
    JSON.stringify([]),
    data.notes || null,
    data.sortOrder || 0
  );
  return db.prepare('SELECT * FROM encounter_combatants WHERE id = ?').get(result.lastInsertRowid);
}

export function removeCombatant(combatantId) {
  const db = getDb();
  const combatant = db.prepare('SELECT encounter_id FROM encounter_combatants WHERE id = ?').get(combatantId);
  if (!combatant) return null;
  db.prepare('DELETE FROM encounter_combatants WHERE id = ?').run(combatantId);
  return combatant.encounter_id;
}

export function updateCombatant(id, data) {
  const db = getDb();
  const fields = [];
  const values = {};
  for (const [key, value] of Object.entries(data)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    const val = Array.isArray(value) ? JSON.stringify(value) : value;
    fields.push(`${dbKey} = @${key}`);
    values[key] = val;
  }
  if (fields.length === 0) return null;
  values.id = id;
  db.prepare(`UPDATE encounter_combatants SET ${fields.join(', ')} WHERE id = @id`).run(values);
  return db.prepare('SELECT * FROM encounter_combatants WHERE id = ?').get(id);
}

export function startEncounter(id) {
  const encounter = getEncounter(id);
  if (!encounter) return null;

  const combatants = encounter.combatants;
  const sorted = combatants
    .filter(c => c.hp_current > 0)
    .sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

  const order = sorted.map(c => c.id);
  const result = updateEncounter(id, {
    status: 'active',
    initiativeOrder: order,
    currentTurn: 0,
    round: 1,
  });

  const names = result.combatants?.map(c => `${c.name} (${c.hp_current} HP)`).join(', ') || 'Unknown';
  tryAutoLog(encounter.campaign_id, 'combat', `Combat started: ${encounter.name}`, `Combatants: ${names}`, null);
  return result;
}

export function nextTurn(id) {
  const encounter = getEncounter(id);
  if (!encounter || encounter.status !== 'active') return null;

  const order = encounter.initiativeOrder;
  let nextIndex = encounter.currentTurn + 1;

  if (nextIndex >= order.length) {
    nextIndex = 0;
    return updateEncounter(id, {
      currentTurn: nextIndex,
      round: (encounter.round || 1) + 1,
    });
  }
  return updateEncounter(id, { currentTurn: nextIndex });
}

export function damageCombatant(combatantId, amount) {
  const db = getDb();
  const combatant = db.prepare('SELECT * FROM encounter_combatants WHERE id = ?').get(combatantId);
  if (!combatant) return null;

  let remaining = amount;
  let newTemp = combatant.hp_temp || 0;
  let newHp = combatant.hp_current;

  if (newTemp > 0) {
    if (newTemp >= remaining) {
      newTemp -= remaining;
      remaining = 0;
    } else {
      remaining -= newTemp;
      newTemp = 0;
    }
  }

  newHp = Math.max(0, newHp - remaining);
  updateCombatant(combatantId, { hpCurrent: newHp, hpTemp: newTemp });
  return db.prepare('SELECT * FROM encounter_combatants WHERE id = ?').get(combatantId);
}

export function addCondition(combatantId, condition) {
  const db = getDb();
  const combatant = db.prepare('SELECT * FROM encounter_combatants WHERE id = ?').get(combatantId);
  if (!combatant) return null;
  const conditions = parseField(combatant.conditions, []);
  if (!conditions.includes(condition)) {
    conditions.push(condition);
  }
  updateCombatant(combatantId, { conditions });
  return db.prepare('SELECT * FROM encounter_combatants WHERE id = ?').get(combatantId);
}

export function removeCondition(combatantId, condition) {
  const db = getDb();
  const combatant = db.prepare('SELECT * FROM encounter_combatants WHERE id = ?').get(combatantId);
  if (!combatant) return null;
  const conditions = parseField(combatant.conditions, []).filter(c => c !== condition);
  updateCombatant(combatantId, { conditions });
  return db.prepare('SELECT * FROM encounter_combatants WHERE id = ?').get(combatantId);
}

export function endEncounter(id, status = 'completed') {
  const encounter = getEncounter(id);
  const result = updateEncounter(id, { status, currentTurn: 0, round: 0 });
  if (encounter) {
    const alive = encounter.combatants.filter(c => c.hp_current > 0).length;
    tryAutoLog(encounter.campaign_id, 'combat', `Combat ended: ${encounter.name}`, `${alive}/${encounter.combatants.length} combatants survived. Status: ${status}`, null);
  }
  return result;
}

function tryAutoLog(campaignId, type, title, content, authorId) {
  if (!campaignId) return;
  import('./sessionLog.js').then(({ logToActiveSession }) => {
    logToActiveSession(campaignId, type, title, content, authorId);
  }).catch(() => {});
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
