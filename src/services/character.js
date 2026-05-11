import { getDb } from '../db/index.js';

export function createCharacter(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO characters (
      campaign_id, player_discord_id, name, race, class, subclass, level, background,
      alignment, experience, stats, skills, hp_current, hp_max, hp_temp,
      armor_class, initiative_bonus, speed, proficiencies, features,
      spells, inventory, copper, silver, electrum, gold, platinum,
      personality_traits, ideals, bonds, flaws, backstory, appearance
    ) VALUES (
      @campaignId, @playerDiscordId, @name, @race, @class, @subclass, @level,
      @background, @alignment, @experience, @stats, @skills, @hpCurrent, @hpMax,
      @hpTemp, @armorClass, @initiativeBonus, @speed, @proficiencies, @features,
      @spells, @inventory, @copper, @silver, @electrum, @gold, @platinum,
      @personalityTraits, @ideals, @bonds, @flaws, @backstory, @appearance
    )
  `);
  const result = stmt.run({
    campaignId: data.campaignId || null,
    playerDiscordId: data.playerDiscordId,
    name: data.name,
    race: data.race || null,
    class: data.class || null,
    subclass: data.subclass || null,
    level: data.level || 1,
    background: data.background || null,
    alignment: data.alignment || null,
    experience: data.experience || 0,
    stats: JSON.stringify(data.stats || {}),
    skills: JSON.stringify(data.skills || {}),
    hpCurrent: data.hpCurrent || null,
    hpMax: data.hpMax || null,
    hpTemp: data.hpTemp || 0,
    armorClass: data.armorClass || null,
    initiativeBonus: data.initiativeBonus || 0,
    speed: data.speed || 30,
    proficiencies: JSON.stringify(data.proficiencies || []),
    features: JSON.stringify(data.features || []),
    spells: JSON.stringify(data.spells || {}),
    inventory: JSON.stringify(data.inventory || []),
    copper: data.copper || 0,
    silver: data.silver || 0,
    electrum: data.electrum || 0,
    gold: data.gold || 10,
    platinum: data.platinum || 0,
    personalityTraits: data.personalityTraits || null,
    ideals: data.ideals || null,
    bonds: data.bonds || null,
    flaws: data.flaws || null,
    backstory: data.backstory || null,
    appearance: data.appearance || null,
  });
  return getCharacter(result.lastInsertRowid);
}

export function getCharacter(id) {
  const db = getDb();
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(id);
  if (!character) return null;
  return parseCharacterFields(character);
}

export function getPlayerCharacters(discordId) {
  const db = getDb();
  const characters = db.prepare('SELECT * FROM characters WHERE player_discord_id = ? AND is_active = 1').all(discordId);
  return characters.map(parseCharacterFields);
}

export function getCampaignCharacters(campaignId) {
  const db = getDb();
  return db.prepare('SELECT * FROM characters WHERE campaign_id = ? AND is_active = 1').all(campaignId).map(parseCharacterFields);
}

export function updateCharacter(id, data) {
  const db = getDb();
  const fields = [];
  const values = {};
  for (const [key, value] of Object.entries(data)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    const val = Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : value;
    fields.push(`${dbKey} = @${key}`);
    values[key] = val;
  }
  if (fields.length === 0) return getCharacter(id);
  values.id = id;
  fields.push('updated_at = CURRENT_TIMESTAMP');
  db.prepare(`UPDATE characters SET ${fields.join(', ')} WHERE id = @id`).run(values);
  return getCharacter(id);
}

export function deleteCharacter(id) {
  const db = getDb();
  db.prepare('UPDATE characters SET is_active = 0 WHERE id = ?').run(id);
}

export function addExperience(id, amount) {
  const db = getDb();
  db.prepare('UPDATE characters SET experience = experience + ? WHERE id = ?').run(amount, id);
  return getCharacter(id);
}

export function levelUp(id) {
  const db = getDb();
  const character = getCharacter(id);
  if (!character || character.level >= 20) return null;
  db.prepare('UPDATE characters SET level = level + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  return getCharacter(id);
}

export function damageCharacter(id, amount) {
  const db = getDb();
  const character = getCharacter(id);
  if (!character) return null;

  let remaining = amount;
  let newTemp = character.hpTemp || 0;
  let newHp = character.hpCurrent;

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
  db.prepare('UPDATE characters SET hp_current = ?, hp_temp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHp, newTemp, id);
  return getCharacter(id);
}

export function healCharacter(id, amount) {
  const db = getDb();
  const character = getCharacter(id);
  if (!character) return null;
  const newHp = Math.min(character.hpMax, character.hpCurrent + amount);
  db.prepare('UPDATE characters SET hp_current = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHp, id);
  return getCharacter(id);
}

function parseCharacterFields(character) {
  return {
    ...character,
    stats: parseField(character.stats, {}),
    skills: parseField(character.skills, {}),
    proficiencies: parseField(character.proficiencies, []),
    features: parseField(character.features, []),
    spells: parseField(character.spells, {}),
    inventory: parseField(character.inventory, []),
    tags: parseField(character.tags, []),
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
