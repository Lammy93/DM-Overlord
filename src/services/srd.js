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

export function getSrdMonsters(level = null, environment = null) {
  if (!monstersCache) monstersCache = loadJson('monsters.json');
  let results = monstersCache;

  if (level !== null) {
    const crThreshold = Math.max(1, level / 4);
    results = results.filter(m => {
      const cr = parseCr(m.challenge_rating);
      return cr <= crThreshold + 2 && cr >= Math.max(0, crThreshold - 2);
    });
  }

  if (environment) {
    results = results.filter(m =>
      m.environments?.some(e => e.toLowerCase() === environment.toLowerCase())
    );
  }

  return results;
}

export function getSrdMonster(id) {
  if (!monstersCache) monstersCache = loadJson('monsters.json');
  return monstersCache.find(m => m.id === id || m.name.toLowerCase() === id.toLowerCase()) || null;
}

export function searchMonsters(query) {
  if (!monstersCache) monstersCache = loadJson('monsters.json');
  const q = query.toLowerCase();
  return monstersCache.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.type?.toLowerCase().includes(q) ||
    m.size?.toLowerCase() === q
  );
}

export function getSrdSpells(level = null, school = null, class_ = null) {
  if (!spellsCache) spellsCache = loadJson('spells.json');
  let results = spellsCache;

  if (level !== null) results = results.filter(s => s.level === level);
  if (school) results = results.filter(s => s.school?.toLowerCase() === school.toLowerCase());
  if (class_) results = results.filter(s => s.classes?.some(c => c.toLowerCase() === class_.toLowerCase()));

  return results;
}

export function getSrdSpell(id) {
  if (!spellsCache) spellsCache = loadJson('spells.json');
  return spellsCache.find(s => s.id === id || s.name.toLowerCase() === id.toLowerCase()) || null;
}

export function searchSpells(query) {
  if (!spellsCache) spellsCache = loadJson('spells.json');
  const q = query.toLowerCase();
  return spellsCache.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.school?.toLowerCase().includes(q)
  );
}

export function getSrdItems(category = null, rarity = null) {
  if (!itemsCache) itemsCache = loadJson('items.json');
  let results = itemsCache;
  if (category) results = results.filter(i => i.category?.toLowerCase() === category.toLowerCase());
  if (rarity) results = results.filter(i => i.rarity?.toLowerCase() === rarity.toLowerCase());
  return results;
}

export function getSrdItem(id) {
  if (!itemsCache) itemsCache = loadJson('items.json');
  return itemsCache.find(i => i.id === id || i.name.toLowerCase() === id.toLowerCase()) || null;
}

export function searchItems(query) {
  if (!itemsCache) itemsCache = loadJson('items.json');
  const q = query.toLowerCase();
  return itemsCache.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.category?.toLowerCase().includes(q)
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
  return [...new Set(monstersCache.map(m => m.type).filter(Boolean))].sort();
}

export function getAllEnvironments() {
  if (!monstersCache) monstersCache = loadJson('monsters.json');
  const envs = new Set();
  monstersCache.forEach(m => m.environments?.forEach(e => envs.add(e)));
  return [...envs].sort();
}
