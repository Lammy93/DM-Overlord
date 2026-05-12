import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');

let monstersCache = null;
let spellsCache = null;
let itemsCache = null;
let classesCache = null;
let racesCache = null;

function loadJson(filename) {
  const filePath = join(DATA_DIR, filename);
  if (!existsSync(filePath)) return [];
  try {
    const data = readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Helper: get a property from an item's properties object, or from the root if flat
function p(item, key, fallback = null) {
  if (item.properties && item.properties[key] !== undefined && item.properties[key] !== '') return item.properties[key];
  if (item[key] !== undefined && item[key] !== '') return item[key];
  return fallback;
}

export function getSrdMonsters(level = null, environment = null) {
  if (!monstersCache) monstersCache = loadJson('monsters.json');
  let results = monstersCache;

  if (level !== null) {
    const crThreshold = Math.max(1, level / 4);
    results = results.filter(m => {
      const cr = parseCr(p(m, 'CR'));
      return cr <= crThreshold + 2 && cr >= Math.max(0, crThreshold - 2);
    });
  }

  return results;
}

export function getSrdMonster(name) {
  if (!monstersCache) monstersCache = loadJson('monsters.json');
  return monstersCache.find(m => m.name.toLowerCase() === name.toLowerCase()) || null;
}

export function searchMonsters(query) {
  if (!monstersCache) monstersCache = loadJson('monsters.json');
  const q = query.toLowerCase();
  return monstersCache.filter(m =>
    m.name.toLowerCase().includes(q) ||
    p(m, 'Type', '').toLowerCase().includes(q) ||
    p(m, 'Size', '').toLowerCase().includes(q)
  );
}

export function getSrdSpells(level = null, school = null, class_ = null) {
  if (!spellsCache) spellsCache = loadJson('spells.json');
  let results = spellsCache;

  if (level !== null) results = results.filter(s => parseInt(p(s, 'Level', 0), 10) === level);
  if (school) results = results.filter(s => p(s, 'School', '').toLowerCase() === school.toLowerCase());

  return results;
}

export function getSrdSpell(name) {
  if (!spellsCache) spellsCache = loadJson('spells.json');
  return spellsCache.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
}

export function searchSpells(query) {
  if (!spellsCache) spellsCache = loadJson('spells.json');
  const q = query.toLowerCase();
  return spellsCache.filter(s =>
    s.name.toLowerCase().includes(q) ||
    p(s, 'School', '').toLowerCase().includes(q)
  );
}

export function getSrdItems(category = null, rarity = null) {
  if (!itemsCache) itemsCache = loadJson('items.json');
  let results = itemsCache;
  if (category) results = results.filter(i => p(i, 'Category', '').toLowerCase() === category.toLowerCase());
  if (rarity) results = results.filter(i => p(i, 'Item Rarity', '').toLowerCase() === rarity.toLowerCase());
  return results;
}

export function getSrdItem(name) {
  if (!itemsCache) itemsCache = loadJson('items.json');
  return itemsCache.find(i => i.name.toLowerCase() === name.toLowerCase()) || null;
}

export function searchItems(query) {
  if (!itemsCache) itemsCache = loadJson('items.json');
  const q = query.toLowerCase();
  return itemsCache.filter(i =>
    i.name.toLowerCase().includes(q) ||
    p(i, 'Category', '').toLowerCase().includes(q)
  );
}

export function getSrdClasses() {
  if (!classesCache) classesCache = loadJson('classes.json');
  return classesCache;
}

export function getSrdClass(name) {
  if (!classesCache) classesCache = loadJson('classes.json');
  return classesCache.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
}

export function getSrdRaces() {
  if (!racesCache) racesCache = loadJson('races.json');
  return racesCache;
}

export function getSrdRace(name) {
  if (!racesCache) racesCache = loadJson('races.json');
  return racesCache.find(r => r.name.toLowerCase() === name.toLowerCase()) || null;
}

function parseCr(cr) {
  if (cr === null || cr === undefined) return 0;
  if (typeof cr === 'number') return cr;
  const fractions = { '1/8': 0.125, '1/4': 0.25, '1/2': 0.5 };
  return fractions[cr] || parseFloat(cr) || 0;
}

export function getAllMonsterTypes() {
  if (!monstersCache) monstersCache = loadJson('monsters.json');
  return [...new Set(monstersCache.map(m => p(m, 'Type')).filter(Boolean))].sort();
}

export function getAllEnvironments() {
  return [];
}
