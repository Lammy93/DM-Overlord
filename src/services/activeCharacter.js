import { getDb } from '../db/index.js';

const activeCharacters = new Map();

export function setActiveCharacter(discordId, characterId) {
  activeCharacters.set(discordId, characterId);
}

export function getActiveCharacter(discordId) {
  const charId = activeCharacters.get(discordId);
  if (!charId) return null;
  const db = getDb();
  const character = db.prepare('SELECT * FROM characters WHERE id = ? AND is_active = 1').get(charId);
  if (!character) {
    activeCharacters.delete(discordId);
    return null;
  }
  return character;
}

export function clearActiveCharacter(discordId) {
  activeCharacters.delete(discordId);
}

export function getActiveCharacterId(discordId) {
  return activeCharacters.get(discordId) || null;
}
